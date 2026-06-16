const router = require("express").Router();
const pool = require("../db");

// --- UTILITAIRE : NOTIFICATION TEMPS RÉEL ---
const notifyRefresh = (req) => {
  const io = req.app.get("socketio") || req.io;
  if (io) io.emit("refresh_data");
};

// --- 1. CRÉATION D'UNE VENTE (POST) ---
router.post("/", async (req, res) => {
  const id_structure = req.body.id_structure || req.headers["id_structure"];
  const { id_utilisateur, mode_paiement, articles, taux_reduction: reductionGlobale } = req.body;

  if (!id_structure) {
    return res.status(400).json({ error: "L'identifiant de la structure est requis." });
  }
  if (!articles || articles.length === 0) {
    return res.status(400).json({ error: "Aucun article sélectionné pour la vente." });
  }

  // Détermination sécurisée du taux de réduction applicable reçu du client (ex: 12.5)
  const tauxReduction = Math.max(0, Math.min(100, parseFloat(reductionGlobale) || 0.00));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let totalSansReduction = 0;
    let totalPriseEnCharge = 0;
    let totalSommeVente = 0; // Reste à charge réel payé par le client à la caisse
    
    const detailsAInserer = [];

    for (const article of articles) {
      const { id_produit, quantite: quantiteDemandee } = article;
      let quantiteRestanteAEnlever = parseInt(quantiteDemandee, 10);

      if (isNaN(quantiteRestanteAEnlever) || quantiteRestanteAEnlever <= 0) {
        throw new Error(`Quantité invalide reçue pour le produit.`);
      }

      // 1. Récupérer le prix de vente public d'origine
      const prodRes = await client.query(
        "SELECT prix_vente_unitaire, nom FROM produits WHERE id_produit = $1 AND id_structure = $2",
        [id_produit, id_structure]
      );

      if (prodRes.rows.length === 0) {
        throw new Error(`Produit introuvable ou non autorisé.`);
      }

      const prixUnitaireBase = parseFloat(prodRes.rows[0].prix_vente_unitaire);
      const nomProduit = prodRes.rows[0].nom;

      // 2. Récupérer les lots par FEFO (Premier expiré, premier sorti)
      const lotsRes = await client.query(
        `SELECT id_lot, quantite_disponible 
         FROM lots_stock 
         WHERE id_produit = $1 AND id_structure = $2 AND quantite_disponible > 0 AND date_peremption >= CURRENT_DATE
         ORDER BY date_peremption ASC`,
        [id_produit, id_structure]
      );

      const stockTotalDisponible = lotsRes.rows.reduce((sum, row) => sum + parseInt(row.quantite_disponible, 10), 0);

      if (stockTotalDisponible < quantiteRestanteAEnlever) {
        throw new Error(`Stock insuffisant pour le produit : ${nomProduit}. Disponible: ${stockTotalDisponible}, Demandé: ${quantiteRestanteAEnlever}`);
      }

      // 3. Déstockage par lot et calculs financiers
      for (const lot of lotsRes.rows) {
        if (quantiteRestanteAEnlever <= 0) break;

        const lotQteDisponible = parseInt(lot.quantite_disponible, 10);
        const quantitePriseDansCeLot = Math.min(lotQteDisponible, quantiteRestanteAEnlever);
        
        await client.query(
          "UPDATE lots_stock SET quantite_disponible = quantite_disponible - $1 WHERE id_lot = $2",
          [quantitePriseDansCeLot, lot.id_lot]
        );

        // Calculs financiers pour la ligne de détail
        const montantLigneBrut = quantitePriseDansCeLot * prixUnitaireBase;
        const priseEnChargeLigne = montantLigneBrut * (tauxReduction / 100);
        const montantLigneApresReduction = montantLigneBrut - priseEnChargeLigne;
        const prixUnitaireVendu = prixUnitaireBase * (1 - tauxReduction / 100);

        detailsAInserer.push({
          id_produit,
          id_lot: lot.id_lot,
          quantite: quantitePriseDansCeLot,
          prix_unitaire_base: prixUnitaireBase,
          prix_unitaire_vendu: prixUnitaireVendu,
          taux_reduction: tauxReduction
        });

        // Cumulateurs globaux de la facture
        totalSansReduction += montantLigneBrut;
        totalPriseEnCharge += priseEnChargeLigne;
        totalSommeVente += montantLigneApresReduction;

        quantiteRestanteAEnlever -= quantitePriseDansCeLot;
      }
    }

    // 4. Insérer la Vente principale 
    const textVente = `
      INSERT INTO ventes (id_structure, id_utilisateur, total_somme, mode_paiement, total_sans_reduction, total_prise_en_charge) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
    
    const venteRes = await client.query(textVente, [
      id_structure, 
      id_utilisateur || null, 
      Math.round(totalSommeVente), // Arrondi propre pour la monnaie (FCFA)
      modePaiement || "ESPECES",
      Math.round(totalSansReduction), 
      Math.round(totalPriseEnCharge)
    ]);
    const nouvelleVente = venteRes.rows[0];

    // 5. Insérer les lignes de détails rattachées
    const textDetail = `
      INSERT INTO details_vente (id_vente, id_produit, id_lot, quantite, prix_unitaire_base, prix_unitaire_vendu, taux_reduction) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)`;
      
    for (const detail of detailsAInserer) {
      await client.query(textDetail, [
        nouvelleVente.id_vente, 
        detail.id_produit, 
        detail.id_lot, 
        detail.quantite, 
        detail.prix_unitaire_base,
        detail.prix_unitaire_vendu,
        detail.taux_reduction
      ]);
    }

    await client.query("COMMIT");
    
    // Notification WebSocket (Appel de votre fonction existante)
    if (typeof notifyRefresh === 'function') {
      notifyRefresh(req);
    }

    res.status(201).json({ 
      success: true, 
      message: "Vente validée et stock mis à jour avec succès.", 
      id_vente: nouvelleVente.id_vente,
      total_somme: nouvelleVente.total_somme,
      total_sans_reduction: nouvelleVente.total_sans_reduction,
      total_prise_en_charge: nouvelleVente.total_prise_en_charge,
      mode_paiement: nouvelleVente.mode_paiement,
      date_vente: nouvelleVente.date_vente
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erreur backend vente:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// --- 2. LIRE TOUTES LES VENTES DE LA STRUCTURE (GET ALL) ---
router.get("/", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  if (!id_structure) return res.status(400).json({ error: "L'identifiant de la structure est requis." });

  try {
    const query = `
      SELECT v.*, u.nom_utilisateur 
      FROM ventes v
      LEFT JOIN utilisateurs u ON v.id_utilisateur = u.id_utilisateur
      WHERE v.id_structure = $1 
      ORDER BY v.date_vente DESC`;
      
    const r = await pool.query(query, [id_structure]);
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET Ventes :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 3. LIRE LES LIGNES DE DÉTAILS D'UNE VENTE SPECIFIQUE ---
router.get("/details/:id_vente", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  const { id_vente } = req.params;

  if (!id_structure) {
    return res.status(400).json({ error: "L'identifiant de la structure est requis." });
  }

  try {
    const query = `
      SELECT 
        dv.id_detail_vente,
        dv.id_vente,
        dv.id_produit,
        dv.id_lot,
        dv.quantite,
        dv.prix_unitaire_base,
        dv.prix_unitaire_vendu,
        dv.taux_reduction,
        p.nom AS nom_produit
      FROM details_vente dv
      JOIN produits p ON dv.id_produit = p.id_produit
      JOIN ventes v ON dv.id_vente = v.id_vente
      WHERE dv.id_vente = $1 AND v.id_structure = $2`;

    const r = await pool.query(query, [id_vente, id_structure]);
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET details_vente :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 4. ANNULATION COMPLÈTE D'UNE VENTE (DELETE) ---
router.delete("/annuler/:id", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  const { id } = req.params;

  if (!id_structure) return res.status(400).json({ error: "L'identifiant de la structure est requis." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const checkVente = await client.query(
      "SELECT id_vente FROM ventes WHERE id_vente = $1 AND id_structure = $2", 
      [id, id_structure]
    );

    if (checkVente.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Vente introuvable ou accès non autorisé." });
    }

    const lignesRes = await client.query(
      "SELECT id_lot, quantite FROM details_vente WHERE id_vente = $1", 
      [id]
    );

    for (const ligne of lignesRes.rows) {
      if (ligne.id_lot) {
        await client.query(
          "UPDATE lots_stock SET quantite_disponible = quantite_disponible + $1 WHERE id_lot = $2",
          [ligne.quantite, ligne.id_lot]
        );
      }
    }

    await client.query("DELETE FROM ventes WHERE id_vente = $1 AND id_structure = $2", [id, id_structure]);

    await client.query("COMMIT");
    notifyRefresh(req);
    res.json({ success: true, message: "Vente annulée avec succès et stocks réajustés." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erreur Annulation Vente:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
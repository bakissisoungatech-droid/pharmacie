const router = require("express").Router();
const pool = require("../db");

// --- UTILITAIRE : NOTIFICATION TEMPS RÉEL ---
const notifyRefresh = (req) => {
  const io = req.app.get("socketio") || req.io;
  if (io) io.emit("refresh_data");
};

// --- 1. ENTRÉE EN STOCK / CRÉATION D'UN LOT (POST) ---
// Cette route ajoute du stock physique et écrit une ligne dans l'historique des mouvements
router.post("/", async (req, res) => {
  const { id_structure, id_produit, quantite_disponible, date_peremption, prix_achat_unitaire, id_utilisateur } = req.body;

  if (!id_structure || !id_produit || !quantite_disponible || !date_peremption) {
    return res.status(400).json({ error: "Les champs id_structure, id_produit, quantite_disponible et date_peremption sont obligatoires." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Insertion du nouveau lot (avec sa date de péremption unique)
    const lotRes = await client.query(
      `INSERT INTO lots_stock (id_structure, id_produit, quantite_disponible, date_peremption, prix_achat_unitaire)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id_structure, id_produit, quantite_disponible, date_peremption, prix_achat_unitaire || null]
    );
    const nouveauLot = lotRes.rows[0];

    // 2. Écriture automatique dans l'historique des mouvements (Traçabilité)
    await client.query(
      `INSERT INTO mouvements_stock (id_structure, id_produit, id_lot, id_utilisateur, type_mouvement, quantite, motif)
       VALUES ($1, $2, $3, $4, 'ENTREE', $5, 'Arrivage / Approvisionnement stock')`,
      [id_structure, id_produit, nouveauLot.id_lot, id_utilisateur || null, quantite_disponible]
    );

    await client.query("COMMIT");
    notifyRefresh(req);
    res.status(201).json(nouveauLot);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erreur DB POST Lot:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- 2. LIRE TOUS LES LOTS DISPONIBLES D'UN PRODUIT (GET ALL FOR ONE PRODUCT) ---
// Utile pour voir le détail des dates de péremption d'un médicament précis
router.get("/produit/:id_produit", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  const { id_produit } = req.params;

  if (!id_structure) return res.status(400).json({ error: "L'identifiant de la structure est requis." });

  try {
    const query = `
      SELECT id_lot, quantite_disponible, date_peremption, prix_achat_unitaire, date_entree
      FROM lots_stock
      WHERE id_produit = $1 AND id_structure = $2 AND quantite_disponible > 0 AND date_peremption >= CURRENT_DATE
      ORDER BY date_peremption ASC`;

    const r = await pool.query(query, [id_produit, id_structure]);
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET Lots Produit :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 3. ALERTE : LIRE LES LOTS PÉRIMÉS OU BIENTÔT PÉRIMÉS (GET PEREMPTIONS) ---
// Récupère les lots qui expirent dans les 3 prochains mois (90 jours) ou déjà périmés
router.get("/alertes-peremption", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  if (!id_structure) return res.status(400).json({ error: "L'identifiant de la structure est requis." });

  try {
    const query = `
      SELECT 
        l.id_lot, 
        p.nom AS nom_produit, 
        l.quantite_disponible, 
        l.date_peremption,
        (l.date_peremption - CURRENT_DATE) AS jours_restants
      FROM lots_stock l
      JOIN produits p ON l.id_produit = p.id_produit
      WHERE l.id_structure = $1 AND l.quantite_disponible > 0 AND l.date_peremption <= CURRENT_DATE + INTERVAL '90 days'
      ORDER BY l.date_peremption ASC`;

    const r = await pool.query(query, [id_structure]);
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET Alertes Périscolaires :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 4. RETRAIT MANUEL D'UN LOT PÉRIMÉ (POST SORTIE MANUELLE) ---
// Si un lot est périmé, le pharmacien doit pouvoir le jeter (le passer à 0) proprement
router.post("/retrait-perime/:id_lot", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  const { id_lot } = req.params;
  const { id_utilisateur, motif } = req.body;

  if (!id_structure) return res.status(400).json({ error: "L'identifiant de la structure est requis." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Vérifier l'existence du lot et récupérer sa quantité actuelle
    const lotRes = await client.query(
      "SELECT id_produit, quantite_disponible FROM lots_stock WHERE id_lot = $1 AND id_structure = $2",
      [id_lot, id_structure]
    );

    if (lotRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Lot introuvable ou accès non autorisé." });
    }

    const { id_produit, quantite_disponible } = lotRes.rows[0];

    if (quantite_disponible === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Ce lot est déjà vide." });
    }

    // 1. Mettre à 0 la quantité disponible du lot périmé
    await client.query(
      "UPDATE lots_stock SET quantite_disponible = 0 WHERE id_lot = $1",
      [id_lot]
    );

    // 2. Écrire le mouvement de sortie dans l'historique
    await client.query(
      `INSERT INTO mouvements_stock (id_structure, id_produit, id_lot, id_utilisateur, type_mouvement, quantite, motif)
       VALUES ($1, $2, $3, $4, 'SORTIE_PERIME', $5, $6)`,
      [id_structure, id_produit, id_lot, id_utilisateur || null, quantite_disponible, motif || "Retrait produit périmé"]
    );

    await client.query("COMMIT");
    notifyRefresh(req);
    res.json({ success: true, message: "Lot retiré du stock avec succès (quantité passée à 0)." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erreur Retrait Lot Périmé:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- 5. SUPPRESSION DÉFINITIVE D'UN LOT DE LA BDD (HARD DELETE) ---
router.delete("/:id_lot", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  const { id_lot } = req.params;

  if (!id_structure) {
    return res.status(400).json({ error: "L'identifiant de la structure est requis." });
  }

  try {
    const query = "DELETE FROM lots_stock WHERE id_lot = $1 AND id_structure = $2 RETURNING *";
    const result = await pool.query(query, [id_lot, id_structure]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Lot introuvable ou non autorisé." });
    }

    notifyRefresh(req);
    res.json({ success: true, message: "Lot supprimé définitivement de la base de données." });
  } catch (err) {
    console.error("Erreur HARD DELETE Lot :", err.message);
    // Erreur fréquente si des clés étrangères pointent vers ce lot (ex: mouvements_stock)
    res.status(500).json({ error: "Impossible de supprimer ce lot car il est lié à d'autres enregistrements." });
  }
});

module.exports = router;
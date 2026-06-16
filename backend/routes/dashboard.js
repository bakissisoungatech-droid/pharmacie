const router = require("express").Router();
const pool = require("../db");


router.get("/entrees", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  const { startDate, endDate } = req.query;

  if (!id_structure) {
    return res.status(400).json({ error: "L'identifiant de la structure est requis." });
  }

  try {
    // 1. Base de la requête SQL (Jointure identique à l'esprit de /stats)
    let query = `
      SELECT 
        l.id_lot,
        l.quantite_disponible,
        l.date_peremption,
        l.date_entree,
        p.nom AS nom_produit,
        p.prix_vente_unitaire
      FROM lots_stock l
      JOIN produits p ON l.id_produit = p.id_produit
      WHERE p.id_structure = $1
    `;
    let params = [id_structure];

    // 2. Copie conforme de la logique de filtrage des dates de /stats
    if (startDate && endDate) {
      query += ` AND l.date_entree::date BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    } else {
      // Si le dashboard se charge sans filtres, on prend les entrées du jour comme pour le CA
      query += ` AND l.date_entree::date = CURRENT_DATE`;
    }

    // 3. Tri identique pour avoir les dernières nouveautés en premier
    query += ` ORDER BY l.date_entree DESC`;

    const result = await pool.query(query, params);
    
    // On renvoie directement le tableau des lignes au front
    res.json(result.rows);

  } catch (err) {
    console.error("Erreur GET Entrees Produits:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  const { startDate, endDate } = req.query;

  if (!id_structure) {
    return res.status(400).json({ error: "L'identifiant de la structure est requis." });
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Chiffre d'affaires Global et Séparation des Flux (Recettes vs À Recouvrer)
    // -------------------------------------------------------------------------
    let caQuery = `
      SELECT 
        COALESCE(SUM(total_sans_reduction), 0) AS ca_global,
        COALESCE(SUM(total_prise_en_charge), 0) AS ca_tiers_a_recouvrer, -- Ce que les sociétés doivent payer
        COALESCE(SUM(total_somme), 0) AS ca_direct_caisse            -- Ce que les patients payent réellement
      FROM ventes 
      WHERE id_structure = $1
    `;
    let caParams = [id_structure];

    if (startDate && endDate) {
      caQuery += ` AND date_vente::date BETWEEN $2 AND $3`;
      caParams.push(startDate, endDate);
    } else {
      caQuery += ` AND date_vente::date = CURRENT_DATE`;
    }
    const caRes = await pool.query(caQuery, caParams);

    // -------------------------------------------------------------------------
    // 1.B : Liste détaillée des articles vendus pour la modale
    // -------------------------------------------------------------------------
    let detailVentesQuery = `
      SELECT 
        v.date_vente, 
        v.mode_paiement, 
        dv.quantite, 
        dv.prix_unitaire_base,
        dv.prix_unitaire_vendu, 
        (dv.quantite * dv.prix_unitaire_base) AS total_brut_article,
        (dv.quantite * dv.prix_unitaire_vendu) AS total_net_patient,
        p.nom AS nom_produit
      FROM details_vente dv
      JOIN ventes v ON dv.id_vente = v.id_vente
      JOIN produits p ON dv.id_produit = p.id_produit
      WHERE v.id_structure = $1
    `;
    let detailVentesParams = [id_structure];

    if (startDate && endDate) {
      detailVentesQuery += ` AND v.date_vente::date BETWEEN $2 AND $3`;
      detailVentesParams.push(startDate, endDate);
    } else {
      detailVentesQuery += ` AND v.date_vente::date = CURRENT_DATE`;
    }
    detailVentesQuery += ` ORDER BY v.date_vente DESC`;
    const listeVentesDetailsRes = await pool.query(detailVentesQuery, detailVentesParams);

    // -------------------------------------------------------------------------
    // 2. Ruptures de stock
    // -------------------------------------------------------------------------
    const listeRupturesRes = await pool.query(
      `SELECT p.nom 
       FROM produits p
       LEFT JOIN lots_stock l ON p.id_produit = l.id_produit AND l.date_peremption >= CURRENT_DATE
       WHERE p.id_structure = $1
       GROUP BY p.id_produit, p.nom
       HAVING COALESCE(SUM(l.quantite_disponible), 0) = 0`,
      [id_structure]
    );

    // -------------------------------------------------------------------------
    // 3. Lots critiques (CORRIGÉ : liaison par p.id_structure via la table produits)
    // -------------------------------------------------------------------------
    const EastonCritiquesRes = await pool.query(
      `SELECT l.id_lot, l.quantite_disponible, l.date_peremption, p.nom AS nom_produit
       FROM lots_stock l
       JOIN produits p ON l.id_produit = p.id_produit
       WHERE p.id_structure = $1 
         AND l.quantite_disponible > 0 
         AND l.date_peremption <= CURRENT_DATE + INTERVAL '30 days'
       ORDER BY l.date_peremption ASC`,
      [id_structure]
    );

    // -------------------------------------------------------------------------
    // 4. Évolution du CA Global (sur 7 jours glissants)
    // -------------------------------------------------------------------------
    let evoQuery = `
      SELECT 
        jours.date AS date_vente,
        COALESCE(SUM(v.total_sans_reduction), 0) AS total_ventes_brut,
        COALESCE(SUM(v.total_somme), 0) AS total_ventes_net_patient
      FROM (
        SELECT generate_series(($2::date - INTERVAL '6 days')::date, $2::date, '1 day')::date AS date
      ) jours
      LEFT JOIN ventes v ON v.date_vente::date = jours.date AND v.id_structure = $1
      GROUP BY jours.date
      ORDER BY jours.date ASC
    `;
    
    const targetEndDate = endDate || new Date().toISOString().split('T')[0];
    const evolutionCaRes = await pool.query(evoQuery, [id_structure, targetEndDate]);

    // -------------------------------------------------------------------------
    // 5. Top 5 des médicaments les plus vendus
    // -------------------------------------------------------------------------
    const topVentesRes = await pool.query(
      `SELECT p.nom, COALESCE(SUM(dv.quantite), 0)::int AS quantite_vendue
       FROM details_vente dv
       JOIN produits p ON dv.id_produit = p.id_produit
       JOIN ventes v ON dv.id_vente = v.id_vente
       WHERE v.id_structure = $1
       GROUP BY p.id_produit, p.nom
       ORDER BY quantite_vendue DESC
       LIMIT 5`,
      [id_structure]
    );

    // -------------------------------------------------------------------------
    // Retour de la réponse structurée au client frontend
    // -------------------------------------------------------------------------
    const rowStats = caRes.rows[0];
    res.json({
      indicateurs: {
        ca_global: parseFloat(rowStats.ca_global),
        ca_prise_en_charge: parseFloat(rowStats.ca_tiers_a_recouvrer), // Pour "À Recouvrer (Tiers)"
        ca_patient_recette: parseFloat(rowStats.ca_direct_caisse),     // Pour "Recettes Directes En Caisse"
        produits_rupture: listeRupturesRes.rowCount,
        lots_critiques: EastonCritiquesRes.rowCount                    // Compte exact reçu de la ligne corrigée
      },
      liste_ventes_details: listeVentesDetailsRes.rows,
      liste_ruptures: listeRupturesRes.rows,
      liste_critiques: EastonCritiquesRes.rows,                       // Liste envoyée au Front
      evolution_ca: evolutionCaRes.rows,
      top_ventes: topVentesRes.rows
    });

  } catch (err) {
    console.error("Erreur GET Dashboard Stats:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
const express = require("express");
const router = express.Router();
const pool = require("../db"); // Votre configuration de base de données

router.get("/rechercher-produit", async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim() === "") {
    return res.status(400).json({ error: "Le terme de recherche est requis." });
  }

  try {
    const searchQuery = `%${q.trim()}%`;

    const query = `
      SELECT 
        p.id_structure,
        s.nom AS nom_structure,
        s.telephone AS telephone_structure,
        s.adresse AS adresse_structure,
        p.id_produit,
        p.nom AS nom_produit,
        p.prix_vente_unitaire,
        SUM(l.quantite_disponible)::int AS stock_total,
        json_agg(
          json_build_object(
            'id_lot', l.id_lot,
            'quantite', l.quantite_disponible,
            'date_peremption', l.date_peremption
          ) ORDER BY l.date_peremption ASC
        ) AS lots
      FROM produits p
      INNER JOIN lots_stock l ON p.id_produit = l.id_produit AND p.id_structure = l.id_structure
      INNER JOIN structures s ON p.id_structure = s.id_structure
      WHERE p.nom ILIKE $1
        AND l.quantite_disponible > 0
        AND l.date_peremption >= CURRENT_DATE
      -- AJOUT de s.adresse ici pour valider la requête Postgres
      GROUP BY p.id_structure, s.nom, s.telephone, s.adresse, p.id_produit, p.nom, p.prix_vente_unitaire
      ORDER BY p.nom ASC, stock_total DESC`;
      
    const r = await pool.query(query, [searchQuery]);
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET Recherche Globale :", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
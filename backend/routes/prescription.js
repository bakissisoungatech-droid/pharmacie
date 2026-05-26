const express = require("express");
const router = express.Router();
const pool = require("../db");


router.get("/catalog", async (req, res) => {
  const { q } = req.query; // Le mot-clé tapé par le médecin
  try {
    let queryText = "SELECT * FROM examen_universel ORDER BY nom ASC LIMIT 50";
    let params = [];
    
    if (q) {
      queryText = "SELECT * FROM examen_universel WHERE LOWER(nom) LIKE LOWER($1) OR LOWER(categorie) LIKE LOWER($1) ORDER BY nom ASC LIMIT 50";
      params = [`%${q}%`];
    }
    
    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la recherche dans le catalogue" });
  }
});

// Récupérer la liste des prescriptions en cours
router.get("/", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT pr.*, p.nom, p.prenom 
      FROM prescription_examen pr
      JOIN patient p ON pr.id_patient = p.id_patient
      WHERE p.est_actif = true
      ORDER BY pr.date_prescription DESC;
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Récupérer les détails (les examens) d'une prescription précise
router.get("/lignes/:id", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        el.*, 
        eu.nom AS nom_examen, 
        eu.categorie,
        p.id_patient,                 -- 👈 Déjà présent
        p.medecin                     -- ➕ AJOUT : On récupère le nom du médecin de la table parente
      FROM prescription_examen_ligne el
      JOIN examen_universel eu ON el.id_examen_univ = eu.id_examen_univ
      JOIN prescription_examen p ON el.id_prescription = p.id_prescription 
      WHERE el.id_prescription = $1
    `, [req.params.id]);
    
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des lignes" });
  }
});

// Créer une nouvelle prescription médicale
router.post("/post", async (req, res) => {
  const { id_patient, medecin, examens, interpretation } = req.body; // interpretation mappé sur motif_notes
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resP = await client.query(
      `INSERT INTO prescription_examen (id_patient, medecin, motif_notes) 
       VALUES ($1, $2, $3) RETURNING id_prescription`,
      [id_patient, medecin, interpretation || "Non renseigné"]
    );
    const id_prescription = resP.rows[0].id_prescription;

    if (examens && examens.length > 0) {
      for (const id_ex of examens) {
        await client.query(
          `INSERT INTO prescription_examen_ligne (id_prescription, id_examen_univ) VALUES ($1, $2)`,
          [id_prescription, id_ex]
        );
      }
    } 

    await client.query('COMMIT');
    res.json({ success: true, id_prescription });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Mettre à jour une prescription médicale
router.put("/update/:id", async (req, res) => {
  const { id } = req.params; 
  const { medecin, examens, interpretation } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "UPDATE prescription_examen SET medecin = $1, motif_notes = $2 WHERE id_prescription = $3", 
      [medecin, interpretation, id]
    );
    
    await client.query("DELETE FROM prescription_examen_ligne WHERE id_prescription = $1", [id]);

    if (examens && examens.length > 0) {
      for (const id_ex of examens) {
        await client.query(
          "INSERT INTO prescription_examen_ligne (id_prescription, id_examen_univ) VALUES ($1, $2)",
          [id, id_ex]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM prescription_examen WHERE id_prescription = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// ============================================================================
// ROUTES CRUD POUR LE CATALOGUE D'EXAMENS (examen_universel)
// ============================================================================

// 1. LIRE TOUS LES EXAMENS (avec pagination ou recherche optionnelle)
router.get("/examens-catalogue", async (req, res) => {
  const { search } = req.query;
  try {
    let queryText = "SELECT * FROM examen_universel";
    let params = [];

    if (search) {
      queryText += " WHERE LOWER(nom) LIKE LOWER($1) OR LOWER(categorie) LIKE LOWER($1)";
      params = [`%${search}%`];
    }
    
    queryText += " ORDER BY categorie ASC, nom ASC";
    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la récupération du catalogue" });
  }
});

// 2. CRÉER UN NOUVEL EXAMEN
router.post("/examens-catalogue/post", async (req, res) => {
  const { nom, categorie } = req.body;
  if (!nom || !categorie) {
    return res.status(400).json({ error: "Le nom et la catégorie sont requis." });
  }
  try {
    const result = await pool.query(
      "INSERT INTO examen_universel (nom, categorie) VALUES ($1, $2) RETURNING *",
      [nom, categorie]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de l'ajout de l'examen" });
  }
});

// 3. METTRE À JOUR UN EXAMEN
router.put("/examens-catalogue/:id", async (req, res) => {
  const { id } = req.params;
  const { nom, categorie } = req.body;
  try {
    const result = await pool.query(
      "UPDATE examen_universel SET nom = $1, categorie = $2 WHERE id_examen_univ = $3 RETURNING *",
      [nom, categorie, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Examen non trouvé." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// 4. SUPPRIMER UN EXAMEN
router.delete("/examens-catalogue/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Note: Si l'examen est lié à des prescriptions, PostgreSQL bloquera la suppression 
    // grâce au ON DELETE RESTRICT qu'on a configuré pour protéger l'historique médical.
    await pool.query("DELETE FROM examen_universel WHERE id_examen_univ = $1", [id]);
    res.json({ success: true, message: "Examen supprimé du catalogue" });
  } catch (err) {
    res.status(500).json({ 
      error: "Impossible de supprimer cet examen car il est déjà utilisé dans des prescriptions médicales." 
    });
  }
});

module.exports = router;
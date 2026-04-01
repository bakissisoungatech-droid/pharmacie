const router = require("express").Router();
const pool = require("../db");

// --- CRÉATION ---
router.post("/post", async (req, res) => {
  // Ajout de prix et resultat dans la déstructuration
  const { nom_examen, categorie, parametre, valeurs_defaut, sous_categories, examens_inclus, prix, resultat } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insertion avec les nouvelles colonnes
    const newExamen = await client.query(
      `INSERT INTO examen(nom_examen, categorie, parametre, valeurs_defaut, sous_categories, prix, resultat) 
       VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nom_examen, categorie, parametre, valeurs_defaut, sous_categories, prix, resultat]
    );

    const id_nouveau = newExamen.rows[0].id_examen;

    // Logique Bilan
    if (categorie === 'BILAN' && Array.isArray(examens_inclus)) {
      for (let id_affilie of examens_inclus) {
        // Note: Si votre table bilan_composition a aussi une colonne prix, 
        // vous pouvez l'ajouter ici si nécessaire, sinon on utilise le prix global du bilan.
        await client.query(
          `INSERT INTO bilan_composition (id_bilan, id_examen_affilie) VALUES ($1, $2)`,
          [id_nouveau, id_affilie]
        );
      }
    }

    await client.query('COMMIT');
    res.json(newExamen.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- MISE À JOUR ---
router.put("/:id", async (req, res) => {
  const { nom_examen, categorie, parametre, valeurs_defaut, sous_categories, examens_inclus, prix, resultat } = req.body;
  const id_examen = req.params.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const r = await client.query(
      `UPDATE examen SET nom_examen=$1, categorie=$2, valeurs_defaut=$3, parametre=$4, sous_categories=$5, prix=$6, resultat=$7 
       WHERE id_examen=$8 RETURNING *`,
      [nom_examen, categorie, valeurs_defaut, parametre, sous_categories, prix, resultat, id_examen]
    );

    if (categorie === 'BILAN') {
      await client.query(`DELETE FROM bilan_composition WHERE id_bilan = $1`, [id_examen]);
      if (Array.isArray(examens_inclus)) {
        for (let id_affilie of examens_inclus) {
          await client.query(
            `INSERT INTO bilan_composition (id_bilan, id_examen_affilie) VALUES ($1, $2)`,
            [id_examen, id_affilie]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json(r.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- LIRE UN BILAN ET SES EXAMENS ---
// Utile pour la partie Saisie de résultats
router.get("/bilan/:id", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT e.* FROM examen e
      JOIN bilan_composition bc ON e.id_examen = bc.id_examen_affilie
      WHERE bc.id_bilan = $1
      ORDER BY e.categorie ASC`, 
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ ALL
router.get("/", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM examen ORDER BY categorie ASC, nom_examen ASC");
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//delete
// --- 1. ARCHIVAGE (Désactivation) ---
router.patch("/archive/:id", async (req, res) => {
  try {
    await pool.query(`UPDATE examen SET est_actif = false WHERE id_examen = $1`, [req.params.id]);
    res.json({ success: true, message: "Examen archivé (masqué)" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 2. PURGE DÉFINITIVE ---
router.delete("/full-delete/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const examenId = req.params.id;

    // A. Supprimer les valeurs de résultats liées à cet examen
    await client.query(`
      DELETE FROM resultat_valeur WHERE id_resultat IN (
        SELECT re.id_resultat FROM resultat_examen re
        JOIN demande_examen_ligne del ON re.id_ligne = del.id_ligne
        WHERE del.id_examen = $1
      )`, [examenId]);

    // B. Supprimer les entrées de la table pivot résultats
    await client.query(`
      DELETE FROM resultat_examen WHERE id_ligne IN (
        SELECT id_ligne FROM demande_examen_ligne WHERE id_examen = $1
      )`, [examenId]);

    // C. Supprimer les lignes de demandes qui utilisent cet examen
    await client.query(`DELETE FROM demande_examen_ligne WHERE id_examen = $1`, [examenId]);

    // D. Enfin, supprimer l'examen de la liste
    const result = await client.query(`DELETE FROM examen WHERE id_examen = $1`, [examenId]);

    if (result.rowCount === 0) throw new Error("Examen non trouvé");

    await client.query('COMMIT');
    res.json({ success: true, message: "Examen et historique supprimés" });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: "Erreur lors de la purge : " + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
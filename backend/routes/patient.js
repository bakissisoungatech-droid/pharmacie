const router = require("express").Router();
const pool = require("../db");

 
// --- CRÉATION (POST) ---
router.post("/post", async (req, res) => {
  const { nom, prenom, sexe, telephone, abonne, consultation } = req.body;
  try {
    const r = await pool.query(`
      INSERT INTO patient(nom, prenom, sexe, telephone, abonne, consultation)
      VALUES($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      nom,
      prenom || 'Non renseigné',
      sexe || 'Non précisé',
      telephone || '00000000',
      abonne || 'non',
      consultation || 'Généraliste' // Valeur par défaut si vide
    ]);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MISE À JOUR (PUT) ---
router.put("/:id", async (req, res) => {
  const { nom, prenom, sexe, telephone, abonne, consultation } = req.body;
  try {
    const r = await pool.query(`
      UPDATE patient
      SET nom=$1,
          prenom=$2,
          sexe=$3,
          telephone=$4,
          abonne=$5,
          consultation=$6  -- Virgule supprimée ici
      WHERE id_patient=$7
      RETURNING *
    `, [
      nom,
      prenom,
      sexe,
      telephone,
      abonne || 'non',
      consultation || 'Non renseigné',
      req.params.id
    ]);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// READ ALL
router.get("/", async (req, res) => {
  const r = await pool.query(`SELECT * FROM patient ORDER BY date_creation DESC`);
  res.json(r.rows);
});

/// READ ONE
router.get("/:id", async (req, res) => {
  const r = await pool.query(`SELECT * FROM patient WHERE id_patient=$1`, [req.params.id]);
  res.json(r.rows[0]);
});

/// UPDATE


/// DELETE
// --- 1. SUPPRESSION ADMINISTRATIVE (Archivage) ---
// On ne supprime rien, on change juste un statut (ex: actif = false)
router.patch("/archive/:id", async (req, res) => {
  try {
    await pool.query(`UPDATE patient SET est_actif = false WHERE id_patient = $1`, [req.params.id]);
    res.json({ success: true, message: "Patient archivé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 2. SUPPRESSION DÉFINITIVE (Nettoyage complet) ---
// On utilise une transaction pour supprimer les résultats, les lignes, les demandes, puis le patient.
router.delete("/full-delete/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const patientId = req.params.id;

    // 1. Supprimer les résultats spécifiques (Bactério, Séro, Valeurs)
    // On remonte depuis le patient jusqu'aux résultats
    await client.query(`
      DELETE FROM resultat_valeur WHERE id_resultat IN (
        SELECT re.id_resultat FROM resultat_examen re
        JOIN demande_examen_ligne del ON re.id_ligne = del.id_ligne
        JOIN demande_examen de ON del.id_demande = de.id_demande
        WHERE de.id_patient = $1
      )`, [patientId]);

    // 2. Supprimer les entrées dans la table pivot des résultats
    await client.query(`
      DELETE FROM resultat_examen WHERE id_ligne IN (
        SELECT id_ligne FROM demande_examen_ligne del
        JOIN demande_examen de ON del.id_demande = de.id_demande
        WHERE de.id_patient = $1
      )`, [patientId]);

    // 3. Supprimer les lignes de la demande
    await client.query(`
      DELETE FROM demande_examen_ligne WHERE id_demande IN (
        SELECT id_demande FROM demande_examen WHERE id_patient = $1
      )`, [patientId]);

    // 4. Supprimer la demande elle-même
    await client.query(`DELETE FROM demande_examen WHERE id_patient = $1`, [patientId]);

    // 5. Enfin, supprimer le patient
    const result = await client.query(`DELETE FROM patient WHERE id_patient = $1`, [patientId]);

    if (result.rowCount === 0) {
      throw new Error("Patient non trouvé");
    }

    await client.query('COMMIT');
    res.json({ success: true, message: "Purger avec succès" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("ERREUR CRITIQUE DÉLÉTION:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;


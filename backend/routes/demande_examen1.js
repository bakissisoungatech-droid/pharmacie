const router = require("express").Router();
const pool = require("../db");

// 1. LIRE LES DEMANDES ACTIVES
router.get("/", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT d.*, p.nom, p.prenom 
      FROM demande_examen d
      JOIN patient p ON d.id_patient = p.id_patient
      WHERE d.statut IN ('en_attente')
      ORDER BY d.date_demande DESC
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 2. VALIDER ET ARCHIVER
router.put("/valider/:id", async (req, res) => {
  const { interpretation } = req.body;
  try {
    await pool.query(
      "UPDATE demande_examen SET interpretation = $1, statut = 'validé' WHERE id_demande = $2",
      [interpretation, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur validation" });
  }
});

// 3. ENREGISTRER (Transactionnelle)
router.post("/post", async (req, res) => {
  const { id_patient, medecin, examens, constantes, interpretation } = req.body; 
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Créer la demande
    const resD = await client.query(
      `INSERT INTO demande_examen (id_patient, medecin, interpretation, statut) 
       VALUES ($1, $2, $3, 'en_attente') RETURNING id_demande`,
      [id_patient, medecin, interpretation || "Non renseigné"]
    );
    
    const id_demande = resD.rows[0].id_demande;

    // 2. Insérer chaque examen avec son prix actuel (Photographie du prix)
    if (examens && examens.length > 0) {
      for (const id_ex of examens) {
        // Cette requête insère l'id_demande et va chercher le prix dans la table examen
        await client.query(
          `INSERT INTO demande_examen_ligne (id_demande, id_examen, prix_applique) 
           SELECT $1, id_examen, prix FROM examen WHERE id_examen = $2`,
          [id_demande, id_ex]
        );
      }
    } else {
      throw new Error("Aucun examen n'a été sélectionné.");
    }

    await client.query('COMMIT');
    res.json({ success: true, id_demande });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("ERREUR:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 3. ENREGISTRER (Transactionnelle)
router.post("/post1", async (req, res) => {
  const { id_patient, medecin, examens, constantes, interpretation } = req.body; 
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Créer la demande
    const resD = await client.query(
      `INSERT INTO demande_examen (id_patient, medecin, interpretation, statut) 
       VALUES ($1, $2, $3, 'validé') RETURNING id_demande`,
      [id_patient, medecin, interpretation || "Non renseigné"]
    );
    
    const id_demande = resD.rows[0].id_demande;

    // 2. Insérer chaque examen avec son prix actuel (Photographie du prix)
    if (examens && examens.length > 0) {
      for (const id_ex of examens) {
        // Cette requête insère l'id_demande et va chercher le prix dans la table examen
        await client.query(
          `INSERT INTO demande_examen_ligne (id_demande, id_examen, prix_applique) 
           SELECT $1, id_examen, prix FROM examen WHERE id_examen = $2`,
          [id_demande, id_ex]
        );
      }
    } else {
      throw new Error("Aucun examen n'a été sélectionné.");
    }

    await client.query('COMMIT');
    res.json({ success: true, id_demande });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("ERREUR:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


// 4. SUPPRIMER (Gère la contrainte de clé étrangère manuellement)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Supprimer les valeurs des résultats liés à cette demande
    await client.query(`
      DELETE FROM resultat_valeur 
      WHERE id_resultat IN (
        SELECT re.id_resultat FROM resultat_examen re
        JOIN demande_examen_ligne del ON re.id_ligne = del.id_ligne
        WHERE del.id_demande = $1
      )`, [id]);

    // 2. Supprimer les résultats eux-mêmes
    await client.query(`
      DELETE FROM resultat_examen 
      WHERE id_ligne IN (SELECT id_ligne FROM demande_examen_ligne WHERE id_demande = $1)
    `, [id]);

    // 3. Supprimer les lignes d'examens
    await client.query("DELETE FROM demande_examen_ligne WHERE id_demande = $1", [id]);

    // 4. Supprimer la demande parente
    await client.query("DELETE FROM demande_examen WHERE id_demande = $1", [id]);

    await client.query('COMMIT');
    res.json({ message: "Demande et toutes les données associées supprimées" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la suppression en cascade" });
  } finally { client.release(); }
});

// 5. UPDATE
router.put("/update/:id", async (req, res) => {
    const { medecin, examens, interpretation } = req.body; // On récupère les données du front
    const id_demande = req.params.id;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Correction de la requête : On force le statut à 'en_attente'
        // On ajoute aussi l'interprétation pour qu'elle soit sauvegardée
        await client.query(
            `UPDATE demande_examen 
             SET medecin = $1, 
                 statut = 'en_attente', 
                 interpretation = $2 
             WHERE id_demande = $3`, 
            [medecin, interpretation, id_demande]
        );

        // Nettoyage et réinsertion des examens
        await client.query("DELETE FROM demande_examen_ligne WHERE id_demande = $1", [id_demande]);
        
        if (examens && examens.length > 0) {
            for (let id_ex of examens) {
                await client.query(
                    "INSERT INTO demande_examen_ligne (id_demande, id_examen) VALUES ($1, $2)", 
                    [id_demande, id_ex]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Statut mis à jour en attente" });
        } catch (err) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    });

// 6. LIGNES
router.get("/lignes/:id_demande", async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT l.*, e.nom_examen, e.categorie
        FROM demande_examen_ligne l
        JOIN examen e ON l.id_examen = e.id_examen
        WHERE l.id_demande = $1`, [req.params.id_demande]);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. LIRE LES DEMANDES ACTIVES
router.get("/affiches", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT d.*, p.nom, p.prenom, 
        (SELECT SUM(prix_applique) FROM demande_examen_ligne WHERE id_demande = d.id_demande) as total
      FROM demande_examen d
      JOIN patient p ON d.id_patient = p.id_patient
      WHERE d.statut IN ('validé')
      ORDER BY d.date_demande DESC
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
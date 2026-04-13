const router = require("express").Router();
const pool = require("../db");

// --- UTILITAIRE : NOTIFICATION TEMPS RÉEL ---
const notifyRefresh = (req) => {
  const io = req.app.get("socketio");
  if (io) io.emit("refresh_data");
};

// --- 1. EXAMENS EN ATTENTE ---
router.get("/en_attente", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        l.id_ligne, d.id_demande, d.date_demande, p.nom, p.prenom,
        COALESCE(e_affilie.nom_examen, e.nom_examen) AS nom_examen,
        COALESCE(e_affilie.id_examen, e.id_examen) AS id_examen_reel,
        COALESCE(e_affilie.categorie, e.categorie) AS categorie,
        COALESCE(e_affilie.parametre, e.parametre) AS parametre,
        COALESCE(e_affilie.valeurs_defaut, e.valeurs_defaut) AS valeurs_defaut
      FROM demande_examen_ligne l
      JOIN demande_examen d ON l.id_demande = d.id_demande
      JOIN patient p ON d.id_patient = p.id_patient
      JOIN examen e ON l.id_examen = e.id_examen
      LEFT JOIN bilan_composition bc ON e.id_examen = bc.id_bilan
      LEFT JOIN examen e_affilie ON bc.id_examen_affilie = e_affilie.id_examen
      LEFT JOIN resultat_examen re ON (re.id_ligne = l.id_ligne AND re.id_examen = COALESCE(e_affilie.id_examen, e.id_examen))
      WHERE re.id_resultat IS NULL AND d.statut = 'validé'
      ORDER BY d.date_demande DESC, p.nom ASC
    `);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 2. RÉCUPÉRER LES DÉTAILS D'UN RÉSULTAT (CRUCIAL POUR LA MODIFICATION) ---
router.get("/details/:id_resultat", async (req, res) => {
  try {
    const { id_resultat } = req.params;
    
    // On vérifie d'abord si c'est de la biochimie
    const bio = await pool.query("SELECT * FROM resultat_biochimie WHERE id_resultat = $1", [id_resultat]);
    if (bio.rows.length > 0) return res.json({ type: "BIOCHIMIE", data: bio.rows });

    // Sinon on cherche en sérologie
    const sero = await pool.query("SELECT * FROM resultat_serologie WHERE id_resultat = $1", [id_resultat]);
    res.json({ type: "SEROLOGIE", data: sero.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 3. ENREGISTREMENT (POST) ---
router.post("/", async (req, res) => {
  const { id_ligne, id_examen_reel, valide_par, categorie, parametres, seroData } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resRes = await client.query(
      `INSERT INTO resultat_examen (id_ligne, id_examen, valide_par, statut) VALUES ($1, $2, $3, 'termine') RETURNING id_resultat`,
      [id_ligne, id_examen_reel, valide_par]
    );
    const id_resultat = resRes.rows[0].id_resultat;
    const cat = (categorie || "").toUpperCase();

    if (cat.includes("BIOCHIMIE")) {
      for (let p of parametres) {
        await client.query(
          `INSERT INTO resultat_biochimie (id_resultat, nom_parametre, resultat, valeur, interpretation) VALUES ($1, $2, $3, $4, $5)`,
          [id_resultat, p.parametre, p.resultat, p.valeur, p.interpretation || null]
        );
      }
    } else if (cat.includes("SEROLOGIE")) {
      await client.query(
        `INSERT INTO resultat_serologie (id_resultat, resultat, titre, valeur, interpretation) VALUES ($1, $2, $3, $4, $5)`,
        [id_resultat, seroData.resultat, seroData.titre, seroData.valeur, seroData.interpretation || null]
      );
    }
    await client.query('COMMIT');
    notifyRefresh(req);
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// --- 4. MODIFICATION (PUT) ---
router.put("/:id_resultat", async (req, res) => {
  const { id_resultat } = req.params;
  const { categorie, parametres, seroData, valide_par } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE resultat_examen SET valide_par = $1, date_resultat = CURRENT_TIMESTAMP WHERE id_resultat = $2`, [valide_par, id_resultat]);
    
    if (categorie.toUpperCase().includes("BIOCHIMIE")) {
      await client.query(`DELETE FROM resultat_biochimie WHERE id_resultat = $1`, [id_resultat]);
      for (let p of parametres) {
        await client.query(`INSERT INTO resultat_biochimie (id_resultat, nom_parametre, resultat, valeur) VALUES ($1, $2, $3, $4)`, [id_resultat, p.nom_parametre || p.parametre, p.resultat, p.valeur]);
      }
    } else {
      await client.query(`UPDATE resultat_serologie SET resultat=$1, titre=$2, valeur=$3 WHERE id_resultat=$4`, [seroData.resultat, seroData.titre, seroData.valeur, id_resultat]);
    }
    await client.query('COMMIT');
    notifyRefresh(req);
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); } finally { client.release(); }
});

// --- 5. SUPPRESSION & HISTORIQUE (Déjà présents dans ton code) ---
router.delete("/:id_resultat", async (req, res) => {
  try {
    await pool.query("DELETE FROM resultat_examen WHERE id_resultat = $1", [req.params.id_resultat]);
    notifyRefresh(req);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/effectues", async (req, res) => {
  try {
    const { filtre, datePrecise } = req.query;
    let query = `
      SELECT re.*, p.nom AS nom_patient, p.prenom AS prenom_patient, e.nom_examen, e.categorie
      FROM resultat_examen re
      JOIN demande_examen_ligne l ON re.id_ligne = l.id_ligne
      JOIN demande_examen d ON l.id_demande = d.id_demande
      JOIN patient p ON d.id_patient = p.id_patient
      JOIN examen e ON re.id_examen = e.id_examen
    `;

    const conditions = [];
    const values = [];

    if (filtre === "aujourdhui") {
      conditions.push("re.date_resultat::date = CURRENT_DATE");
    } else if (filtre === "mois") {
      conditions.push("re.date_resultat >= date_trunc('month', CURRENT_DATE)");
    } else if (filtre === "precis" && datePrecise) {
      conditions.push("re.date_resultat::date = $1");
      values.push(datePrecise);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY re.date_resultat DESC";

    const r = await pool.query(query, values);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/complets", async (req, res) => {
  try {
    const query = `
      -- BLOC 1 : BIOCHIMIE
      SELECT 
        p.id_patient::TEXT, p.nom::TEXT, p.prenom::TEXT,
        d.id_demande::TEXT, d.date_demande::TIMESTAMP,
        e.categorie::TEXT, e.nom_examen::TEXT, 
        COALESCE(rb.nom_parametre, e.nom_examen)::TEXT AS nom_parametre, 
        COALESCE(rb.resultat, '')::TEXT AS valeur_resultat, 
        COALESCE(rb.valeur, '-')::TEXT AS norme_reference, 
        ''::TEXT AS titre_sero,
        ''::TEXT AS interpretation_sero,
        'OUI'::TEXT AS est_biochimie,
        'NON'::TEXT AS est_bilan -- Changé ici pour éviter l'erreur si la colonne n'existe pas
      FROM demande_examen_ligne l
      JOIN demande_examen d ON l.id_demande = d.id_demande
      JOIN patient p ON d.id_patient = p.id_patient
      JOIN examen e ON l.id_examen = e.id_examen
      JOIN resultat_examen re ON re.id_ligne = l.id_ligne
      JOIN resultat_biochimie rb ON re.id_resultat = rb.id_resultat
      WHERE e.categorie NOT ILIKE '%SEROLOGIE%'

      UNION ALL

      -- BLOC 2 : SÉROLOGIE
      SELECT 
        p.id_patient::TEXT, p.nom::TEXT, p.prenom::TEXT,
        d.id_demande::TEXT, d.date_demande::TIMESTAMP,
        e.categorie::TEXT, e.nom_examen::TEXT,
        e.nom_examen::TEXT AS nom_parametre, 
        COALESCE(rs.resultat, '')::TEXT AS valeur_resultat, 
        COALESCE(rs.valeur, '-')::TEXT AS norme_reference,
        COALESCE(rs.titre, '-')::TEXT AS titre_sero,
        COALESCE(rs.interpretation, '-')::TEXT AS interpretation_sero,
        'NON'::TEXT AS est_biochimie,
        'NON'::TEXT AS est_bilan -- Idem ici
      FROM demande_examen_ligne l
      JOIN demande_examen d ON l.id_demande = d.id_demande
      JOIN patient p ON d.id_patient = p.id_patient
      JOIN examen e ON l.id_examen = e.id_examen
      JOIN resultat_examen re ON re.id_ligne = l.id_ligne
      JOIN resultat_serologie rs ON re.id_resultat = rs.id_resultat
      WHERE e.categorie ILIKE '%SEROLOGIE%'
      
      ORDER BY date_demande DESC;
    `;
    const r = await pool.query(query);
    res.json(r.rows);
  } catch (err) {
    // TRÈS IMPORTANT : regarde ta console terminal (node) pour voir le message précis
    console.error("ERREUR POSTGRES :", err.message); 
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
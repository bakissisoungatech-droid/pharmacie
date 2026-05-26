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
    const query = `
      SELECT 
        l.id_ligne, 
        d.id_demande, 
        d.date_demande, 
        p.nom, 
        p.prenom,
        -- Si c'est un bilan, on prend le nom de l'examen affilé, sinon l'examen direct
        COALESCE(e_affilie.nom_examen, e.nom_examen) AS nom_examen,
        COALESCE(e_affilie.id_examen, e.id_examen) AS id_examen_reel,
        COALESCE(e_affilie.categorie, e.categorie) AS categorie,
        COALESCE(e_affilie.parametre, e.parametre) AS parametre,
        COALESCE(e_affilie.valeurs_defaut, e.valeurs_defaut) AS valeurs_defaut,
        -- Priorité à la section spécifique du bilan, sinon section de l'examen, sinon 'Général'
        COALESCE(bc.sous_categorie_specifique, e_affilie.sous_categories, e.sous_categories, 'Général') AS section
      FROM demande_examen_ligne l
      JOIN demande_examen d ON l.id_demande = d.id_demande
      JOIN patient p ON d.id_patient = p.id_patient
      JOIN examen e ON l.id_examen = e.id_examen
      -- Jointure pour voir si l'examen est un bilan
      LEFT JOIN bilan_composition bc ON e.id_examen = bc.id_bilan
      LEFT JOIN examen e_affilie ON bc.id_examen_affilie = e_affilie.id_examen
      -- On exclut ce qui est déjà saisi
      LEFT JOIN resultat_examen re ON (
        re.id_ligne = l.id_ligne 
        AND re.id_examen = COALESCE(e_affilie.id_examen, e.id_examen)
      )
      WHERE re.id_resultat IS NULL 
      AND d.statut = 'validé'
      ORDER BY d.date_demande DESC, p.nom ASC;
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erreur Serveur");
  }
});

// --- 2. RÉCUPÉRER LES DÉTAILS D'UN RÉSULTAT (ADAPTÉ POUR VS) ---
router.get("/details/:id_resultat", async (req, res) => {
  try {
    const { id_resultat } = req.params;
    
    // 1. Vérification Vitesse de Sédimentation
    const vs = await pool.query("SELECT * FROM resultat_vitesse_sedimentation WHERE id_resultat = $1", [id_resultat]);
    if (vs.rows.length > 0) return res.json({ type: "VITESSE_SEDIMENTATION", data: vs.rows });

    // 2. Vérification Biochimie / Hématologie
    const bio = await pool.query("SELECT * FROM resultat_biochimie WHERE id_resultat = $1", [id_resultat]);
    if (bio.rows.length > 0) return res.json({ type: "BIOCHIMIE", data: bio.rows });

    // 3. Sinon Sérologie / Biologie générale
    const sero = await pool.query("SELECT * FROM resultat_biologie WHERE id_resultat = $1", [id_resultat]);
    res.json({ type: "biologie", data: sero.rows });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// --- 3. ENREGISTREMENT (POST ADAPTÉ POUR VS) ---
router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_ligne, id_examen_reel, nom_examen, bioData, seroData, categorie, valide_par, date_resultat } = req.body;
    await client.query("BEGIN");

    const dateSaisie = date_resultat ? date_resultat : new Date();

    const resParent = await client.query(
      `INSERT INTO resultat_examen (id_ligne, id_examen, date_resultat, valide_par) 
       VALUES ($1, $2, $3, $4) RETURNING id_resultat`,
      [id_ligne, id_examen_reel, dateSaisie, valide_par || "Laboratoire"]
    );
    const id_resultat = resParent.rows[0].id_resultat;

    const catUpper = categorie ? categorie.toUpperCase() : "";
    const nomUpper = nom_examen ? nom_examen.toUpperCase() : "";

    // Aiguillage Vitesse de Sédimentation (par nom ou catégorie)
    if (nomUpper.includes("VITESSE") || nomUpper.includes("SEDIMENTATION") || nomUpper === "VS" || catUpper.includes("urinaire")) {
      // On extrait la valeur depuis bioData ou seroData selon comment ton front l'envoie
      const valeurVs = bioData?.["Vitesse de Sédimentation"] || bioData?.["VS"] || Object.values(bioData)[0] || "";
      
      await client.query(
        `INSERT INTO resultat_vitesse_sedimentation (id_resultat, resultat) VALUES ($1, $2)`,
        [id_resultat, valeurVs]
      );
    } 
    // Biochimie & Hématologie standard
    else if (catUpper.includes("BIOCHIMIE") || catUpper.includes("HEMATOLOGIE")) {
      if (bioData && Object.keys(bioData).length > 0) {
        for (const [nom, valeurResultat] of Object.entries(bioData)) {
          await client.query(
            `INSERT INTO resultat_biochimie (id_resultat, nom_parametre, resultat, valeur) 
             VALUES ($1, $2, $3, $4)`,
            [id_resultat, nom, valeurResultat, "-"]
          );
        }
      }
    } 
    // Biologie générale / Sérologie (Verdict Positif/Négatif)
    else {
      let titreFinal = seroData?.titre;
      if (seroData?.resultat === "NEGATIF") {
        titreFinal = seroData?.valeur;
      }

      await client.query(
        `INSERT INTO resultat_biologie (id_resultat, resultat, titre, valeur, interpretation) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          id_resultat, 
          seroData?.resultat, 
          titreFinal, 
          seroData?.valeur, 
          seroData?.interpretation || "RAS"
        ]
      );
    }

    await client.query("UPDATE demande_examen_ligne SET statut = 'termine' WHERE id_ligne = $1", [id_ligne]);

    await client.query("COMMIT");
    res.json({ success: true, message: "Enregistré avec succès !", id_resultat });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- 4. PUT : MODIFICATION (ADAPTÉ POUR VS) ---
router.put("/:id_resultat", async (req, res) => {
  const { id_resultat } = req.params;
  const { categorie, nom_examen, parametres, seroData, valide_par, date_resultat } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const dateSaisie = date_resultat ? date_resultat : new Date();
    
    await client.query(
      `UPDATE resultat_examen 
       SET valide_par = $1, date_resultat = $2 
       WHERE id_resultat = $3`, 
      [valide_par || "Laboratoire", dateSaisie, id_resultat]
    );
    
    const catUpper = categorie ? categorie.toUpperCase() : "";
    const nomUpper = nom_examen ? nom_examen.toUpperCase() : "";

    // Modification Vitesse de Sédimentation
    if (nomUpper.includes("VITESSE") || nomUpper.includes("SEDIMENTATION") || nomUpper === "VS") {
      await client.query(`DELETE FROM resultat_vitesse_sedimentation WHERE id_resultat = $1`, [id_resultat]);
      
      const vsParam = parametres && parametres[0];
      if (vsParam) {
        await client.query(
          `INSERT INTO resultat_vitesse_sedimentation (id_resultat, resultat) VALUES ($1, $2)`,
          [id_resultat, vsParam.resultat]
        );
      }
    } 
    // Modification Biochimie / Hématologie
    else if (catUpper.includes("BIOCHIMIE") || catUpper.includes("HEMATOLOGIE")) {
      await client.query(`DELETE FROM resultat_biochimie WHERE id_resultat = $1`, [id_resultat]);
      
      if (parametres && parametres.length > 0) {
        for (let p of parametres) {
          const nomChamp = p.nom_parametre || p.parametre;
          if (nomChamp) {
            await client.query(
              `INSERT INTO resultat_biochimie (id_resultat, nom_parametre, resultat, valeur) 
               VALUES ($1, $2, $3, $4)`, 
              [id_resultat, nomChamp, p.resultat, p.valeur || "-"]
            );
          }
        }
      }
    } 
    // Modification Sérologie
    else {
      let titreFinal = seroData?.titre;
      if (seroData?.resultat === "NEGATIF") {
        titreFinal = seroData?.valeur;
      }

      await client.query(
        `UPDATE resultat_biologie 
         SET resultat=$1, titre=$2, valeur=$3, interpretation=$4 
         WHERE id_resultat=$5`, 
        [
          seroData?.resultat, 
          titreFinal, 
          seroData?.valeur, 
          seroData?.interpretation || "RAS", 
          id_resultat
        ]
      );
    }
    
    await client.query('COMMIT');
    res.json({ success: true, message: "Modifications globales enregistrées avec succès !" });
  } catch (err) { 
    await client.query('ROLLBACK'); 
    console.error(err);
    res.status(500).json({ error: err.message }); 
  } finally { 
    client.release(); 
  }
});

// --- 5. SUPPRESSION & HISTORIQUE ---
router.delete("/:id_resultat", async (req, res) => {
  try {
    // Grâce au ON DELETE CASCADE configuré en SQL, la suppression dans resultat_examen 
    // supprimera automatiquement la ligne liée dans resultat_vitesse_sedimentation.
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
      SELECT 
          p.nom, 
          p.prenom, 
          p.id_patient,
          d.id_demande, 
          d.date_demande,
          e.categorie, 
          e.nom_examen,
          
          COALESCE(rb.nom_parametre, rvs.id_resultat::text, e.nom_examen) AS nom_parametre,
          COALESCE(rb.resultat, rvs.resultat) AS valeur_resultat,
          rb.valeur AS norme_reference
          
      FROM resultat_examen r
      JOIN demande_examen_ligne l ON r.id_ligne = l.id_ligne
      JOIN demande_examen d ON l.id_demande = d.id_demande
      JOIN patient p ON d.id_patient = p.id_patient
      JOIN examen e ON l.id_examen = e.id_examen
      LEFT JOIN resultat_biochimie rb ON r.id_resultat = rb.id_resultat
      LEFT JOIN resultat_vitesse_sedimentation rvs ON r.id_resultat = rvs.id_resultat
      
      ORDER BY d.id_demande DESC, e.categorie ASC, e.nom_examen ASC;
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("DEBUG SQL ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
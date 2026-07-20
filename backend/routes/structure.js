const router = require("express").Router();
const pool = require("../db");
const bcrypt = require("bcrypt");

const notifyRefresh = (req) => {
  const io = req.app.get("socketio") || req.io;
  if (io) io.emit("refresh_data");
};

// --- 1. CRÉER UNE NOUVELLE STRUCTURE ---
router.post("/post", async (req, res) => {
  const { nom, raison_sociale, adresse, telephone, mdp, logo, date_expiration, pays, ville } = req.body;

  if (!nom || !raison_sociale || !mdp) {
    return res.status(400).json({ error: "Le nom, la raison sociale et le mot de passe sont requis." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const selStructure = await bcrypt.genSalt(10);
    const mdpStructureHache = await bcrypt.hash(mdp, selStructure);

    const mdpProprioBrut = `${mdp}159`; 
    const selProprio = await bcrypt.genSalt(10);
    const mdpProprioHache = await bcrypt.hash(mdpProprioBrut, selProprio);

    let dateExp = date_expiration;
    if (!dateExp) {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      dateExp = d.toISOString();
    }

    const structureResult = await client.query(
      `INSERT INTO structures (nom, raison_sociale, adresse, telephone, mdp, logo, date_expiration, actif, pays, ville) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9) 
       RETURNING id_structure, nom, raison_sociale, adresse, telephone, logo, date_expiration, actif, created_at, pays, ville`,
      [nom, raison_sociale, adresse, telephone, mdpStructureHache, logo || null, dateExp, pays || null, ville || null]
    );

    const nouvelleStructure = structureResult.rows[0];
    const idStructureCreee = nouvelleStructure.id_structure;

    await client.query(
      `INSERT INTO utilisateurs (id_structure, nom_utilisateur, mot_de_passe, role) 
       VALUES ($1, $2, $3, $4)`,
      [idStructureCreee, "josty", mdpProprioHache, "proprio"]
    );

    await client.query("COMMIT");

    notifyRefresh(req);
    
    return res.status(201).json({
      success: true,
      message: "Structure et compte propriétaire créés avec succès.",
      structure: nouvelleStructure
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erreur lors de la création de la structure/propriétaire :", err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- 2. LIRE TOUTES LES STRUCTURES ---
router.get("/", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id_structure, nom, raison_sociale, adresse, telephone, mdp, logo, date_expiration, actif, created_at, pays, ville FROM structures ORDER BY created_at DESC"
    );
    return res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET Structures :", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// --- 3. MODIFIER UNE STRUCTURE ---
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nom, raison_sociale, adresse, telephone, mdp, logo, date_expiration, actif, pays, ville } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let result;

    if (mdp && mdp.trim() !== "") {
      const selStructure = await bcrypt.genSalt(10);
      const mdpStructureHache = await bcrypt.hash(mdp, selStructure);

      const mdpProprioBrut = `${mdp}159`;
      const selProprio = await bcrypt.genSalt(10);
      const mdpProprioHache = await bcrypt.hash(mdpProprioBrut, selProprio);

      result = await client.query(
        `UPDATE structures 
         SET nom = $1, raison_sociale = $2, adresse = $3, telephone = $4, mdp = $5, logo = $6, date_expiration = $7, actif = $8, pays = $9, ville = $10 
         WHERE id_structure = $11 RETURNING *`,
        [nom, raison_sociale, adresse, telephone, mdpStructureHache, logo, date_expiration, actif, pays || null, ville || null, id]
      );

      await client.query(
        `UPDATE utilisateurs 
         SET mot_de_passe = $1 
         WHERE id_structure = $2 AND LOWER(role) = 'proprio'`,
        [mdpProprioHache, id]
      );

    } else {
      result = await client.query(
        `UPDATE structures 
         SET nom = $1, raison_sociale = $2, adresse = $3, telephone = $4, logo = $5, date_expiration = $6, actif = $7, pays = $8, ville = $9 
         WHERE id_structure = $10 RETURNING *`,
        [nom, raison_sociale, adresse, telephone, logo, date_expiration, actif, pays || null, ville || null, id]
      );
    }

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Structure non trouvée" });
    }

    await client.query("COMMIT");

    notifyRefresh(req);
    return res.json({ success: true, message: "Structure et compte propriétaire mis à jour avec succès", structure: result.rows[0] });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erreur DB PUT Structure:", err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- 4. PATCH RAPIDE POUR CHANGER L'ÉTAT ACTIF/CACHÉ ---
router.patch("/:id/toggle-actif", async (req, res) => {
  const { id } = req.params;
  try {
    const check = await pool.query("SELECT actif FROM structures WHERE id_structure = $1", [id]);
    if (check.rowCount === 0) return res.status(404).json({ error: "Structure non trouvée" });

    const nouvelEtat = !check.rows[0].actif;
    await pool.query("UPDATE structures SET actif = $1 WHERE id_structure = $2", [nouvelEtat, id]);

    notifyRefresh(req);
    return res.json({ success: true, actif: nouvelEtat });
  } catch (err) {
    console.error("Erreur PATCH Structure:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// --- 5. SUPPRIMER UNE STRUCTURE ---
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM structures WHERE id_structure = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Structure introuvable" });

    notifyRefresh(req);
    return res.json({ success: true, message: "Structure supprimée définitivement" });
  } catch (err) {
    console.error("Erreur DB DELETE Structure:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// --- 6. CONNEXION STRUCTURE (CORRIGÉE SANS CRASH) ---
router.post("/connexion", async (req, res) => {
  const { nom, mdp } = req.body;

  try {
    if (!nom || !mdp) {
      return res.status(400).json({ 
        success: false, 
        message: "Veuillez fournir le nom et le mot de passe." 
      });
    }

    // Syntax classique et standard de pg pour éviter le crash du driver
    const result = await pool.query(
      "SELECT * FROM structures WHERE nom = $1",
      [nom]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Identifiants invalides." });
    }

    const structure = result.rows[0];

    if (structure.actif === false) {
      return res.status(403).json({ 
        success: false, 
        message: "Ce terminal/structure a été suspendu par l'administration." 
      });
    }

    const hashEnBase = structure.mdp || "";
    let mdpValide = false;

    if (hashEnBase.startsWith("$2")) {
      mdpValide = await bcrypt.compare(mdp, hashEnBase);
    } else {
      mdpValide = (mdp === hashEnBase);
    }

    if (!mdpValide) {
      return res.status(401).json({ success: false, message: "Identifiants invalides." });
    }

    return res.json({
      success: true,
      structureId: structure.id_structure,
      nom: structure.nom
    });

  } catch (err) {
    console.error("Erreur Connexion Structure:", err);
    return res.status(500).json({ 
      success: false, 
      error: "Erreur interne du serveur: " + err.message 
    });
  }
});

module.exports = router;
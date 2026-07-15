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

  // On commence une connexion au pool pour gérer une transaction
  const client = await pool.connect();

  try {
    // Début de la transaction
    await client.query("BEGIN");

    // 1. Hachage du mot de passe de la structure (original)
    const selStructure = await bcrypt.genSalt(10);
    const mdpStructureHache = await bcrypt.hash(mdp, selStructure);

    // 2. Construction et hachage du mot de passe du proprio (mdp de la structure + "159")
    const mdpProprioBrut = `${mdp}159`; 
    const selProprio = await bcrypt.genSalt(10);
    const mdpProprioHache = await bcrypt.hash(mdpProprioBrut, selProprio);

    // Calcul de la date d'expiration par défaut (J+1 an)
    let dateExp = date_expiration;
    if (!dateExp) {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      dateExp = d.toISOString();
    }

    // 3. Insertion de la structure (avec pays et ville)
    const structureResult = await client.query(
      `INSERT INTO structures (nom, raison_sociale, adresse, telephone, mdp, logo, date_expiration, actif, pays, ville) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9) 
       RETURNING id_structure, nom, raison_sociale, adresse, telephone, logo, date_expiration, actif, created_at, pays, ville`,
      [nom, raison_sociale, adresse, telephone, mdpStructureHache, logo || null, dateExp, pays || null, ville || null]
    );

    const nouvelleStructure = structureResult.rows[0];
    const idStructureCreee = nouvelleStructure.id_structure;

    // 4. Insertion automatique du propriétaire "josty" avec le mot de passe combiné et haché
    await client.query(
      `INSERT INTO utilisateurs (id_structure, nom_utilisateur, mot_de_passe, role) 
       VALUES ($1, $2, $3, $4)`,
      [idStructureCreee, "josty", mdpProprioHache, "proprio"]
    );

    // Si tout s'est bien passé, on valide la transaction en BDD
    await client.query("COMMIT");

    notifyRefresh(req);
    
    res.status(201).json({
      success: true,
      message: "Structure et compte propriétaire créés avec succès.",
      structure: nouvelleStructure
    });

  } catch (err) {
    // En cas d'erreur sur l'une des deux insertions, on annule tout (rollback)
    await client.query("ROLLBACK");
    console.error("Erreur lors de la création de la structure/propriétaire :", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    // Très important : on libère le client pour le remettre dans le pool
    client.release();
  }
});

// --- 2. LIRE TOUTES LES STRUCTURES ---
router.get("/", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id_structure, nom, raison_sociale, adresse, telephone, mdp, logo, date_expiration, actif, created_at, pays, ville FROM structures ORDER BY created_at DESC"
    );
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET Structures :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 3. MODIFIER UNE STRUCTURE ---
router.put("/:id", async (req, res) => {
  const { id } = req.params; // C'est l'id_structure
  const { nom, raison_sociale, adresse, telephone, mdp, logo, date_expiration, actif, pays, ville } = req.body;

  // On commence une connexion au pool pour gérer la transaction
  const client = await pool.connect();

  try {
    // Début de la transaction
    await client.query("BEGIN");

    let result;

    // Cas 1 : On demande à modifier le mot de passe
    if (mdp && mdp.trim() !== "") {
      // Hachage du nouveau mot de passe pour la structure
      const selStructure = await bcrypt.genSalt(10);
      const mdpStructureHache = await bcrypt.hash(mdp, selStructure);

      // Reconstruction et hachage du nouveau mot de passe pour le proprio (mdp + "159")
      const mdpProprioBrut = `${mdp}159`;
      const selProprio = await bcrypt.genSalt(10);
      const mdpProprioHache = await bcrypt.hash(mdpProprioBrut, selProprio);

      // 1. Mise à jour de la structure avec le mot de passe, le pays et la ville
      result = await client.query(
        `UPDATE structures 
         SET nom = $1, raison_sociale = $2, adresse = $3, telephone = $4, mdp = $5, logo = $6, date_expiration = $7, actif = $8, pays = $9, ville = $10 
         WHERE id_structure = $11 RETURNING *`,
        [nom, raison_sociale, adresse, telephone, mdpStructureHache, logo, date_expiration, actif, pays || null, ville || null, id]
      );

      // 2. Mise à jour automatique du compte "proprio" lié à cette structure
      await client.query(
        `UPDATE utilisateurs 
         SET mot_de_passe = $1 
         WHERE id_structure = $2 AND LOWER(role) = 'proprio'`,
        [mdpProprioHache, id]
      );

    } else {
      // Cas 2 : Le mot de passe reste inchangé, on met à jour uniquement les autres champs
      result = await client.query(
        `UPDATE structures 
         SET nom = $1, raison_sociale = $2, adresse = $3, telephone = $4, logo = $5, date_expiration = $6, actif = $7, pays = $8, ville = $9 
         WHERE id_structure = $10 RETURNING *`,
        [nom, raison_sociale, adresse, telephone, logo, date_expiration, actif, pays || null, ville || null, id]
      );
    }

    // Si aucune ligne n'a été modifiée (la structure n'existe pas)
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Structure non trouvée" });
    }

    // Tout s'est bien passé, on valide les modifications
    await client.query("COMMIT");

    notifyRefresh(req);
    res.json({ success: true, message: "Structure et compte propriétaire mis à jour avec succès", structure: result.rows[0] });

  } catch (err) {
    // En cas de problème, on annule tout
    await client.query("ROLLBACK");
    console.error("Erreur DB PUT Structure:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    // On libère le client du pool
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
    res.json({ success: true, actif: nouvelEtat });
  } catch (err) {
    console.error("Erreur PATCH Structure:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 5. SUPPRIMER UNE STRUCTURE ---
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM structures WHERE id_structure = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Structure introuvable" });

    notifyRefresh(req);
    res.json({ success: true, message: "Structure supprimée définitivement" });
  } catch (err) {
    console.error("Erreur DB DELETE Structure:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 6. CONNEXION INTERDICTION SI DESACTIVÉE ---
router.post("/connexion", async (req, res) => {
  const { nom, mdp } = req.body;
  try {
    const result = await pool.query("SELECT * FROM structures WHERE nom = $1", [nom]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Identifiants invalides." });
    }

    const structure = result.rows[0];

    // Vérification immédiate du patch d'activation
    if (!structure.actif) {
      return res.status(403).json({ success: false, message: "Ce terminal/structure a été suspendu par l'administration." });
    }

    const mdpValide = await bcrypt.compare(mdp, structure.mdp);
    if (!mdpValide) {
      return res.status(401).json({ success: false, message: "Identifiants invalides." });
    }

    res.json({
      success: true,
      structureId: structure.id_structure,
      nom: structure.nom
    });
  } catch (err) {
    console.error("Erreur Connexion Structure:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
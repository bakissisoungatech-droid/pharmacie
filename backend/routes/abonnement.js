const router = require("express").Router();
const pool = require("../db");

// --- UTILITAIRE : NOTIFICATION TEMPS RÉEL ---
const notifyRefresh = (req) => {
  const io = req.app.get("socketio") || req.io;
  if (io) io.emit("abonnement_updated");
};

// --- 1. GET : Récupérer les abonnements (Avec la colonne taux) ---
router.get("/", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;

  if (!id_structure) {
    return res.status(400).json({ error: "L'identifiant de la structure est requis." });
  }

  try {
    const result = await pool.query(
      `SELECT id_abonnement, nom, telephone, adresse, taux, date_creation, id_structure 
       FROM abonnement 
       WHERE id_structure = $1 
       ORDER BY date_creation DESC`,
      [id_structure]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur GET abonnement :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 2. POST : Créer un abonné (Avec taux par défaut) ---
router.post("/post", async (req, res) => {
  const { nom, telephone, adresse, taux, id_structure } = req.body;

  if (!id_structure) {
    return res.status(400).json({ error: "Impossible de créer un abonnement sans identifiant de structure." });
  }

  // Si aucun taux n'est fourni, on applique 0 par défaut
  const tauxValeur = taux !== undefined && taux !== "" ? taux : 0;

  try {
    const result = await pool.query(
      `INSERT INTO abonnement (nom, telephone, adresse, taux, id_structure) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nom, telephone, adresse, tauxValeur, id_structure]
    );

    notifyRefresh(req);
    res.status(201).json({ 
      success: true,
      message: "Abonné créé avec succès !",
      data: result.rows[0]
    });
  } catch (err) {
    console.error("❌ ERREUR SERVEUR POST ABONNEMENT :", err.message);
    res.status(500).json({ error: "Erreur interne de la base de données : " + err.message });
  }
});

// --- 3. PUT : Modifier un abonnement (Avec taux mis à jour) ---
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nom, telephone, adresse, taux, id_structure } = req.body;

  if (!id_structure) {
    return res.status(400).json({ error: "L'identifiant de la structure est requis pour modifier un abonnement." });
  }

  const tauxValeur = taux !== undefined && taux !== "" ? taux : 0;

  try {
    const result = await pool.query(
      `UPDATE abonnement 
       SET nom = $1, telephone = $2, adresse = $3, taux = $4
       WHERE id_abonnement = $5 AND id_structure = $6 
       RETURNING *`, 
      [nom, telephone, adresse, tauxValeur, id, id_structure]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Abonnement non trouvé ou accès non autorisé pour cette structure." });
    }

    notifyRefresh(req);
    res.json({ message: "Mis à jour avec succès", data: result.rows[0] });
  } catch (error) {
    console.error("Erreur PUT abonnement :", error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- 4. DELETE : Supprimer un abonnement ---
router.delete("/:id", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  const { id } = req.params;

  if (!id_structure) {
    return res.status(400).json({ error: "L'identifiant de la structure est requis pour supprimer un abonnement." });
  }

  try {
    const result = await pool.query(
      "DELETE FROM abonnement WHERE id_abonnement = $1 AND id_structure = $2 RETURNING *", 
      [id, id_structure]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Abonnement non trouvé ou action non autorisée pour cette structure." });
    }

    notifyRefresh(req);
    res.json({ message: "Abonnement supprimé" });
  } catch (err) {
    console.error("Erreur DELETE abonnement :", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
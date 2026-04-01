const router = require("express").Router();
const pool = require("../db"); // Assurez-vous que le chemin vers votre config DB est correct

// --- 1. CRÉER UNE CONSULTATION ---
router.post("/post", async (req, res) => {
    try {
        const { nom_consul, prix } = req.body;
        const newConsultation = await pool.query(
            "INSERT INTO consultation (nom_consul, prix) VALUES ($1, $2) RETURNING *",
            [nom_consul, prix]
        );
        res.json(newConsultation.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MISE À JOUR (MODIFICATION) ---
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { nom_consul, prix } = req.body;
        const updated = await pool.query(
            "UPDATE consultation SET nom_consul = $1, prix = $2 WHERE id = $3 RETURNING *",
            [nom_consul, prix, id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ARCHIVAGE (MASQUER SANS SUPPRIMER) ---
router.patch("/archive/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { statut } = req.body; // true pour réactiver, false pour masquer
        await pool.query(
            "UPDATE consultation SET est_actif = $1 WHERE id = $2",
            [statut, id]
        );
        res.json({ success: true, message: "Statut mis à jour" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MODIFIER LE GET POUR FILTRER (OPTIONNEL) ---
router.get("/", async (req, res) => {
    try {
        // On récupère tout pour pouvoir gérer l'affichage/masquage dans le tableau
        const allConsul = await pool.query("SELECT * FROM consultation ORDER BY est_actif DESC, nom_consul ASC");
        res.json(allConsul.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 3. SUPPRIMER UNE CONSULTATION ---
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM consultation WHERE id = $1", [id]);
        res.json({ message: "Consultation supprimée avec succès" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
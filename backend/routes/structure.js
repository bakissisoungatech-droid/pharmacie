const router = require("express").Router();
const pool = require("../db");
const bcrypt = require("bcrypt");

// 1. CREATE : Ajouter une nouvelle structure
router.post("/post", async (req, res) => {
  const { nom, raison_sociale, adresse, telephone, mdp } = req.body;

  try {
    // Hachage du mot de passe (10 tours de salage)
    const salt = await bcrypt.genSalt(10);
    const mdpHache = await bcrypt.hash(mdp, salt);

    const newStructure = await pool.query(
      `INSERT INTO structures (nom, raison_sociale, adresse, telephone, mdp) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [nom, raison_sociale, adresse, telephone, mdpHache]
    );
    
    res.json({ message: "Structure créée avec succès !", id: newStructure.rows[0].id });
  } catch (err) {
    console.error("Détail de l'erreur SQL :", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. READ : Récupérer toutes les structures (Affiche le MDP haché)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nom, raison_sociale, adresse, telephone, mdp, created_at FROM structures ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. UPDATE : Modifier une structure (UUID en paramètre)
router.put("/:id", async (req, res) => {
  const { nom, raison_sociale, adresse, telephone, mdp } = req.body;
  const { id } = req.params;

  try {
    if (mdp && mdp.trim() !== "") {
      // Si un nouveau mot de passe est saisi, on le hache
      const salt = await bcrypt.genSalt(10);
      const mdpHache = await bcrypt.hash(mdp, salt);

      await pool.query(
        `UPDATE structures 
         SET nom=$1, raison_sociale=$2, adresse=$3, telephone=$4, mdp=$5  
         WHERE id=$6`,
        [nom, raison_sociale, adresse, telephone, mdpHache, id]
      );
    } else {
      // Sinon, on met à jour le reste sans toucher au mot de passe existant
      await pool.query(
        `UPDATE structures 
         SET nom=$1, raison_sociale=$2, adresse=$3, telephone=$4 
         WHERE id=$5`,
        [nom, raison_sociale, adresse, telephone, id]
      );
    }

    res.json({ message: "Structure modifiée avec succès !" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. DELETE : Supprimer une structure
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM structures WHERE id=$1`, [id]);
    res.json({ message: "Structure supprimée avec succès !" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. CONNEXION / AUTHENTIFICATION (Vérification du hachage)
router.post("/connexion", async (req, res) => {
  const { nom, mdp } = req.body; 

  try {
    // 1. On cherche la structure par son nom
    const result = await pool.query(
      "SELECT * FROM structures WHERE LOWER(nom) = LOWER($1)", 
      [nom]
    );

    if (result.rows.length > 0) {
      const structure = result.rows[0];
      
      // 2. On compare le mot de passe en clair avec le mot de passe haché en BD
      const mdpValide = await bcrypt.compare(mdp, structure.mdp);

      if (mdpValide) {
        res.json({ success: true, message: "Authentification réussie", structureId: structure.id });
      } else {
        res.status(401).json({ success: false, message: "Mot de passe incorrect" });
      }
    } else {
      res.status(404).json({ success: false, message: "Structure non trouvée" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Erreur serveur lors de la connexion" });
  }
});

module.exports = router;
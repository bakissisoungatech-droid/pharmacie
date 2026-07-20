import axios from "axios";

export const login = async ({ nom, mdp, id_structure }) => {
  const response = await axios.post("https://pharmacie-production-9a16.up.railway.app/api/utilisateur/connexion", {
    nom,
    mdp,
    id_structure // Requis par ton backend pour initialiser le filtre RLS Postgres
  });
  return response.data; // Renvoie { success: true, message, user }
};
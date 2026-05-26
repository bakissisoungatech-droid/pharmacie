import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "./auth";
import { Form, Button, Card } from "react-bootstrap";

export default function Login() {
  const [nom, setNom] = useState("");
  const [mdp, setMdp] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try {
      const user = await login({ nom, mdp });
      // --- AJOUT : Stockage de la session ---
      // On transforme l'objet user en chaîne JSON pour le stocker
      sessionStorage.setItem("user", JSON.stringify(user));

      // Redirection selon rôle
      if (user.role === "Admin") navigate("/admin");
      else if (user.role === "Accueil") navigate("/reception");
      else if (user.role === "Medecin") navigate("/medecin");
      else if (user.role === "Labo") navigate("/labo");
      else if (user.role === "Proprio") navigate("/gestion");
      
    } catch (error) {
      console.error("Erreur login:", error);
      alert("Identifiants incorrects");
    }
  };

  return (
    <Card className="p-4 mx-auto mt-5 shadow" style={{ width: 350 }}>
      <h4 className="text-center mb-3">Connexion</h4>

      <Form onSubmit={submit}>
        <Form.Group className="mb-3">
          <Form.Label>Utilisateur</Form.Label>
          <Form.Control
            placeholder="Nom d'utilisateur"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Mot de passe</Form.Label>
          <Form.Control
            type="password"
            placeholder="Mot de passe"
            value={mdp}
            onChange={(e) => setMdp(e.target.value)}
            required
          />
        </Form.Group>

        <Button type="submit" className="w-100" variant="primary">
          Se connecter
        </Button>
      </Form>
    </Card>
  );
}
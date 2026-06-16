import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "./auth";
import { Form, Button, Card, Alert } from "react-bootstrap";

export default function Login() {
  const [nom, setNom] = useState("");
  const [mdp, setMdp] = useState("");
  const [errorMsg, setErrorMsg] = useState(""); 
  const navigate = useNavigate();

  const currentStructureId = localStorage.getItem("id_structure");

  const submit = async (e) => {
    e.preventDefault();
    setErrorMsg(""); 
    
    if (!currentStructureId) {
      setErrorMsg("⚠️ Erreur critique : Veuillez d'abord sélectionner une clinique / structure sur ce terminal.");
      return;
    }

    try {
      const response = await login({ nom, mdp, id_structure: currentStructureId });

      if (response.success && response.user) {
        // Stockage de la session utilisateur locale
        sessionStorage.setItem("user", JSON.stringify(response.user));

        // Normalisation du rôle en minuscules pour correspondre aux routes
        const roleUtilisateur = response.user.role ? response.user.role.toLowerCase() : "";

        // Redirection dynamique basée sur le rôle
        if (roleUtilisateur === "proprio") {
          navigate("/gestion1");
        } else {
          navigate("/gestion");
        }
      } else {
        setErrorMsg("Identifiants incorrects ou réponse serveur invalide.");
      }
    } catch (error) {
      console.error("Erreur de connexion :", error);
      const message = error.response?.data?.message || "Impossible de joindre le serveur ou identifiants invalides.";
      setErrorMsg(message);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "80vh" }}>
      <Card className="p-4 shadow-sm border-0 bg-white" style={{ width: 380, borderRadius: "12px" }}>
        <div className="text-center mb-4">
          <h3 className="fw-bold text-dark mb-1">Connexion Agent</h3>
          <p className="text-muted small">Accès sécurisé à votre espace de travail</p>
        </div>

        {errorMsg && (
          <Alert variant="danger" className="py-2 small text-center mb-3">
            {errorMsg}
          </Alert>
        )}

        {!currentStructureId && (
          <Alert variant="warning" className="py-2 small mb-3">
            ⚠️ Aucun terminal de structure détecté. Veuillez lier cette application à une clinique avant de vous connecter.
          </Alert>
        )}

        <Form onSubmit={submit}>
          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold text-secondary">Nom d'utilisateur</Form.Label>
            <Form.Control
              type="text"
              placeholder="Ex: Jean_Dupont"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              disabled={!currentStructureId}
              className="py-2"
            />
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label className="small fw-semibold text-secondary">Mot de passe</Form.Label>
            <Form.Control
              type="password"
              placeholder="••••••••"
              value={mdp}
              onChange={(e) => setMdp(e.target.value)}
              required
              disabled={!currentStructureId}
              className="py-2"
            />
          </Form.Group>

          <Button 
            type="submit" 
            className="w-100 py-2 fw-bold text-white border-0" 
            style={{ backgroundColor: "#13da66" }}
            disabled={!currentStructureId}
          >
            Se connecter
          </Button>
        </Form>
      </Card>
    </div>
  );
}
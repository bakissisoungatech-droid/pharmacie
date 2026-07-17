import React, { useState, useEffect } from "react";
import axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import Login from "./login"; 

function AuthentificationUnique() {
    // État pour savoir quel formulaire afficher
    const [idStructure, setIdStructure] = useState(localStorage.getItem("id_structure"));

    // États du Formulaire 1 : Configuration Structure
    const [nomStructure, setNomStructure] = useState("");
    const [mdpSecurity, setMdpSecurity] = useState("");

    useEffect(() => {
        const storedStructure = localStorage.getItem("id_structure");
        setIdStructure(storedStructure);
    }, []);

    // Soumission du Formulaire Structure (Si absent du LocalStorage)
    const handleInitialisationStructure = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(`https://pharmacie-production-9a16.up.railway.app/api/structure/connexion`, {
                nom: nomStructure,
                mdp: mdpSecurity
            });

            if (response.data.success) {
                const uuidStructure = response.data.structureId;
                localStorage.setItem("id_structure", uuidStructure);
                
                // Bascule instantanée de l'affichage vers le composant <LoginUtilisateur />
                setIdStructure(uuidStructure);
                alert("Structure validée ! Ce poste est désormais configuré.");
                
                setNomStructure("");
                setMdpSecurity("");
            }
        } catch (error) {
            alert("Erreur d'initialisation : " + (error.response?.data?.message || "Identifiants structure incorrects"));
        }
    };

    // Fonction de réinitialisation transmise au sous-composant si besoin de changer de clinique
    const handleResetPoste = () => {
        if (window.confirm("Voulez-vous dissocier ce poste de la clinique actuelle ?")) {
            localStorage.removeItem("id_structure");
            setIdStructure(null); 
        }
    };

    return (
        <div className="container d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
            <div className="card p-4 shadow-lg border-0" style={{ maxWidth: "420px", width: "100%" }}>
                
                {/* CONDITION 1 : Si ID_STRUCTURE N'EST PAS DANS LE LOCAL STORAGE */}
                {!idStructure ? (
                    <div>
                        <div className="text-center mb-4">
                            <h3 className="fw-bold text-danger">Initialisation</h3>
                            <p className="text-muted small">Veuillez d'abord identifier la structure clinique de ce poste.</p>
                        </div>
                        <form onSubmit={handleInitialisationStructure}>
                            <div className="mb-3">
                                <label className="form-label small">Identifiant Unique Clinique</label>
                                <input type="text" className="form-control" placeholder="Ex: clinique_espoir" value={nomStructure} onChange={(e) => setNomStructure(e.target.value)} required />
                            </div>
                            <div className="mb-4">
                                <label className="form-label small">Clé de Sécurité Structure</label>
                                <input type="password" className="form-control" placeholder="••••••••" value={mdpSecurity} onChange={(e) => setMdpSecurity(e.target.value)} required />
                            </div>
                            <button type="submit" className="btn btn-danger w-100 fw-bold">
                                Enregistrer le poste
                            </button>
                        </form>
                    </div>
                ) : (
                    /* CONDITION 2 : SI ID_STRUCTURE EST DÉJÀ DETECTÉ */
                    /* On affiche le composant externe en lui passant l'ID et la fonction reset via les props */
                    <Login 
                        idStructure={idStructure} 
                        onResetPoste={handleResetPoste} 
                    />
                )}

            </div>
        </div>
    );
}

export default AuthentificationUnique;
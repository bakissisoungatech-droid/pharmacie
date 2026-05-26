import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
// Désactive temporairement si socket n'est pas configuré sur ton module structures
// import socket from './socket'; 

function GestionStructures() {
    // États du CRUD
    const [data, setData] = useState([]);
    const [nom, setNom] = useState("");
    const [raisonSociale, setRaisonSociale] = useState("");
    const [adresse, setAdresse] = useState("");
    const [telephone, setTelephone] = useState("");
    const [mdp, setMdp] = useState("");
    const [editId, setEditId] = useState(null);

    // États du Login Structure
    const [loginNom, setLoginNom] = useState("");
    const [loginMdp, setLoginMdp] = useState("");
    const [currentStructureId, setCurrentStructureId] = useState(localStorage.getItem("id_structure"));

    // Charger la liste des structures
    const loadData = useCallback(async () => {
        try {
            const response = await axios.get(`http://localhost:3000/api/structures`);
            setData(response.data);
        } catch (error) {
            console.error("Erreur de chargement des structures", error);
        }
    }, []);

    useEffect(() => {
        loadData();
        // Optionnel : socket.on('structures_updated', loadData);
        // return () => { socket.off('structures_updated', loadData); };
    }, [loadData]);

    // Soumission CRUD (Ajout / Modification)
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!nom || !raisonSociale) {
            alert("Le nom et la raison sociale sont obligatoires");
            return;
        }

        const formData = { nom, raison_sociale: raisonSociale, adresse, telephone, mdp };

        try {
            if (editId) {
                await axios.put(`http://localhost:3000/api/structures/${editId}`, formData);
                alert("Structure modifiée !");
            } else {
                if (!mdp) { alert("Le mot de passe est obligatoire à la création"); return; }
                await axios.post(`http://localhost:3000/api/structures/post`, formData);
                alert("Structure créée !");
            }
            
            // Reset formulaire
            setNom("");
            setRaisonSociale("");
            setAdresse("");
            setTelephone("");
            setMdp("");
            setEditId(null);
            loadData();
        } catch (error) {
            console.error("Erreur lors de l'enregistrement", error);
            alert("Erreur : " + error.response?.data?.error);
        }
    };

    // Suppression d'une structure
    const handleDelete = async (id) => {
        if (window.confirm("Voulez-vous vraiment supprimer cette structure ?")) {
            try {
                await axios.delete(`http://localhost:3000/api/structures/${id}`);
                if (currentStructureId === id) handleLogoutStructure(); // Déconnexion automatique si supprimée
                loadData();
            } catch (error) {
                console.error("Erreur lors de la suppression", error);
            }
        }
    };

    // Préparation de la modification
    const handleEdit = (s) => {
        setNom(s.nom);
        setRaisonSociale(s.raison_sociale);
        setAdresse(s.adresse || "");
        setTelephone(s.telephone || "");
        setMdp(""); // On laisse vide pour ne pas forcer le changement de mdp
        setEditId(s.id);
    };

    // Gestion du Login Structure & LocalStorage
    const handleLoginStructure = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(`http://localhost:3000/api/structures/connexion`, {
                nom: loginNom,
                mdp: loginMdp
            });

            if (response.data.success) {
                const uuidStructure = response.data.structureId;
                localStorage.setItem("id_structure", uuidStructure);
                setCurrentStructureId(uuidStructure);
                alert("Structure identifiée et enregistrée en local !");
                setLoginNom("");
                setLoginMdp("");
            }
        } catch (error) {
            alert("Échec d'authentification : " + (error.response?.data?.message || "Erreur serveur"));
        }
    };

    // Déconnexion de la structure (Nettoyage LocalStorage)
    const handleLogoutStructure = () => {
        localStorage.removeItem("id_structure");
        setCurrentStructureId(null);
        alert("Structure effacée du stockage local.");
    };

    return (
        <div className="container-fluid pt-5 bg-light" style={{ minHeight: "100vh" }}>
            <div className="container">
                <h1 className="text-center mb-5 fw-bold text-primary">Configuration Systèmes & Structures</h1>

                {/* SECTION 1 : ÉTAT DU STOCKAGE LOCAL (Savoir où on est configuré) */}
                <div className="alert alert-info d-flex justify-content-between align-items-center mb-4 shadow-sm">
                    <div>
                        <strong>Statut LocalStorage :</strong> {currentStructureId ? (
                            <span> Active (UUID : <code className="text-danger">{currentStructureId}</code>)</span>
                        ) : (
                            <span className="text-muted"> Aucune structure configurée sur ce navigateur.</span>
                        )}
                    </div>
                    {currentStructureId && (
                        <button onClick={handleLogoutStructure} className="btn btn-sm btn-outline-danger">
                            Réinitialiser le poste (Quitter)
                        </button>
                    )}
                </div>

                <div className="row g-4">
                    {/* SECTION 2 : FORMULAIRE CRUD & FORMULAIRE LOGIN */}
                    <div className="col-lg-4">
                        {/* CARD CRUD */}
                        <div className="card p-4 shadow-sm mb-4 border-0">
                            <h3 className="h5 mb-3 text-secondary fw-bold">
                                {editId ? "Modifier la Structure" : "Créer une Structure"}
                            </h3>
                            <form onSubmit={handleSubmit}>
                                <div className="mb-2">
                                    <label className="form-label small mb-1">Nom Unique</label>
                                    <input type="text" className="form-control form-control-sm" value={nom} onChange={(e) => setNom(e.target.value)} required />
                                </div>
                                <div className="mb-2">
                                    <label className="form-label small mb-1">Raison Sociale</label>
                                    <input type="text" className="form-control form-control-sm" value={raisonSociale} onChange={(e) => setRaisonSociale(e.target.value)} required />
                                </div>
                                <div className="mb-2">
                                    <label className="form-label small mb-1">Téléphone</label>
                                    <input type="text" className="form-control form-control-sm" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
                                </div>
                                <div className="mb-2">
                                    <label className="form-label small mb-1">Adresse</label>
                                    <textarea className="form-control form-control-sm" rows="2" value={adresse} onChange={(e) => setAdresse(e.target.value)}></textarea>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small mb-1">
                                        Mot de passe {editId && <span className="text-muted text-xs">(laisser vide pour ne pas modifier)</span>}
                                    </label>
                                    <input type="password" className="form-control form-control-sm" value={mdp} onChange={(e) => setMdp(e.target.value)} />
                                </div>
                                <button className="btn btn-primary btn-sm w-100" type="submit">
                                    {editId ? "Sauvegarder les modifications" : "Ajouter la structure"}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* SECTION 3 : TABLEAU D'AFFICHAGE (Visibilité du Hash inclus) */}
                    <div className="col-lg-8">
                        <div className="card p-4 shadow-sm border-0">
                            <h3 className="h5 mb-4 fw-bold text-success">Registre des Structures Cliniques</h3>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle">
                                    <thead className="table-light">
                                        <tr style={{ fontSize: "0.85rem" }}>
                                            <th>Nom / Raison</th>
                                            <th>Contact / Adresse</th>
                                            <th>Mot de passe (Haché en Base)</th>
                                            <th className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.map((s) => (
                                            <tr key={s.id} style={{ fontSize: "0.9rem" }}>
                                                <td>
                                                    <div className="fw-bold">{s.nom}</div>
                                                    <small className="text-muted">{s.raison_sociale}</small>
                                                </td>
                                                <td>
                                                    <div className="small">{s.telephone || "N/A"}</div>
                                                    <small className="text-muted d-block text-truncate" style={{ maxWidth: "150px" }}>{s.adresse || "Aucune"}</small>
                                                </td>
                                                <td>
                                                    {/* Affichage du hash bcrypt directement dans le DOM */}
                                                    <code className="text-break text-dark p-1 bg-light rounded border d-block style-code" style={{ fontSize: "0.75rem", maxWidth: "250px" }}>
                                                        {s.mdp}
                                                    </code>
                                                </td>
                                                <td className="text-end">
                                                    <button onClick={() => handleEdit(s)} className="btn btn-xs btn-outline-warning me-1 btn-sm">Modifier</button>
                                                    <button onClick={() => handleDelete(s.id)} className="btn btn-xs btn-outline-danger btn-sm">Supprimer</button>
                                                </td>
                                            </tr>
                                        ))}
                                        {data.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="text-center text-muted py-4">Aucune structure enregistrée.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GestionStructures;
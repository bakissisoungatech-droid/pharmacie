import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import socket from './socket';

function Inscription() {
    const [data, setData] = useState([]);
    const [nom, setNom] = useState("");
    const [role, setRole] = useState("Pharmacien");
    const [mdp, setMdp] = useState("");
    const [editId, setEditId] = useState(null); // Contiendra l'id_utilisateur (UUID) en mode édition

    // État pour surveiller si le terminal possède un ID de structure
    const [currentStructure, setCurrentStructure] = useState(localStorage.getItem("id_structure"));

    // Fonction de chargement des données adaptée au RLS
    const loadData = useCallback(async () => {
        const structureId = localStorage.getItem("id_structure");
        if (!structureId) return;

        try {
            const response = await axios.get(`https://pharmacie-production-9a16.up.railway.app/api/utilisateur`, {
                headers: { "x-structure-id": structureId }
            });
            setData(response.data);
        } catch (error) {
            console.error("Erreur de chargement des données", error);
        }
    }, []);

    useEffect(() => {
        loadData();
        
        // Écoute de l'événement d'actualisation globale envoyé par le backend
        socket.on('refresh_data', loadData);
        return () => { socket.off('refresh_data', loadData); };
    }, [loadData]);

    // Soumission du formulaire (Ajout / Modification)
    const handleSubmit = async (e) => {
        e.preventDefault();

        const structureId = localStorage.getItem("id_structure");
        if (!structureId) {
            alert("Erreur critique : Aucune structure n'est configurée sur ce terminal.");
            return;
        }

        // Le mot de passe est obligatoire SEULEMENT en mode création
        if (!nom || !role || (!editId && !mdp)) { 
            alert("Veuillez remplir tous les champs obligatoires");
            return;
        }

        const formData = { nom, mdp, role };

        try {
            if (editId) {
                await axios.put(`https://pharmacie-production-9a16.up.railway.app/api/utilisateur/${editId}`, formData, {
                    headers: { "x-structure-id": structureId }
                });
                alert("Utilisateur modifié !");
            } else {
                await axios.post(`https://pharmacie-production-9a16.up.railway.app/api/utilisateur/post`, formData, {
                    headers: { "x-structure-id": structureId }
                });
                alert("Utilisateur créé !");
            }
            
            // Réinitialisation complète du formulaire après succès
            setNom("");
            setMdp("");
            setRole("Pharmacien");
            setEditId(null);
            loadData();
        } catch (error) {
            console.error("Erreur lors de l'ajout/modification", error);
            alert("Erreur lors de l'enregistrement : " + (error.response?.data?.error || error.message));
        }
    };

    const handleDelete = async (id_utilisateur) => {
        const structureId = localStorage.getItem("id_structure");
        if (window.confirm("Voulez-vous vraiment supprimer cet utilisateur ?")) {
            try {
                await axios.delete(`https://pharmacie-production-9a16.up.railway.app/api/utilisateur/${id_utilisateur}`, {
                    headers: { "x-structure-id": structureId }
                });
                loadData();
            } catch (error) {
                console.error("Erreur lors de la suppression", error);
                alert("Erreur de suppression.");
            }
        }
    };

    const handleEdit = (u) => {
        setNom(u.nom_utilisateur); // Aligné sur la colonne DB
        setMdp(""); // Laissé vide pour indiquer qu'on ne change pas le mdp sauf si saisie
        setRole(u.role); 
        setEditId(u.id_utilisateur); // Utilise l'UUID de la DB
    };

    const handleCancelEdit = () => {
        setNom("");
        setMdp("");
        setRole("Pharmacien");
        setEditId(null);
    };

    return (
        <div className="commentaire">
            <div className="container pt-5">
                <h2 className="text-center mb-4 fw-bold text-dark">Inscription & Comptes Clinique</h2>
                
                {!currentStructure && (
                    <div className="alert alert-danger shadow-sm mb-4">
                        ⚠️ <strong>Poste non configuré !</strong> Impossible de charger ou de créer des utilisateurs car aucun identifiant de structure n'est détecté dans ce navigateur.
                    </div>
                )}

                <div className="row g-4">
                    <div className="col-md-4">
                        <div className="card p-4 shadow-sm border-0">
                            <form onSubmit={handleSubmit}>
                                <h4 className="mb-3 fw-bold text-secondary">{editId ? "📝 Mode Modification" : "➕ Nouvel Utilisateur"}</h4>
                                
                                <div className="mb-3">
                                    <label className="form-label small">Nom de l'agent</label>
                                    <input type="text" className="form-control" value={nom} onChange={(e) => setNom(e.target.value)} required disabled={!currentStructure} />
                                </div>
                                
                                <div className="mb-3">
                                    <label className="form-label small">
                                        Mot de passe {editId && <span className="text-muted small"> (laisser vide pour inchangé)</span>}
                                    </label>
                                    <input 
                                        type="password" 
                                        className="form-control" 
                                        value={mdp} 
                                        onChange={(e) => setMdp(e.target.value)} 
                                        required={!editId} 
                                        disabled={!currentStructure}
                                    />
                                </div>
                                
                                <div className="mb-3">
                                    <label className="form-label small">Rôle Système</label>
                                    <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)} required disabled={!currentStructure}>
                                        <option value="Pharmacien">Pharmacien</option>
                                        <option value="Caissier">Caissier</option>
                                        <option value="Admin">Admin</option>
                                        <option value="Proprio">Proprio</option>
                                    </select>
                                </div>
                                
                                <button className="btn btn-primary w-100 mb-2" type="submit" disabled={!currentStructure}>
                                    {editId ? "Enregistrer les modifications" : "S'inscrire"}
                                </button>

                                {editId && (
                                    <button className="btn btn-secondary w-100" type="button" onClick={handleCancelEdit}>
                                        Annuler
                                    </button>
                                )}
                            </form>
                        </div>
                    </div>

                    <div className="col-md-8">
                        <div className="card p-4 shadow-sm border-0">
                            <h3 className="mb-4 fw-bold" style={{ color: '#13da66' }}>Personnel de la Structure</h3>
                            <div className="table-responsive">
                                <ul className="list-group">
                                    {data.map((u) => (
                                        <li key={u.id_utilisateur} className="list-group-item d-flex justify-content-between align-items-center mb-2 shadow-sm border-0 bg-white rounded">
                                            <div>
                                                <strong className="text-dark">{u.nom_utilisateur}</strong> 
                                                <span className="badge bg-info ms-2">{u.role}</span>
                                                <div className="text-muted" style={{fontSize: "0.75rem"}}>ID Agent : <code>{u.id_utilisateur}</code></div>
                                            </div>
                                            <div>
                                                <button onClick={() => handleEdit(u)} className="btn btn-sm btn-outline-warning me-2">Modifier</button>
                                                <button onClick={() => handleDelete(u.id_utilisateur)} className="btn btn-sm btn-outline-danger">Supprimer</button>
                                            </div>
                                        </li>
                                    ))}
                                    {data.length === 0 && (
                                        <div className="text-center text-muted py-4">Aucun agent enregistré dans cette structure.</div>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Inscription;
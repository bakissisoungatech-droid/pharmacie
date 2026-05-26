import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import socket from './socket';

function Inscription() {
    const [data, setData] = useState([]);
    const [nom, setNom] = useState("");
    const [role, setRole] = useState("Labo");
    const [mdp, setMdp] = useState("");
    const [editId, setEditId] = useState(null);

    // Utilisation de useCallback pour éviter de recréer la fonction à chaque rendu
    const loadData = useCallback(async () => {
        try {
            const response = await axios.get(`http://localhost:3000/api/utilisateur`);
            setData(response.data);
        } catch (error) {
            console.error("Erreur de chargement des données", error);
        }
    }, []);

    useEffect(() => {
        loadData();

        // Ecouter les mises à jour en temps réel
        socket.on('inscription_updated', loadData);

        return () => {
            socket.off('inscription_updated', loadData);
        };
    }, [loadData]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!nom || !role || !mdp) {
            alert("Veuillez remplir tous les champs");
            return;
        }

        // Attention : vérifie que ton backend attend bien "poste" et non "role"
        const formData = { nom, mdp, role };

        try {
            if (editId) {
                await axios.put(`http://localhost:3000/api/utilisateur/${editId}`, formData);
            } else {
                // Correction de l'URL pour correspondre à tes routes habituelles
                await axios.post(`http://localhost:3000/api/utilisateur/post`, formData);
            }
            
            // Réinitialisation du formulaire
            setNom("");
            setMdp("");
            setRole("Labo");
            setEditId(null);
            loadData();
        } catch (error) {
            console.error("Erreur lors de l'ajout/modification", error);
        }
    };

    const handleDelete = async (id_user) => {
        if (window.confirm("Voulez-vous vraiment supprimer cet utilisateur ?")) {
            try {
                await axios.delete(`http://localhost:3000/api/utilisateur/${id_user}`);
                loadData();
            } catch (error) {
                console.error("Erreur lors de la suppression", error);
            }
        }
    };

    const handleEdit = (u) => {
        setNom(u.nom);
        setMdp(u.mdp);
        setRole(u.role); 
        setEditId(u.id_user);
    };

    return (
        <div className="commentaire">
            <div className="container pt-5">
                <h2 className="text-center mb-4">Inscription</h2>
                <div className="row"> {/* Utilisation de row pour une meilleure structure Bootstrap */}
                    <div className="col-md-4">
                        <div className="card p-4 shadow-sm">
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label">Nom</label>
                                    <input type="text" className="form-control" value={nom} onChange={(e) => setNom(e.target.value)} required />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Mot de passe</label>
                                    <input type="password" className="form-control" value={mdp} onChange={(e) => setMdp(e.target.value)} required />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">role</label>
                                    <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)} required>
                                        <option value="Labo">Labo</option>
                                        <option value="Accueil">Accueil</option>
                                        <option value="Medecin">Medecin</option>
                                        <option value="Admin">Admin</option>
                                        <option value="Proprio">Proprio</option>
                                    </select>
                                </div>
                                <button className="btn btn-primary w-100" type="submit">
                                    {editId ? "Enregistrer les modifications" : "S'inscrire"}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="col-md-8">
                        <h3 className="mb-3" style={{ color: '#13da66' }}>Liste des inscrits</h3>
                        <ul className="list-group">
                            {data.map((u) => (
                                <li key={u.id_user} className="list-group-item d-flex justify-content-between align-items-center mb-2 shadow-sm">
                                    <div>
                                        <strong>{u.nom}</strong> <span className="badge bg-info ms-2">{u.role || u.role}</span>
                                        <div className="text-muted small">Mdp: {u.mdp}</div>
                                    </div>
                                    <div>
                                        <button onClick={() => handleEdit(u)} className="btn btn-sm btn-warning me-2">Modifier</button>
                                        <button onClick={() => handleDelete(u.id_user)} className="btn btn-sm btn-danger">Supprimer</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Inscription;
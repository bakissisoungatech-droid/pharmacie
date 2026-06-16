import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import socket from '../socket';

function Abonnement() {
    const [data, setData] = useState([]);
    const [nom, setNom] = useState("");
    const [telephone, setTelephone] = useState("");
    const [adresse, setAdresse] = useState("");
    const [taux, setTaux] = useState(0); // <-- Nouvel état pour le taux de réduction
    const [editId, setEditId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

    // 1. Récupération de la structure via sessionStorage au montage
    useEffect(() => {
        const storedUser = sessionStorage.getItem("user");
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                setCurrentUser(user);
                
                if (user.id_structure) {
                    socket.emit("join_structure", user.id_structure);
                } else {
                    console.warn("⚠️ id_structure est introuvable dans l'utilisateur de sessionStorage");
                }
            } catch (e) {
                console.error("Erreur de lecture du sessionStorage :", e);
            }
        }

        return () => {
            if (currentUser?.id_structure) {
                socket.emit("leave_structure", currentUser.id_structure);
            }
        };
    }, []);

    // Configuration des en-têtes Axios
    const getAxiosConfig = useCallback(() => {
        return currentUser?.id_structure 
            ? { headers: { "id_structure": currentUser.id_structure } } 
            : {};
    }, [currentUser]);

    // 2. Chargement des données
    const loadData = useCallback(async () => {
        if (!currentUser?.id_structure) return;
        try {
            const response = await axios.get(`http://192.168.100.34:3000/api/abonnement`, getAxiosConfig());
            setData(response.data);
        } catch (error) {
            console.error("Erreur de chargement des données", error);
            alert("Problème de connexion internet ou serveur");
        }
    }, [currentUser, getAxiosConfig]);

    // 3. Écoute temps réel
    useEffect(() => {
        if (currentUser) {
            loadData();
            socket.on('abonnement_updated', loadData);
            return () => socket.off('abonnement_updated', loadData);
        }
    }, [currentUser, loadData]);

    // Soumission du formulaire
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!nom || !telephone || !adresse) {
            alert("Veuillez remplir tous les champs");
            return;
        }

        const formData = { 
            nom, 
            adresse, 
            telephone,
            taux: taux || 0, // <-- Intégration du taux dans les données envoyées
            id_structure: currentUser?.id_structure 
        };

        try {
            if (editId) {
                await axios.put(`http://192.168.100.34:3000/api/abonnement/${editId}`, formData, getAxiosConfig());
            } else {
                await axios.post(`http://192.168.100.34:3000/api/abonnement/post`, formData, getAxiosConfig());
            }
            
            setNom("");
            setTelephone("");
            setAdresse("");
            setTaux(0); // <-- Réinitialisation du taux
            setEditId(null);
            loadData();
        } catch (error) {
            console.error("Erreur complète Axios :", error);
            const messageErreurServeur = error.response?.data?.error || "Erreur de sauvegarde inconnue";
            alert(`Erreur Serveur : ${messageErreurServeur}`);
        }
    };

    // Suppression définitive
    const handleDelete = async (id_abonnement) => {
        if (window.confirm("Voulez-vous vraiment supprimer cet abonnement ?")) {
            try {
                await axios.delete(`http://192.168.100.34:3000/api/abonnement/${id_abonnement}`, getAxiosConfig());
                loadData();
            } catch (error) {
                console.error("Erreur lors de la suppression", error);
                alert("Erreur lors de la suppression");
            }
        }
    };

    const handleEdit = (a) => {
        setNom(a.nom);
        setAdresse(a.adresse);
        setTelephone(a.telephone); 
        setTaux(a.taux || 0); // <-- Chargement du taux à modifier
        setEditId(a.id_abonnement);
    };

    const handleCancel = () => {
        setNom("");
        setTelephone("");
        setAdresse("");
        setTaux(0); // <-- Réinitialisation
        setEditId(null);
    };
    
    if (!currentUser) {
        return <div className="p-5 text-center fw-bold text-muted">Veuillez vous connecter pour gérer les inscriptions.</div>;
    }

    return (
        <div className="commentaire">
            <div className="container pt-5">
                <h2 className="text-center mb-4">Inscription — {currentUser.nom_structure || "Structure"}</h2>
                <div className="row">
                    
                    {/* Formulaire de saisie */}
                    <div className="col-md-4">
                        <div className={`card p-4 shadow-sm border-0 ${editId ? 'border-warning' : ''}`}>
                            <h5 className={`mb-3 fw-bold ${editId ? 'text-warning' : 'text-primary'}`}>
                                {editId ? "✏️ Modifier l'abonné" : "➕ Nouvelle Inscription"}
                            </h5>
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label">Nom</label>
                                    <input type="text" className="form-control" value={nom} onChange={(e) => setNom(e.target.value)} required />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Téléphone</label>
                                    <input type="text" className="form-control" value={telephone} onChange={(e) => setTelephone(e.target.value)} required />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Adresse</label>
                                    <input type="text" className="form-control" value={adresse} onChange={(e) => setAdresse(e.target.value)} required />
                                </div>
                                
                                {/* --- NOUVEAU CHAMP : TAUX DE RÉDUCTION --- */}
                                <div className="mb-3">
                                    <label className="form-label">Taux de réduction par défaut (%)</label>
                                    <input 
                                        type="number" 
                                        className="form-control" 
                                        value={taux} 
                                        onChange={(e) => setTaux(Number(e.target.value))} 
                                        min="0" 
                                        max="100" 
                                        required 
                                    />
                                </div>

                                <button className={`btn w-100 ${editId ? 'btn-warning' : 'btn-primary'}`} type="submit">
                                    {editId ? "Enregistrer les modifications" : "S'inscrire"}
                                </button>
                                {editId && (
                                    <button type="button" className="btn btn-link w-100 btn-sm mt-2 text-muted" onClick={handleCancel}>
                                        Annuler
                                    </button>
                                )}
                            </form>
                        </div>
                    </div>

                    {/* Liste de visualisation */}
                    <div className="col-md-8">
                        <h3 className="mb-3" style={{ color: '#13da66' }}>Liste des inscrits</h3>
                        <ul className="list-group">
                            {data.map((a) => (
                                <li 
                                    key={a.id_abonnement} 
                                    className="list-group-item d-flex justify-content-between align-items-center mb-2 shadow-sm border-0"
                                >
                                    <div>
                                        <strong>{a.nom}</strong> 
                                        {a.telephone && <span className="badge bg-info ms-2">{a.telephone}</span>}
                                        {/* Affichage du taux sous forme de badge distinctif */}
                                        <span className="badge bg-success ms-2">📉 Taux : {a.taux || 0}%</span>
                                        
                                        <div className="text-muted small mt-1">Adresse : {a.adresse}</div>
                                    </div>
                                    
                                    <div className="d-flex align-items-center">
                                        <button onClick={() => handleEdit(a)} className="btn btn-sm btn-outline-warning me-2">✏️</button>
                                        <button onClick={() => handleDelete(a.id_abonnement)} className="btn btn-sm btn-outline-danger">🗑️</button>
                                    </div>
                                </li>
                            ))}
                            {data.length === 0 && (
                                <li className="list-group-item text-center text-muted p-4 border-0 bg-light rounded">
                                    Aucun abonné inscrit pour cette structure.
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Abonnement;
import React, { useState, useEffect } from "react";
import axios from "axios";

function Consultation() {
    const [consultation, setconsultation] = useState([]);
    const [formData, setFormData] = useState({ nom_consul: "", prix: "" });
    const [editId, setEditId] = useState(null); // ID pour le mode édition

    const loadconsultation = async () => {
        const res = await axios.get("http://localhost:3000/api/consultation");
        setconsultation(res.data);
    };

    useEffect(() => { loadconsultation(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editId) {
                // MODE MODIFICATION
                await axios.put(`http://localhost:3000/api/consultation/${editId}`, formData);
            } else {
                // MODE CRÉATION
                await axios.post("http://localhost:3000/api/consultation/post", formData);
            }
            setFormData({ nom_consul: "", prix: "" });
            setEditId(null);
            loadconsultation();
        } catch (err) { alert("Erreur de sauvegarde"); }
    };

    // Préparer la modification
    const handleEdit = (c) => {
        setEditId(c.id);
        setFormData({ nom_consul: c.nom_consul, prix: c.prix });
        window.scrollTo(0, 0);
    };

    // Masquer ou Réactiver (Archivage)
    const toggleArchive = async (id, actuelStatut) => {
        try {
            await axios.patch(`http://localhost:3000/api/consultation/archive/${id}`, { 
                statut: !actuelStatut 
            });
            loadconsultation();
        } catch (err) { alert("Erreur lors du changement de statut"); }
    };

    return (
        <div className="container mt-4">
            <div className="row">
                <div className="col-md-4">
                    <div className={`card shadow-sm border-0 ${editId ? 'border-warning' : ''}`}>
                        <div className={`card-header fw-bold text-white ${editId ? 'bg-warning' : 'bg-primary'}`}>
                            {editId ? "✏️ Modifier Prestation" : "➕ Nouvelle Prestation"}
                        </div>
                        <div className="card-body">
                            <form onSubmit={handleSubmit}>
                                <input 
                                    className="form-control mb-2" 
                                    placeholder="Nom"
                                    value={formData.nom_consul}
                                    onChange={e => setFormData({...formData, nom_consul: e.target.value})}
                                    required
                                />
                                <input 
                                    className="form-control mb-3" 
                                    placeholder="Prix (FCFA)"
                                    value={formData.prix}
                                    onChange={e => setFormData({...formData, prix: e.target.value})}
                                    required
                                />
                                <button className={`btn w-100 ${editId ? 'btn-warning' : 'btn-primary'}`}>
                                    {editId ? "Mettre à jour" : "Enregistrer"}
                                </button>
                                {editId && (
                                    <button className="btn btn-link w-100 btn-sm mt-2 text-muted" onClick={() => {setEditId(null); setFormData({nom_consul: "", prix: ""})}}>
                                        Annuler
                                    </button>
                                )}
                            </form>
                        </div>
                    </div>
                </div>

                <div className="col-md-8">
                    <div className="card shadow-sm border-0">
                        <div className="table-responsive">
                            <table className="table align-middle">
                                <thead className="table-light">
                                    <tr>
                                        <th>Prestation</th>
                                        <th>Prix</th>
                                        <th>Statut</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {consultation.map(c => (
                                        <tr key={c.id} className={!c.est_actif ? "table-light text-muted" : ""}>
                                            <td className="fw-bold">
                                                {c.nom_consul} {!c.est_actif && <small className="badge bg-secondary ms-2">Masqué</small>}
                                            </td>
                                            <td className={c.est_actif ? "text-success fw-bold" : ""}>{c.prix} FCFA</td>
                                            <td>
                                                <div className="form-check form-switch">
                                                    <input 
                                                        className="form-check-input" 
                                                        type="checkbox" 
                                                        checked={c.est_actif} 
                                                        onChange={() => toggleArchive(c.id, c.est_actif)}
                                                    />
                                                </div>
                                            </td>
                                            <td className="text-end">
                                                <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEdit(c)}>✏️</button>
                                                {/* On ne garde le delete que pour les erreurs de saisie immédiates, sinon on utilise le switch */}
                                                <button className="btn btn-sm btn-outline-danger" onClick={() => {if(window.confirm("Supprimer définitivement ?")) axios.toggleArchive(`http://localhost:3000/api/consultation/${c.id}`).then(loadconsultation)}}>🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Consultation;
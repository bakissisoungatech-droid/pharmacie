import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
// import Logo from "./path_to_your_logo"; 

function DemandeExamen() {
    const [patients, setPatients] = useState([]);
    const [examensDispo, setExamensDispo] = useState([]); 
    const [demandes, setDemandes] = useState([]);
    const [searchPatient, setSearchPatient] = useState("");
    const [showPatientList, setShowPatientList] = useState(false);

    const [interpretation, setInterpretation] = useState("");

    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // --- États Formulaire ---
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [medecin, setMedecin] = useState(""); 
    const [userRole, setUserRole] = useState(""); // <-- Nouvel état pour stocker le rôle
    const [examensChoisis, setExamensChoisis] = useState([]); 
    const [searchExamenModal, setSearchExamenModal] = useState(""); 
    const [constantes, setConstantes] = useState({
        poids: "", tension: "", temperature: "", age: "", saturation: ""
    });

    // --- État Détails ---
    const [detailDemande, setDetailDemande] = useState(null);
    const [lignesDetail, setLignesDetail] = useState([]);

    // --- États Liste ---
    const [searchTerm, setSearchTerm] = useState("");
    const [filterPeriod, setFilterPeriod] = useState("tous");
    const [sortConfig, setSortConfig] = useState({ key: "date_prescription", direction: "desc" });
    const [specificDate, setSpecificDate] = useState("");

    // --- CHARGEMENT INITIAL ---
    const fetchData = useCallback(async () => {
        try {
            const [resP, resD] = await Promise.all([
                axios.get("http://localhost:3000/api/patient"),
                axios.get("http://localhost:3000/api/prescription") 
            ]);
            setPatients(resP.data);
            setDemandes(resD.data);
        } catch (err) { 
            console.error("Erreur chargement", err); 
            alert("probleme de connexion internet");
        }
    }, []);

    // --- RECHERCHE DYNAMIQUE D'EXAMENS ---
    useEffect(() => {
        const delayDebounce = setTimeout(async () => {
            try {
                const res = await axios.get(`http://localhost:3000/api/prescription/catalog?q=${searchExamenModal}`);
                setExamensDispo(res.data);
            } catch (err) { console.error("Erreur catalogue", err); }
        }, 300); 

        return () => clearTimeout(delayDebounce);
    }, [searchExamenModal]);

    useEffect(() => {
        fetchData();
        const savedUser = sessionStorage.getItem("user");
        if (savedUser) {
            const userObj = JSON.parse(savedUser);
            if (userObj.nom) setMedecin(userObj.nom);
            if (userObj.role) setUserRole(userObj.role); // <-- On sauvegarde le rôle ici
        }
    }, [fetchData]);

    const voirDetails = async (demande) => {
        try {
            setDetailDemande(demande);
            const res = await axios.get(`http://localhost:3000/api/prescription/lignes/${demande.id_prescription}`);
            setLignesDetail(res.data);
        } catch (err) { console.error("Erreur détails", err); }
    };

    const handlePrint = () => {
        window.print();
    };

    const filteredDemandes = useMemo(() => {
        let result = demandes.filter((d) => {
            const dateD = new Date(d.date_prescription);
            const maintenant = new Date();
            let matchDate = true;

            if (filterPeriod === "jour") {
                matchDate = dateD.toDateString() === maintenant.toDateString();
            } else if (filterPeriod === "mois") {
                matchDate = (dateD.getMonth() === maintenant.getMonth() && dateD.getFullYear() === maintenant.getFullYear());
            } else if (filterPeriod === "annee") {
                matchDate = dateD.getFullYear() === maintenant.getFullYear();
            } else if (filterPeriod === "precise" && specificDate) {
                const selectedDate = new Date(specificDate).toDateString();
                matchDate = dateD.toDateString() === selectedDate;
            }

            const searchStr = `${d.nom} ${d.prenom} ${d.medecin}`.toLowerCase();
            return matchDate && searchStr.includes(searchTerm.toLowerCase());
        });

        result.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];
            if (sortConfig.key === "date_prescription") { aVal = new Date(aVal); bVal = new Date(bVal); }
            if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
        return result;
    }, [demandes, searchTerm, filterPeriod, specificDate, sortConfig]);

    const handlePatientChange = (id) => {
        const p = patients.find(pat => String(pat.id_patient) === String(id));
        if (p) {
            setSelectedPatient(p);
            setSearchPatient(`${p.nom} ${p.prenom}`);
            setConstantes({
                poids: p.poids || "", tension: p.tension || "",
                temperature: p.temperature || "", age: p.age || "", saturation: p.saturation || ""
            });
        }
    };

    const handleSelectExamen = (examen) => {
        setExamensChoisis(prev => {
            const exists = prev.some(e => e.id_examen_univ === examen.id_examen_univ);
            if (exists) {
                return prev.filter(e => e.id_examen_univ !== examen.id_examen_univ);
            } else {
                return [...prev, examen];
            }
        });
    };

    const enregistrerDemande = async () => {
        if (!selectedPatient || examensChoisis.length === 0) return alert("Données manquantes (Patient ou Examens)");

        try {
            const data = {
                medecin,
                examens: examensChoisis.map(e => e.id_examen_univ), 
                interpretation
            };

            if (isEditing) {
                await axios.put(`http://localhost:3000/api/prescription/update/${editingId}`, data);
            } else {
                await axios.post("http://localhost:3000/api/prescription/post", {
                    ...data,
                    id_patient: selectedPatient.id_patient
                });
            }

            setIsEditing(false);
            setEditingId(null);
            
            const savedUser = sessionStorage.getItem("user");
            setMedecin(savedUser ? JSON.parse(savedUser).nom : "");

            setExamensChoisis([]);
            setSelectedPatient(null);
            setSearchPatient("");
            setInterpretation("");

            fetchData();
            alert("Prescription médicale enregistrée avec succès !");
        } catch (err) {
            console.error(err);
            alert("Erreur serveur lors de l'enregistrement");
        }
    };

    const supprimerDemande = async (id) => {
        if (window.confirm("Voulez-vous vraiment supprimer cette prescription ?")) {
            try {
                await axios.delete(`http://localhost:3000/api/prescription/${id}`);
                fetchData();
            } catch (err) { alert("Erreur lors de la suppression"); }
        }
    };

    const preparerModification = async (demande) => {
        setIsEditing(true);
        setEditingId(demande.id_prescription);

        const p = patients.find(pat => pat.id_patient === demande.id_patient);
        setSelectedPatient(p);
        setMedecin(demande.medecin || "");
        setInterpretation(demande.motif_notes || "");

        try {
            const res = await axios.get(`http://localhost:3000/api/prescription/lignes/${demande.id_prescription}`);
            setExamensChoisis(res.data.map(l => ({
                id_examen_univ: l.id_examen_univ,
                nom: l.nom_examen,
                categorie: l.categorie
            })));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) { console.error(err);}
    };
    
    return (
        <div className="container mt-4 mb-5">
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .no-print { display: none !important; }
                    #print-modal-area, #print-modal-area * { visibility: visible; }
                    #print-modal-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .card { border: none !important; box-shadow: none !important; }
                    table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 15px; }
                    th, td { border: 1px solid #dee2e6 !important; padding: 6px !important; font-size: 12px; }
                    @page { margin: 1.5cm; }
                }
            `}</style>

            {/* --- SECTION FORMULAIRE --- */}
            <div className={`card shadow-sm p-4 border-0 mb-4 ${isEditing ? 'border-start border-warning border-5' : 'bg-light'} no-print`}>
                <h4 className={`mb-4 ${isEditing ? 'text-warning' : 'text-primary'}`}>
                    {isEditing ? `✏️ Modification Prescription #${editingId}` : '📑 Nouvelle Prescription Médicale'}
                </h4>
                <div className="row">
                    <div className="col-md-6 mb-3 position-relative">
                        <label className="form-label fw-bold">Patient</label>
                        <div className="input-group shadow-sm">
                            <span className="input-group-text bg-white border-end-0">🔍</span>
                            <input
                                type="text"
                                className="form-control border-start-0"
                                placeholder="Nom ou Prénom du patient..."
                                value={selectedPatient ? `${selectedPatient.nom} ${selectedPatient.prenom}` : searchPatient}
                                onChange={(e) => {
                                    setSearchPatient(e.target.value);
                                    if (selectedPatient) setSelectedPatient(null);
                                    setShowPatientList(true);
                                }}
                                onFocus={() => setShowPatientList(true)}
                            />
                        </div>
                        {showPatientList && !selectedPatient && searchPatient.length > 0 && (
                        <ul className="list-group position-absolute w-100 shadow-lg" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                            {patients
                            .filter(p => p.est_actif !== false) 
                            // Filtre dynamique : si rôle médecin, n'affiche que la consultation 'generaliste'
                            .filter(p => userRole === "Medecin" ? p.consultation === "generaliste" : true)
                            .filter(p => `${p.nom} ${p.prenom}`.toLowerCase().includes(searchPatient.toLowerCase()))
                            .map(p => (
                                <li 
                                    key={p.id_patient} 
                                    className="list-group-item list-group-item-action"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => {
                                        handlePatientChange(p.id_patient);
                                        setShowPatientList(false);
                                    }}
                                >
                                    <strong>{p.nom}</strong> {p.prenom} <small className="text-muted">({p.telephone})</small>
                                </li>
                            ))}
                        </ul>
                        )}
                    </div>
                    <div className="col-md-6 mb-3">
                        <label className="form-label fw-bold">Médecin Prescripteur</label>
                        <input 
                            className="form-control shadow-sm" 
                            value={medecin} 
                            onChange={e => setMedecin(e.target.value)} 
                            placeholder="Nom du médecin" 
                        />
                    </div>
                </div>

                <div className="mt-2">
                    <label className="form-label fw-bold">Prescription de medicament et explication</label>
                    <textarea 
                        className="form-control shadow-sm" 
                        rows="2" 
                        placeholder="Indications pour le laboratoire, symptômes..."
                        value={interpretation}
                        onChange={(e) => setInterpretation(e.target.value)}
                    ></textarea>
                </div>

                {examensChoisis.length > 0 && (
                    <div className="mt-3">
                        <label className="form-label fw-bold small text-muted">Examens sélectionnés :</label>
                        <div className="d-flex flex-wrap gap-2">
                            {examensChoisis.map(ex => (
                                <span key={ex.id_examen_univ} className="badge bg-primary p-2 d-flex align-items-center gap-2">
                                    {ex.nom} <button type="button" className="btn-close btn-close-white small" style={{fontSize: '0.6rem'}} onClick={() => handleSelectExamen(ex)}></button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="d-flex gap-2 mt-4">
                    <button className="btn btn-outline-primary fw-bold" data-bs-toggle="modal" data-bs-target="#modalExamenUniversel">
                        🔍 Rechercher et Ajouter un Examen ({examensChoisis.length})
                    </button>
                    <button onClick={enregistrerDemande} className={`btn ${isEditing ? 'btn-warning' : 'btn-success'} px-5 flex-grow-1 fw-bold shadow-sm`}>
                        {isEditing ? 'METTRE À JOUR LA PRESCRIPTION' : 'ENREGISTRER LA PRESCRIPTION'}
                    </button>
                </div>
            </div>

            {/* --- LE RESTE DU CODE RESTE INCHANGÉ --- */}
            <div className="card shadow-sm p-4 border-0 no-print">
                <h4 className="mb-4 text-secondary">📋 Prescriptions Médicales</h4>
                <div className="table-responsive">
                    <table className="table table-hover align-middle">
                        <thead className="table-light">
                            <tr>
                                <th>Date & Heure</th>
                                <th>Patient</th>
                                <th>Médecin Prescripteur</th>
                                <th className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDemandes.length > 0 ? filteredDemandes.map(d => (
                                <tr key={d.id_prescription}>
                                    <td className="small text-muted">{new Date(d.date_prescription).toLocaleString()}</td>
                                    <td className="fw-bold">{d.nom} {d.prenom}</td>
                                    <td>{d.medecin || "—"}</td>
                                    <td className="text-center">
                                        <div className="btn-group">
                                            <button className="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modalDetails" onClick={() => voirDetails(d)}>👁️ Voir</button>
                                            <button className="btn btn-sm btn-outline-warning" onClick={() => preparerModification(d)}>✏️</button>
                                            <button className="btn btn-sm btn-outline-danger" onClick={() => supprimerDemande(d.id_prescription)}>🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="4" className="text-center py-4 text-muted">Aucune prescription trouvée</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals obsolètes ou non modifiés cachés pour la clarté */}
            
            {/* --- MODAL : RECHERCHE DANS LE CATALOGUE --- */}
            <div className="modal fade no-print" id="modalExamenUniversel" tabIndex="-1">
                <div className="modal-dialog modal-md">
                    <div className="modal-content border-0 shadow">
                        <div className="modal-header bg-dark text-white">
                            <h5 className="modal-title font-monospace">Recherche universelle d'examens</h5>
                            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body">
                            <div className="input-group mb-3">
                                <span className="input-group-text bg-light">🔍</span>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="Tapez le nom de l'examen (Ex: NFS, Scanner, Glycémie...)" 
                                    value={searchExamenModal}
                                    onChange={(e) => setSearchExamenModal(e.target.value)}
                                />
                            </div>

                            <div style={{maxHeight: '350px', overflowY: 'auto'}}>
                                {examensDispo.length > 0 ? examensDispo.map(ex => {
                                    const isChecked = examensChoisis.some(e => e.id_examen_univ === ex.id_examen_univ);
                                    return (
                                        <div key={ex.id_examen_univ} className="d-flex justify-content-between align-items-center border-bottom py-2 px-1">
                                            <div>
                                                <div className="fw-bold text-dark">{ex.nom}</div>
                                                <span className="badge bg-light text-secondary border">{ex.categorie}</span>
                                            </div>
                                            <input 
                                                className="form-check-input" 
                                                type="checkbox" 
                                                style={{width: '1.4em', height: '1.4em', cursor: 'pointer'}} 
                                                checked={isChecked} 
                                                onChange={() => handleSelectExamen(ex)} 
                                            />
                                        </div>
                                    );
                                }) : (
                                    <p className="text-center text-muted py-3 small">Aucun examen trouvé. Saisissez un mot clé.</p>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-dark w-100 fw-bold" data-bs-dismiss="modal">
                                Valider la liste ({examensChoisis.length} sélectionné(s))
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- MODAL : DÉTAILS DE LA PRESCRIPTION + IMPRESSION --- */}
            <div className="modal fade" id="modalDetails" tabIndex="-1">
                <div className="modal-dialog modal-lg">
                    <div className="modal-content border-0 shadow">
                        <div className="modal-header bg-primary text-white no-print">
                            <h5 className="modal-title">📌 Prescription Médicale de : {detailDemande?.nom}</h5>
                            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        
                        {/* Conteneur global du corps du modal ciblé par l'impression */}
                        <div className="modal-body" id="print-modal-area">
                            {detailDemande && (
                                <>
                                    {/* --- TON ENTÊTE D'IMPRESSION --- */}
                                    <div className="d-none d-print-block p-1">
                                        <div className="row align-items-center border-bottom pb-3">
                                            <div className="col-4">
                                                <div className="d-flex align-items-center">
                                                    {/* Vérifiez que la variable "Logo" contient votre image */}
                                                    {typeof Logo !== 'undefined' && <img src={Logo} style={{ width: '80px' }} alt="Logo" />}
                                                    <h4 className="fw-bold text-uppercase ms-2 mb-0">destiny express</h4>
                                                </div>
                                                <p className="small mb-0 mt-2">votre santé notre priorité</p>
                                                <p className="small mb-0">Tél : +242 XX XXX XX XX</p>
                                            </div>
                                            <div className="col-4 text-center">
                                                <h2 className="text-uppercase fw-bold">Rapport</h2>
                                            </div>
                                            <div className="col-4 text-end">
                                                <p className="mb-0">Date d'édition : {new Date().toLocaleDateString()}</p>
                                                <p className="mb-0">Heure : {new Date().toLocaleTimeString()}</p>
                                            </div>
                                        </div>

                                        {/* BLOC INFOS PATIENT INTÉGRÉ AVEC LES PARAMÈTRES DU COMPOSANT */}
                                        <div className="row my-3 p-2 bg-light rounded border" style={{ fontSize: "14px" }}>
                                            <div className="col-6">
                                                <p className="mb-1"><strong>Nom & Prénom :</strong> {detailDemande.nom} {detailDemande.prenom}</p>
                                                <p className="mb-0"><strong>Date de la demande :</strong> {detailDemande.date_prescription ? new Date(detailDemande.date_prescription).toLocaleDateString() : "-"}</p>
                                            </div>
                                            <div className="col-6 text-end">
                                                <p className="mb-1"><strong>Médecin :</strong> {detailDemande.medecin || "-"}</p>
                                                <p className="mb-0"><strong>ID :</strong> #{detailDemande.id_prescription}</p>
                                            </div>
                                        </div>

                                        <h3 className="text-center mt-3 text-decoration-underline mb-4">SERVICE LABORATOIRE</h3>
                                    </div>

                                    {/* --- CONTENU DU MODAL POUR L'ECRAN (Aperçu) --- */}
                                    <div className="row g-3 mb-4 p-3 bg-light rounded border no-print">
                                        <div className="col-6"><strong>Patient:</strong> {detailDemande.nom} {detailDemande.prenom}</div>
                                        <div className="col-6"><strong>Prescripteur:</strong> {detailDemande.medecin}</div>
                                        <div className="col-6"><strong>Date:</strong> {new Date(detailDemande.date_prescription).toLocaleString()}</div>
                                        <div className="col-12"><strong>Motif clinique:</strong> <p className="mb-0 text-muted">{detailDemande.motif_notes || "Aucun motif spécifié"}</p></div>
                                    </div>
                                    
                                    {/* --- TABLEAU DES EXAMENS (Visible à l'écran et à l'impression) --- */}
                                    <h6 className="fw-bold border-bottom pb-2">🧪 Examens prescrits</h6>
                                    <table className="table table-striped table-bordered mt-2">
                                        <thead>
                                            <tr>
                                                <th>Nom de l'examen</th>
                                                <th>Catégorie</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lignesDetail.map((l, i) => (
                                                <tr key={i}>
                                                    <td>{l.nom_examen}</td>
                                                    <td><span className="badge bg-secondary d-print-none">{l.categorie}</span><span className="d-none d-print-inline">{l.categorie}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {detailDemande.motif_notes && (
                                        <div className="d-none d-print-block mt-4">
                                            <strong>Renseignements cliniques :</strong>
                                            <p className="text-muted p-2 border rounded bg-light">{detailDemande.motif_notes}</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        
                        {/* Pied de page du modal avec le bouton d'impression */}
                        <div className="modal-footer bg-light no-print">
                            <button className="btn btn-primary px-4 fw-bold me-auto" onClick={handlePrint}>
                                🖨️ Imprimer la fiche
                            </button>
                            <button className="btn btn-secondary px-4" data-bs-dismiss="modal">Fermer</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DemandeExamen;
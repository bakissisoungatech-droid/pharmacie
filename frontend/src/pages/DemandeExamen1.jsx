import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

function DemandeExamen() {
  const [patients, setPatients] = useState([]);
  const [examensDispo, setExamensDispo] = useState([]);
  const [demandes, setDemandes] = useState([]);
  const [searchPatient, setSearchPatient] = useState("");
  const [showPatientList, setShowPatientList] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // --- États Formulaire ---
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [medecin, setMedecin] = useState("");
  const [examensChoisis, setExamensChoisis] = useState([]);
  const [searchExamenModal, setSearchExamenModal] = useState("");
  const [constantes, setConstantes] = useState({
    poids: "", tension: "", temperature: "", age: "", saturation: ""
  });

  // --- État Détails (Nouveau) ---
  const [detailDemande, setDetailDemande] = useState(null);
  const [lignesDetail, setLignesDetail] = useState([]);

  // --- États Liste (Recherche, Filtre, Tri) ---
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("tous");
  const [sortConfig, setSortConfig] = useState({ key: "date_demande", direction: "desc" });

  const [specificDate, setSpecificDate] = useState(""); // Pour le calendrier

  const fetchData = useCallback(async () => {
    try {
      const [resP, resE, resD] = await Promise.all([
        axios.get("http://localhost:3000/api/patient"),
        axios.get("http://localhost:3000/api/examen"),
        axios.get("http://localhost:3000/api/demande_examen1/affiches")
      ]);
      setPatients(resP.data);
      setExamensDispo(resE.data);
      setDemandes(resD.data);
    } catch (err) { console.error("Erreur chargement", err); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fonction ager charger les détails d'une demande
  const voirDetails = async (demande) => {
    try {
      setDetailDemande(demande);
      const res = await axios.get(`http://localhost:3000/api/demande_examen1/lignes/${demande.id_demande}`);
      setLignesDetail(res.data);
      // Déclenchement manuel du modal si nécessaire (ou via data-bs-toggle)
    } catch (err) { console.error("Erreur détails", err); }
  };

  // Calcule le total des examens pour l'affichage dans le modal
  const totalDemande = useMemo(() => {
    return lignesDetail.reduce((sum, ligne) => sum + Number(ligne.prix_applique || 0), 0);
  }, [lignesDetail]);

  const filteredDemandes = useMemo(() => {
    let result = demandes.filter((d) => {
      const dateD = new Date(d.date_demande);
      const maintenant = new Date();
      let matchDate = true;

      // --- Filtre par Période ---
      if (filterPeriod === "jour") {
        matchDate = dateD.toDateString() === maintenant.toDateString();
      } else if (filterPeriod === "mois") {
        matchDate = (dateD.getMonth() === maintenant.getMonth() && dateD.getFullYear() === maintenant.getFullYear());
      } else if (filterPeriod === "annee") {
        matchDate = dateD.getFullYear() === maintenant.getFullYear();
      } 
      // --- NOUVEAU : Filtre par Date Précise ---
      else if (filterPeriod === "precise" && specificDate) {
        const selectedDate = new Date(specificDate).toDateString();
        matchDate = dateD.toDateString() === selectedDate;
      }

      const searchStr = `${d.nom} ${d.prenom} ${d.medecin}`.toLowerCase();
      return matchDate && searchStr.includes(searchTerm.toLowerCase());
    });

    // Logique de tri (reste identique)
    result.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (sortConfig.key === "date_demande") { aVal = new Date(aVal); bVal = new Date(bVal); }
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [demandes, searchTerm, filterPeriod, specificDate, sortConfig]);
  const handlePatientChange = (id) => {
  // On compare en String pour éviter les soucis de type
  const p = patients.find(pat => String(pat.id_patient) === String(id));
    if (p) {
      setSelectedPatient(p);
      setSearchPatient(`${p.nom} ${p.prenom}`); // On met à jour le texte affiché
      setConstantes({
        poids: p.poids || "", 
        tension: p.tension || "",
        temperature: p.temperature || "", 
        age: p.age || "", 
        saturation: p.saturation || ""
      });
    }
  };

  const toggleExamen = (id) => {
    setExamensChoisis(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Supprimer
  const supprimerDemande = async (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer cette demande ?")) {
      try {
        await axios.delete(`http://localhost:3000/api/demande_examen1/${id}`);
        fetchData(); // Rafraîchir la liste
      } catch (err) { alert("Erreur lors de la suppression"); }
    }
  };

  // Préparer la modification (remplit le formulaire avec les données existantes)
  const preparerModification = async (demande) => {
    setIsEditing(true);
    setEditingId(demande.id_demande);
    
    // On retrouve le patient
    const p = patients.find(pat => pat.id_patient === demande.id_patient);
    setSelectedPatient(p);
    setMedecin(demande.medecin);

    // On récupère les examens actuels ager cocher les cases
    try {
      const res = await axios.get(`http://localhost:3000/api/demande_examen1/lignes/${demande.id_demande}`);
      setExamensChoisis(res.data.map(l => l.id_examen));
      // On remonte en haut de page ager voir le formulaire
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { console.error(err); }
  };

  // Enregistrer (Création OU Modification)
  const enregistrerDemande = async () => {
    if (!selectedPatient || examensChoisis.length === 0) return alert("Données manquantes");
    
    try {
      if (isEditing) {
        await axios.put(`http://localhost:3000/api/demande_examen1/update/${editingId}`, {
          medecin, examens: examensChoisis
        });
        alert("Demande mise à jour !");
      } else {
        await axios.post("http://localhost:3000/api/demande_examen1/post1", {
          id_patient: selectedPatient.id_patient,
          medecin, constantes, examens: examensChoisis
        });
        alert("Demande enregistrée !");
      }
      
      // Reset total
      setIsEditing(false);
      setEditingId(null);
      setExamensChoisis([]);
      setMedecin("");
      setSelectedPatient(null);
      fetchData();
    } catch (err) { alert("Erreur serveur"); }
  };

  return (
    <div className="container mt-4 mb-5">
      {/* SECTION FORMULAIRE (Modifiée ager afficher l'état Edition) */}
      <div className={`card shadow-sm p-4 border-0 mb-4 ${isEditing ? 'border-start border-warning border-5' : 'bg-light'}`}>
        <h4 className={`mb-4 ${isEditing ? 'text-warning' : 'text-primary'}`}>
          {isEditing ? `✏️ Modification Demande #${editingId}` : '📑 Nouvelle Demande d\'Analyses'}
        </h4>
        <div className="row">
          <div className="col-md-6 mb-3 position-relative">
            <label className="form-label fw-bold">Patient</label>
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0">🔍</span>
              <input
                type="text"
                className="form-control shadow-sm border-start-0"
                placeholder="Taper le nom du patient..."
                // On affiche le nom si sélectionné, sinon ce que l'utilisateur tape
                value={selectedPatient ? `${selectedPatient.nom} ${selectedPatient.prenom}` : searchPatient}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchPatient(val);
                  // Important : Ne mettre à null QUE si la valeur est différente du nom sélectionné
                  if (selectedPatient && val !== `${selectedPatient.nom} ${selectedPatient.prenom}`) {
                    setSelectedPatient(null);
                  }
                  setShowPatientList(true);
                }}
                onFocus={() => setShowPatientList(true)}
              />
              {selectedPatient && (
                <button className="btn btn-outline-danger" onClick={() => {setSelectedPatient(null); setSearchPatient("");}}>✕</button>
              )}
            </div>

            {/* Liste déroulante personnalisée */}
            {showPatientList && !selectedPatient && searchPatient.length > 0 && (
              <ul className="list-group position-absolute w-100 shadow-lg" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                {patients
                  .filter(p => `${p.nom} ${p.prenom}`.toLowerCase().includes(searchPatient.toLowerCase()))
                  .map(p => (
                    <li 
                      key={p.id_patient} 
                      className="list-group-item list-group-item-action"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        handlePatientChange(p.id_patient); // Appel direct avec l'ID
                        setShowPatientList(false);
                      }}
                    >
                      <strong>{p.nom}</strong> {p.prenom} <small className="text-muted">({p.telephone})</small>
                    </li>
                  ))}
                  {patients.filter(p => `${p.nom} ${p.prenom}`.toLowerCase().includes(searchPatient.toLowerCase())).length === 0 && (
                    <li className="list-group-item disabled">Aucun patient trouvé</li>
                  )}
              </ul>
            )}
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label fw-bold">Médecin Prescripteur</label>
            <input className="form-control shadow-sm" value={medecin} onChange={e=>setMedecin(e.target.value)} placeholder="Nom du médecin" />
          </div>
        </div>
        {selectedPatient && (
          <div className="alert alert-white border shadow-sm mt-2">
            <div className="row g-3">
               <div className="col-md-3"><strong>Poids:</strong> <input className="form-control form-control-sm" value={constantes.poids} onChange={e=>setConstantes({...constantes, poids: e.target.value})}/></div>
               <div className="col-md-3"><strong>Tension:</strong> <input className="form-control form-control-sm" value={constantes.tension} onChange={e=>setConstantes({...constantes, tension: e.target.value})}/></div>
               <div className="col-md-3"><strong>Temp:</strong> <input className="form-control form-control-sm" value={constantes.temperature} onChange={e=>setConstantes({...constantes, temperature: e.target.value})}/></div>
               <div className="col-md-3"><strong>age:</strong> <input className="form-control form-control-sm" value={constantes.age} onChange={e=>setConstantes({...constantes, age: e.target.value})}/></div>
            </div>
          </div>
        )}
        <div className="d-flex gap-2 mt-3">
          <button className="btn btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modalExamen">
            ➕ Choisir Examens ({examensChoisis.length})
          </button>
          
          <button onClick={enregistrerDemande} className={`btn ${isEditing ? 'btn-warning' : 'btn-success'} px-5 flex-grow-1 fw-bold`}>
            {isEditing ? 'METTRE À JOUR' : 'VALIDER LA DEMANDE'}
          </button>

          {isEditing && (
            <button className="btn btn-secondary" onClick={() => { setIsEditing(false); setMedecin(""); setExamensChoisis([]); setSelectedPatient(null); }}>
              Annuler
            </button>
          )}
        </div>
      </div>

      {/* SECTION HISTORIQUE AVEC FILTRES ET TRI */}
      <div className="card shadow-sm p-4">
        <h4 className="mb-4">📋 Historique des Demandes</h4>
        
        <div className="row g-2 mb-3 align-items-end">
          {/* Recherche textuelle */}
          <div className="col-md-3">
            <label className="form-label small fw-bold">Recherche rapide</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Patient, médecin..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>

          {/* Sélecteur de type de période */}
          <div className="col-md-3">
            <label className="form-label small fw-bold">Période</label>
            <select className="form-select" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
              <option value="tous">Toutes les périodes</option>
              <option value="jour">Aujourd'hui</option>
              <option value="mois">Ce mois-ci</option>
              <option value="precise">Date précise 📅</option>
            </select>
          </div>

          {/* Champ Date précise (Affiche seulement si "Date précise" est sélectionné) */}
          {filterPeriod === "precise" && (
            <div className="col-md-3 animate__animated animate__fadeIn">
              <label className="form-label small fw-bold">Choisir le jour</label>
              <input 
                type="date" 
                className="form-control border-primary" 
                value={specificDate} 
                onChange={e => setSpecificDate(e.target.value)} 
              />
            </div>
          )}

          <div className="col-md-3 ms-auto text-end">
            <button onClick={() => window.print()} className="btn btn-dark w-100">🖨️ Imprimer</button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle border">
            <thead className="table-dark">
              <tr>
                {/* En-têtes cliquables pour le tri */}
                <th onClick={() => setSortConfig({ key: 'date_demande', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} style={{ cursor: 'pointer' }}>
                  Date {sortConfig.key === 'date_demande' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕️'}
                </th>
                <th onClick={() => setSortConfig({ key: 'nom', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} style={{ cursor: 'pointer' }}>
                  Patient {sortConfig.key === 'nom' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕️'}
                </th>
                <th>Médecin</th>
                <th>Statut</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDemandes.length > 0 ? (
                filteredDemandes.map(d => (
                  <tr key={d.id_demande}>
                    <td className="small">{new Date(d.date_demande).toLocaleString('fr-FR')}</td>
                    <td>
                      <span className="fw-bold text-uppercase">{d.nom}</span> {d.prenom}
                    </td>
                    <td>{d.medecin || <em className="text-muted">Non spécifié</em>}</td>
                    <td>
                      <span className={`badge ${d.statut === 'nouveau' ? 'bg-info' : 'bg-success'}`}>
                        {d.statut}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="btn-group shadow-sm">
                        <button className="btn btn-sm btn-primary" data-bs-toggle="modal" data-bs-target="#modalDetails" onClick={() => voirDetails(d)} title="Voir détails">
                          👁️
                        </button>
                        <button className="btn btn-sm btn-warning" onClick={() => preparerModification(d)} title="Modifier">
                          ✏️
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => supprimerDemande(d.id_demande)} title="Supprimer">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-muted">
                    Aucune demande trouvée pour ces critères.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="small text-muted mt-2">
          Affichage de <strong>{filteredDemandes.length}</strong> résultat(s) sur {demandes.length}
        </div>
      </div>

      {/* MODAL 1 : SÉLECTION EXAMENS (Identique) */}
      <div className="modal fade" id="modalExamen" tabIndex="-1">
        <div className="modal-dialog modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-dark text-white">
              <h5 className="modal-title">Catalogue des examens</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div className="p-2 border-bottom">
              <input type="text" className="form-control" placeholder="🔍 Rechercher..." value={searchExamenModal} onChange={e=>setSearchExamenModal(e.target.value)} />
            </div>
            <div className="modal-body">
              {examensDispo.filter(ex => ex.nom_examen.toLowerCase().includes(searchExamenModal.toLowerCase())).map(ex => (
                <div key={ex.id_examen} className="d-flex justify-content-between border-bottom py-2 px-1">
                  <label htmlFor={`ex-${ex.id_examen}`}>{ex.nom_examen}</label>
                  <input className="form-check-input" type="checkbox" id={`ex-${ex.id_examen}`} checked={examensChoisis.includes(ex.id_examen)} onChange={() => toggleExamen(ex.id_examen)} />
                </div>
              ))}
            </div>
            <div className="modal-footer"><button className="btn btn-primary w-100" data-bs-dismiss="modal">Terminer</button></div>
          </div>
        </div>
      </div>

      {/* MODAL 2 : DÉTAILS DE LA DEMANDE (NOUVEAU) */}
      <div className="modal fade" id="modalDetails" tabIndex="-1">
        <div className="modal-dialog modal-lg shadow-lg">
          <div className="modal-content border-0">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">📌 Détails de la Demande #{detailDemande?.id_demande}</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              {detailDemande && (
                <>
                  <div className="row mb-4 bg-light p-3 rounded mx-1">
                    <div className="col-md-6">
                      <p className="mb-1 text-muted small text-uppercase fw-bold">Patient</p>
                      <h5>{detailDemande.nom} {detailDemande.prenom}</h5>
                      <p className="mb-0">Date : {new Date(detailDemande.date_demande).toLocaleString()}</p>
                    </div>
                    <div className="col-md-6 text-md-end border-start">
                      <p className="mb-1 text-muted small text-uppercase fw-bold">Médecin Prescripteur</p>
                      <h5>{detailDemande.medecin || "Non spécifié"}</h5>
                      <span className="badge bg-warning text-dark">Statut : {detailDemande.statut}</span>
                    </div>
                  </div>

                  <h6 className="fw-bold mb-3 border-bottom pb-2">🧪 Examens demandés</h6>
                  <div className="list-group list-group-flush mb-4">
                    {lignesDetail.map((l, index) => (
                      <div key={index} className="list-group-item d-flex justify-content-between align-items-center bg-transparent border-0 px-0">
                        <span><i className="bi bi-check2-circle text-success me-2"></i> {l.nom_examen}</span>
                        {/* Affichage du prix de la ligne */}
                        <span className="fw-bold">{Number(l.prix_applique).toLocaleString()} FCFA</span>
                      </div>
                    ))}
                  </div>

                  {/* Affichage du TOTAL */}
                  <div className="d-flex justify-content-between p-3 bg-dark text-white rounded">
                    <h5 className="mb-0">MONTANT TOTAL :</h5>
                    <h5 className="mb-0">{totalDemande.toLocaleString()} FCFA</h5>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer bg-light">
              <button className="btn btn-dark" onClick={() => window.print()}>🖨️ Imprimer la fiche</button>
              <button className="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DemandeExamen;
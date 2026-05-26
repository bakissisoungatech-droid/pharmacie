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
  const [examensChoisis, setExamensChoisis] = useState([]); // Tableau d'ID normalisés en String
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
  const [sortConfig, setSortConfig] = useState({ key: "date_demande", direction: "desc" });
  const [specificDate, setSpecificDate] = useState("");
  const [prescriptionId, setPrescriptionId] = useState("");

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
    } catch (err) { 
      console.error("Erreur chargement", err); 
      alert("Problème de connexion internet ou serveur indisponible");
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const voirDetails = async (demande) => {
    try {
      setDetailDemande(demande);
      const res = await axios.get(`http://localhost:3000/api/demande_examen1/lignes/${demande.id_demande}`);
      setLignesDetail(res.data);
    } catch (err) { console.error("Erreur détails", err); }
  };

  const totalDemande = useMemo(() => {
    return lignesDetail.reduce((sum, ligne) => sum + Number(ligne.prix_applique || 0), 0);
  }, [lignesDetail]);

  const filteredDemandes = useMemo(() => {
    let result = demandes.filter((d) => {
      const dateD = new Date(d.date_demande);
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
      if (sortConfig.key === "date_demande") { aVal = new Date(aVal); bVal = new Date(bVal); }
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
        poids: p.poids || "", 
        tension: p.tension || "",
        temperature: p.temperature || "", 
        age: p.age || "", 
        saturation: p.saturation || ""
      });
    }
  };

  const toggleExamen = (id) => {
    const idStr = String(id).trim();
    setExamensChoisis(prev => 
      prev.includes(idStr) ? prev.filter(i => i !== idStr) : [...prev, idStr]
    );
  };

  const supprimerDemande = async (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer cette demande ?")) {
      try {
        await axios.delete(`http://localhost:3000/api/demande_examen1/${id}`);
        fetchData();
      } catch (err) { alert("Erreur lors de la suppression"); }
    }
  };

  const preparerModification = async (demande) => {
    setIsEditing(true);
    setEditingId(demande.id_demande);
    
    const p = patients.find(pat => String(pat.id_patient) === String(demande.id_patient));
    if (p) {
      setSelectedPatient(p);
      setSearchPatient(`${p.nom} ${p.prenom}`);
      setConstantes({
        poids: p.poids || "", 
        tension: p.tension || "",
        temperature: p.temperature || "", 
        age: p.age || "", 
        saturation: p.saturation || ""
      });
    }

    setMedecin(demande.medecin || "");

    try {
      const res = await axios.get(`http://localhost:3000/api/demande_examen1/lignes/${demande.id_demande}`);
      const idsFormatte = res.data.map(l => String(l.id_examen || l.id_examen_univ || "").trim()).filter(Boolean);
      setExamensChoisis(idsFormatte);
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { 
      console.error("Erreur récup examens pour modif:", err); 
    }
  };

  const enregistrerDemande = async () => {
    if (!selectedPatient || examensChoisis.length === 0) {
      return alert("Veuillez sélectionner un patient et au moins un examen.");
    }
    
    try {
      const payload = {
        id_patient: selectedPatient.id_patient,
        medecin,
        examens: examensChoisis,
        interpretation: "" 
      };

      if (isEditing) {
        await axios.put(`http://localhost:3000/api/demande_examen1/update/${editingId}`, payload);
        alert("Demande mise à jour avec succès !");
      } else {
        await axios.post("http://localhost:3000/api/demande_examen1/post1", payload);
        alert("Nouvelle demande enregistrée !");
      }
      
      setIsEditing(false);
      setEditingId(null);
      setExamensChoisis([]);
      setMedecin("");
      setSearchPatient("");
      setSelectedPatient(null);
      fetchData();
    } catch (err) { 
      console.error(err);
      alert("Erreur lors de l'enregistrement : " + (err.response?.data?.error || err.message)); 
    }
  };

  // --- ALGORITHME DE CORRESPONDANCE PHONÉTIQUE ET TEXTUELLE AVANCÉE ---
  
  const nettoyerTexte = (str) => {
    if (!str) return "";
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
      .replace(/[^a-z0-9 ]/g, "") // Enlève la ponctuation facultative
      .trim();
  };

  const calculerSimilitudeLevenshtein = (str1, str2) => {
    const s1 = nettoyerTexte(str1);
    const s2 = nettoyerTexte(str2);

    if (s1 === s2) return 1.0; 
    
    // RÈGLE DE CONTINUITÉ GRÂCE À L'ESPACE (Restriction n°2)
    // Si l'un des mots est le prolongement exact de l'autre séparé ou suivi par un espace
    if (s1.includes(s2 + " ") || s1.includes(" " + s2) || s2.includes(s1 + " ") || s2.includes(" " + s1)) {
      return 0.95; // Score très élevé accordé pour la continuité spatiale
    }

    // Inclusion simple brute
    if (s1.includes(s2) || s2.includes(s1)) return 0.90; 

    // Calcul Levenshtein classique
    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;

    for (let j = 1; j <= s2.length; j += 1) {
      for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, 
          track[j - 1][i] + 1, 
          track[j - 1][i - 1] + indicator 
        );
      }
    }
    
    const distance = track[s2.length][s1.length];
    const longueurMax = Math.max(s1.length, s2.length);
    return (longueurMax - distance) / longueurMax; 
  };

  // --- RECHERCHE INTELLIGENTE AVEC VOS RESTRICTIONS ---
  const chargerPrescription = async (id) => {
    if (!id || typeof id !== 'string' || !id.trim()) {
      alert("Veuillez saisir ou sélectionner un ID de prescription valide.");
      return;
    }
    
    try {
      const response = await axios.get(`http://localhost:3000/api/prescription/lignes/${id.trim()}`);
      const lignesPrescription = response.data;

      if (!lignesPrescription || lignesPrescription.length === 0) {
        alert("Aucun examen trouvé pour cette prescription ou l'ID n'existe pas.");
        return;
      }

      const examensTrouvesIds = [];
      let examensNomsSelectionnes = []; // Pour énumérer dans le alert
      let examensNonReconnus = [];

      lignesPrescription.forEach(ligne => {
        const nomPrescrip = ligne.nom_examen;
        const nomPrescripNettoye = nettoyerTexte(nomPrescrip);
        
        let meilleurMatch = null;
        let scoreMax = 0;

        examensDispo.forEach(ex => {
          if (ex.est_actif === false) return;
          
          const nomCatalogNettoye = nettoyerTexte(ex.nom_examen);
          const score = calculerSimilitudeLevenshtein(ex.nom_examen, nomPrescrip);
          
          if (score > scoreMax) {
            scoreMax = score;
            meilleurMatch = ex;
          }
        });

        // RÈGLE DE STRICT CORRESPONDANCE DE LONGUEUR POUR LES MOTS COURTS (Restriction n°1)
        // Empêche de valider un faux positif si les longueurs divergent totalement sans continuité d'espace
        if (meilleurMatch) {
          const nomMatchNettoye = nettoyerTexte(meilleurMatch.nom_examen);
          
          // Si le terme fait moins de 5 caractères (ex: NFS, CRP) et que les longueurs ne matchent pas exactement
          // ET qu'il n'y a pas de continuité directe par espace, on rejette.
          if (nomPrescripNettoye.length <= 5 && nomPrescripNettoye.length !== nomMatchNettoye.length) {
            if (!nomMatchNettoye.includes(nomPrescripNettoye + " ") && !nomMatchNettoye.includes(" " + nomPrescripNettoye)) {
              scoreMax = 0; // On force l'annulation de la sélection
            }
          }
        }

        // SEUIL DE TOLÉRANCE
        if (meilleurMatch && scoreMax >= 0.65) {
          examensTrouvesIds.push(String(meilleurMatch.id_examen).trim());
          examensNomsSelectionnes.push(meilleurMatch.nom_examen); // Stockage pour l'alerte
        } else {
          examensNonReconnus.push(nomPrescrip || "Examen sans nom");
        }
      });
      
      // Assigne les IDs à l'état
      setExamensChoisis(examensTrouvesIds);

      // Charge le reste des informations si disponibles
      if (lignesPrescription[0].id_patient) {
        handlePatientChange(lignesPrescription[0].id_patient);
      }
      if (lignesPrescription[0].medecin) {
        setMedecin(lignesPrescription[0].medecin); 
      }

      // --- COMPOSITION DES ALERTES AVEC ÉNUMÉRATION ---
      const listeSelectionnes = examensNomsSelectionnes.length > 0 
        ? `\n- ${examensNomsSelectionnes.join('\n- ')}` 
        : "Aucun";

      if (examensNonReconnus.length > 0) {
        alert(`⚠️ Prescription chargée partiellement.\n\n✅ EXAMENS SÉLECTIONNÉS :${listeSelectionnes}\n\n❌ NON RECONNUS (Écart ou longueur incorrecte) :\n- ${examensNonReconnus.join('\n- ')}`);
      } else {
        alert(`✅ ${examensTrouvesIds.length} examen(s) identifié(s) et chargé(s) avec succès !\n\nEXAMENS RETENUS :${listeSelectionnes}`);
      }

      document.getElementById("closePrescriptionModal")?.click();
      setPrescriptionId("");

    } catch (err) {
      console.error("Erreur lors du chargement de la prescription :", err);
      alert("Impossible de joindre le serveur ou l'ID de prescription est introuvable.");
    }
  };
  
  return (
    <div className="container mt-4 mb-5">
      <style>{`
        @media print {
          .no-print, form, .alert { display: none !important; }
          @page { margin: 1cm; }
          .container { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
          table { width: 100% !important; border-collapse: collapse !important; font-size: 12px; }
          th, td { border: 1px solid #000 !important; padding: 8px !important; }
          .badge { border: 1px solid #ccc !important; color: #000 !important; background: transparent !important; }
        }
      `}</style>

      {/* EN-TÊTE D'IMPRESSION */}
      <div className="d-none d-print-block mb-4">
        <div className="row align-items-center border-bottom pb-3">
          <div className="col-4">
            <h4 className="fw-bold mb-0">destiny express</h4>
            <p className="small mb-0">ggfs hjjkkdf</p>
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
      </div>

      {/* SECTION FORMULAIRE */}
      <div className={`card no-print shadow-sm p-4 border-0 mb-4 ${isEditing ? 'border-start border-warning border-5' : 'bg-light'}`}>
        <h4 className={`mb-4 ${isEditing ? 'text-warning' : 'text-primary'}`}>
          {isEditing ? `✏️ Modification Demande #${editingId}` : '📑 Nouvelle Demande d\'Analyses'}
        </h4>
        <button type="button" className="btn btn-outline-info mb-3" data-bs-toggle="modal" data-bs-target="#modalPrescription">
          🔌 Charger depuis une Prescription
        </button>
        <div className="row no-print">
          <div className="col-md-6 mb-3 position-relative">
            <label className="form-label fw-bold">Patient</label>
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0">🔍</span>
              <input
                type="text"
                className="form-control shadow-sm border-start-0"
                placeholder="Taper le nom du patient..."
                value={searchPatient} 
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchPatient(val);
                  setShowPatientList(true);
                  if (selectedPatient && val !== `${selectedPatient.nom} ${selectedPatient.prenom}`) {
                    setSelectedPatient(null);
                  }
                }}
                onFocus={() => setShowPatientList(true)}
              />
              {selectedPatient && (
                <button className="btn btn-outline-danger" onClick={() => {setSelectedPatient(null); setSearchPatient("");}}>✕</button>
              )}
            </div>

            {showPatientList && !selectedPatient && searchPatient.length > 0 && (
              <ul className="list-group position-absolute w-100 shadow-lg" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                {patients
                  .filter(p => p.est_actif !== false) 
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
                {patients.filter(p => p.est_actif !== false && `${p.nom} ${p.prenom}`.toLowerCase().includes(searchPatient.toLowerCase())).length === 0 && (
                  <li className="list-group-item disabled">Aucun patient actif trouvé</li>
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
               <div className="col-md-3"><strong>Age:</strong> <input className="form-control form-control-sm" value={constantes.age} onChange={e=>setConstantes({...constantes, age: e.target.value})}/></div>
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
            <button className="btn btn-secondary" onClick={() => { setIsEditing(false); setMedecin(""); setExamensChoisis([]); setSelectedPatient(null); setSearchPatient(""); }}>
              Annuler
            </button>
          )}
        </div>
      </div>

      {/* SECTION HISTORIQUE */}
      <div className="card shadow-sm p-4">
        <h4 className="mb-4">📋 Historique des Demandes</h4>
        
        <div className="row g-2 mb-3 align-items-end no-print">
          <div className="col-md-3">
            <label className="form-label small fw-bold">Recherche rapide</label>
            <input type="text" className="form-control" placeholder="Patient, médecin..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          <div className="col-md-3 no-print">
            <label className="form-label small fw-bold">Période</label>
            <select className="form-select" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
              <option value="tous">Toutes les périodes</option>
              <option value="jour">Aujourd'hui</option>
              <option value="mois">Ce mois-ci</option>
              <option value="precise">Date précise 📅</option>
            </select>
          </div>

          {filterPeriod === "precise" && (
            <div className="col-md-3">
              <label className="form-label small fw-bold">Choisir le jour</label>
              <input type="date" className="form-control border-primary" value={specificDate} onChange={e => setSpecificDate(e.target.value)} />
            </div>
          )}

          <div className="col-md-3 ms-auto text-end no-print">
            <button onClick={() => window.print()} className="btn btn-dark w-100">🖨️ Imprimer</button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle border">
            <thead className="table-dark">
              <tr>
                <th onClick={() => setSortConfig({ key: 'date_demande', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} style={{ cursor: 'pointer' }}>
                  Date {sortConfig.key === 'date_demande' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕️'}
                </th>
                <th onClick={() => setSortConfig({ key: 'nom', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} style={{ cursor: 'pointer' }}>
                  Patient {sortConfig.key === 'nom' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕️'}
                </th>
                <th>Médecin</th>
                <th className="no-print">Statut</th>
                <th className="text-center no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDemandes.length > 0 ? (
                filteredDemandes.map(d => (
                  <tr key={d.id_demande}>
                    <td className="small">{new Date(d.date_demande).toLocaleString('fr-FR')}</td>
                    <td><span className="fw-bold text-uppercase">{d.nom}</span> {d.prenom}</td>
                    <td>{d.medecin || <em className="text-muted">Non spécifié</em>}</td>
                    <td className="no-print">
                      <span className={`badge ${d.statut === 'nouveau' ? 'bg-info' : 'bg-success'}`}>{d.statut}</span>
                    </td>
                    <td className="text-center no-print">
                      <div className="btn-group shadow-sm">
                        <button className="btn btn-sm btn-primary" data-bs-toggle="modal" data-bs-target="#modalDetails" onClick={() => voirDetails(d)}>👁️</button>
                        <button className="btn btn-sm btn-warning" onClick={() => preparerModification(d)}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => supprimerDemande(d.id_demande)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" className="text-center py-4 text-muted">Aucune demande trouvée.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1 : SÉLECTION EXAMENS */}
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
              {examensDispo.filter(ex => ex.nom_examen.toLowerCase().includes(searchExamenModal.toLowerCase()) && ex.est_actif !== false)
                .map(ex => (
                  <div key={ex.id_examen} className="d-flex justify-content-between border-bottom py-2 px-1">
                    <label htmlFor={`ex-${ex.id_examen}`}>{ex.nom_examen}</label>
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      id={`ex-${ex.id_examen}`} 
                      checked={examensChoisis.includes(String(ex.id_examen).trim())} 
                      onChange={() => toggleExamen(ex.id_examen)} 
                    />
                  </div>
                ))}
            </div>
            <div className="modal-footer"><button className="btn btn-primary w-100" data-bs-dismiss="modal">Terminer</button></div>
          </div>
        </div>
      </div>

      {/* MODAL 2 : DÉTAILS */}
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
                        <span>{l.nom_examen}</span>
                        <span className="fw-bold">{Number(l.prix_applique).toLocaleString()} FCFA</span>
                      </div>
                    ))}
                  </div>
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

      {/* MODAL 3 : PRESCRIPTION */}
      <div className="modal fade" id="modalPrescription" tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content border-0 shadow">
            <div className="modal-header bg-info text-white">
              <h5 className="modal-title">🔌 Importer une Prescription</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" id="closePrescriptionModal"></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label fw-bold">ID de la Prescription</label>
                <input type="text" className="form-control shadow-sm" value={prescriptionId} onChange={(e) => setPrescriptionId(e.target.value)} placeholder="Saisir l'ID..." />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
              <button type="button" className="btn btn-info" onClick={() => chargerPrescription(prescriptionId)}>⚡ Charger la prescription</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DemandeExamen;
import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import socket from "../socket";
import Logo from "../assets/logo.png";


function PatientsCRUD() {
  const [data, setData] = useState([]);
  const [listeAbonnements, setListeAbonnements] = useState([]);
  const [listeConsultation, setListeConsultation] = useState([]);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState("Masculin");
  const [telephone, setTelephone] = useState("");
  const [idAbonnement, setIdAbonnement] = useState("");
  const [idConsultation, setIdConsultation] = useState("");
  const [editId, setEditId] = useState(null);

  // --- Nouveaux états : Recherche, Filtres et Tri ---
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("tous");
  const [selectedDate, setSelectedDate] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "date_creation", direction: "desc" });

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Récupérer et parser l'objet stocké dans Login
    const storedUser = sessionStorage.getItem("user");
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Erreur de lecture du sessionStorage", e);
      }
    }
  }, []);  

  const loadPatients = useCallback(async () => {
    try {
      const r = await axios.get(`http://localhost:3000/api/patient/`);
      setData(r.data);
    } catch (error) {
      console.error("Erreur patients", error);
      alert("probleme de connexion internet");
    }
  }, []);

  const loadAbonnements = useCallback(async () => {
    try {
      const r = await axios.get(`http://localhost:3000/api/abonnement/`);
      setListeAbonnements(r.data);
    } catch (error) {
      console.error("Erreur abonnements", error);
    }
  }, []);

  const loadConsultations = useCallback(async () => {
    try {
      const r = await axios.get(`http://localhost:3000/api/consultation/affiche`);
      setListeConsultation(r.data);
    } catch (error) {
      console.error("Erreur abonnements", error);
    }
  }, []);

  useEffect(() => {
    loadPatients();
    loadAbonnements();
    loadConsultations();
    socket.on("patients_updated", loadPatients);
    socket.on("abonnement_updated", loadAbonnements);
    socket.on("consultation_updated", loadConsultations);
    return () => {
      socket.off("patients_updated", loadPatients);
      socket.off("abonnement_updated", loadAbonnements);
      socket.off("consultation_updated", loadConsultations);
    };
  }, [loadPatients, loadAbonnements, loadConsultations]);

  // --- Logique de Tri ---
  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // --- Logique de Filtrage et Tri combinée ---
  const filteredAndSortedData = useMemo(() => {

    let result = data.filter((p) => {
      
      const dateCrea = new Date(p.date_creation);
      const maintenant = new Date();

      // Filtrage par date
      let matchDate = true;
      if (filterPeriod === "jour") {
        matchDate = dateCrea.toDateString() === maintenant.toDateString();
      } else if (filterPeriod === "selectDay" && selectedDate) {
        matchDate = dateCrea.toDateString() === new Date(selectedDate).toDateString();
      } else if (filterPeriod === "mois") {
        matchDate = (dateCrea.getMonth() === maintenant.getMonth() && dateCrea.getFullYear() === maintenant.getFullYear());
      } else if (filterPeriod === "annee") {
        matchDate = dateCrea.getFullYear() === maintenant.getFullYear();
      }

      // Filtrage par recherche
      const searchContent = `${p.nom} ${p.prenom} ${p.telephone}`.toLowerCase();
      const matchSearch = searchContent.includes(searchTerm.toLowerCase());

      return matchDate && matchSearch;
    });

    // Tri des données
    result.sort((a, b) => {
      let aValue = a[sortConfig.key] || "";
      let bValue = b[sortConfig.key] || "";

      if (sortConfig.key === "date_creation") {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchTerm, filterPeriod, selectedDate, sortConfig]);

  const handlePrint = () => window.print();

  const submit = async (e) => {
    e.preventDefault();
    
    // On n'envoie que ce qui est défini dans tes variables d'état (useState)
    const payload = { 
      nom, 
      prenom, 
      sexe, 
      telephone, 
      abonne: idAbonnement || "non", 
      consultation: idConsultation 
    };

    try {
      if (editId) {
        // Utilise l'URL complète avec /update/
        await axios.put(`http://localhost:3000/api/patient/update/${editId}`, payload);
      } else {
        await axios.post("http://localhost:3000/api/patient/post", payload);
      }
      resetForm();
      loadPatients();
      alert("Opération réussie !");
    } catch (error) { 
      console.error("Erreur envoi", error.response?.data || error.message);
      alert("Erreur lors de l'enregistrement : " + (error.response?.data?.error || error.message));
    }
  };

  const edit = (p) => {
    setNom(p.nom); 
    setPrenom(p.prenom); 
    setSexe(p.sexe);
    setTelephone(p.telephone); 
    setIdAbonnement(p.abonne || "");
    
    // Ici p.consultation contient maintenant du texte (ex: "Pédiatrie")
    setIdConsultation(p.consultation || ""); 
    
    setEditId(p.id_patient);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setNom(""); setPrenom(""); setSexe("Masculin");
    setTelephone(""); setIdAbonnement(""); setIdConsultation(""); setEditId(null);
  };

  const toggleArchive = async (id, actuelStatut) => {

    if (!currentUser || currentUser.role !== "Admin" ) {
    alert("Accès refusé : Seul l'administrateur peut archiver un patient.");
    return;
    }
    try {
      const nouveauStatut = !actuelStatut;

      // 1. Mise à jour "Optimiste" immédiate de l'interface
      setData(prevData => 
        prevData.map(p => 
          p.id_patient === id ? { ...p, est_actif: nouveauStatut } : p
        )
      );

      // 2. Appel API en arrière-plan
      await axios.patch(`http://localhost:3000/api/patient/archive/${id}`, { 
        statut: nouveauStatut 
      });

      // Note: Le socket "patients_updated" re-confirmera la donnée juste après
    } catch (err) { 
      console.error("Erreur archive:", err);
      alert("Erreur lors du changement de statut");
      loadPatients(); // Recharger les vraies données en cas d'échec
    }
  };

  const handleFullDelete = async (id) => {
    const code = prompt("⚠️ ACTION IRRÉVERSIBLE ⚠️\nTous les examens et résultats seront supprimés.\nTapez 'CONFIRMER' pour valider :");
    if (code === "CONFIRMER") {
      try {
        // ✅ Utilise AXIOS ici, pas 'client'
        await axios.delete(`http://localhost:3000/api/patient/full-delete/${id}`);
        loadPatients(); 
      } catch (error) {
        console.error("Erreur lors de la suppression :", error);
        alert("Impossible de supprimer le patient.");
      }
    }
};

  return (
    <div className="container mt-4">
      {/* Styles pour l'impression */}
      <style>{`
        @media print {
          /* Masquer les éléments inutiles */
          .no-print, form, .btn, .mb-3, .input-group, .btn-group, .alert { 
            display: none !important; 
          }

          /* Ajuster les marges de la page */
          @page {
            margin: 1cm;
          }

          .container { 
            width: 100% !important; 
            max-width: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important; 
          }

          /* Style du tableau pour l'impression */
          table { 
            width: 100% !important; 
            border-collapse: collapse !important;
            font-size: 12px; /* Texte plus petit pour faire tenir plus de colonnes */
          }
          
          th, td { 
            border: 1px solid #000 !important; 
            padding: 8px !important;
          }

          .badge {
            border: 1px solid #ccc !important;
            color: #000 !important;
            background: transparent !important;
          }
        }
      `}</style>

      {/* EN-TÊTE D'IMPRESSION (Visible uniquement à l'imprimante) */}
      <div className="d-none d-print-block mb-4">
        <div className="row align-items-center border-bottom pb-3">
          <div className="col-4">
            <img src={Logo} style={{width: '80px'}} />
            <h4 className="fw-bold mb-0">clinique medicale les eaux</h4>
            <p className="small mb-0">votre santé notre priorité</p>
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
        <h3 className="text-center mt-3 text-decoration-underline">Liste des Patients Enregistrés</h3>
      </div>

      <h3 className="no-print mb-4">Gestion des Patients</h3>

      {/* Formulaire */}
      <form onSubmit={submit} className="card p-3 shadow-sm mb-4 no-print">
        <div className="row">
          <div className="col-md-3 mb-2"><input className="form-control" placeholder="Nom" value={nom} onChange={(e)=>setNom(e.target.value)} required /></div>
          <div className="col-md-3 mb-2"><input className="form-control" placeholder="Prénom" value={prenom} onChange={(e)=>setPrenom(e.target.value)} /></div>
          <div className="col-md-2 mb-2">
            <select className="form-select" value={sexe} onChange={(e)=>setSexe(e.target.value)}>
              <option value="Masculin">Masculin</option>
              <option value="Feminin">Féminin</option>
            </select>
          </div>
          <div className="col-md-2 mb-2"><input className="form-control" placeholder="Tél" value={telephone} onChange={(e)=>setTelephone(e.target.value)} /></div>
          <div className="col-md-2 mb-2">
            <select 
              className="form-select" 
              value={idAbonnement} 
              onChange={(e) => setIdAbonnement(e.target.value)}
            >
              {listeAbonnements.map(abo => (
                <option key={abo.id_abonnement} value={abo.nom}>{abo.nom}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2 mb-2">
            <select 
              className="form-select" 
              value={idConsultation} 
              onChange={(e) => setIdConsultation(e.target.value)}
              required
            >
              {/* ➕ AJOUT de l'option par défaut neutre */}
              <option value="">-- Choisir une consultation --</option>
              
              {listeConsultation.map(consul => (
                <option key={consul.id} value={consul.nom_consul}>{consul.nom_consul}</option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn btn-primary">{editId ? "Modifier" : "Ajouter"}</button>
      </form>

      {/* Barre de Recherche et Filtres */}
      <div className="row mb-3 g-2 no-print">
        <div className="col-md-4">
          <input type="text" className="form-control" placeholder="🔍 Rechercher nom ou tél..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
        </div>
        <div className="col-md-3">
          <select className="form-select" value={filterPeriod} onChange={(e)=>setFilterPeriod(e.target.value)}>
            <option value="tous">Toutes dates</option>
            <option value="jour">Aujourd'hui</option>
            <option value="selectDay">Choisir un jour</option>
            <option value="mois">Ce mois-ci</option>
            <option value="annee">Cette année</option>
          </select>
        </div>
        {filterPeriod === "selectDay" && (
          <div className="col-md-3">
            <input type="date" className="form-control" value={selectedDate} onChange={(e)=>setSelectedDate(e.target.value)} />
          </div>
        )}
        <div className="col-md-2">
          <button onClick={handlePrint} className="btn btn-dark w-100">Imprimer</button>
        </div>
      </div>

      {/* Tableau */}
      <div className="table-responsive">
        <h4 className="d-none d-print-block text-center mb-3">Liste des Patients</h4>
        <table className="table table-hover border">
          <thead className="table-dark">
            <tr>
              <th onClick={()=>requestSort("nom")} style={{cursor:'pointer'}}>Nom {sortConfig.key==="nom" && (sortConfig.direction==="asc"?"↑":"↓")}</th>
              <th>Sexe</th>
              <th>Téléphone</th>
              <th>Abonnement</th>
              <th>Consultation</th>
              <th onClick={()=>requestSort("date_creation")} style={{cursor:'pointer'}}>Enregistré le {sortConfig.key==="date_creation" && (sortConfig.direction==="asc"?"↑":"↓")}</th>
              <th className="no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
          {filteredAndSortedData.map((p) => {
            // ÉTAPE CRUCIALE : Définir isActif à l'intérieur du map
            const isActif = p.est_actif !== false; 

            return (
              <tr key={p.id_patient} className={!isActif ? "table-light text-muted" : ""}>
                <td style={{ opacity: !isActif ? 0.6 : 1 }}>
                  {p.nom} {p.prenom} 
                  {!isActif && <small className="badge bg-secondary ms-2">Archivé</small>}
                </td>
                <td>{p.sexe}</td>
                <td>{p.telephone}</td>
                <td><span className={`badge ${p.abonne === "non" ? "bg-secondary" : "bg-success"}`}>{p.abonne}</span></td>
                <td>
                  <span className={`badge ${p.consultation === "laboratoire" ? "bg-secondary" : "bg-info text-dark"}`}>
                    {p.consultation}
                  </span>
                </td>
                <td>{new Date(p.date_creation).toLocaleDateString()}</td>
                <td className="no-print">
                  <div className="d-flex align-items-center gap-2">
                    {/* LE SWITCH D'ARCHIVAGE */}
                    {currentUser?.role === "Admin" ? (
                      <div className="form-check form-switch">
                        <input 
                          className="form-check-input" 
                          type="checkbox" 
                          role="switch"
                          style={{ cursor: 'pointer' }}
                          checked={isActif} 
                          onChange={() => toggleArchive(p.id_patient, isActif)}
                        />
                      </div>
                    ) : (
                      // Optionnel : un petit cadenas ou rien du tout pour les non-admins
                      <span title="Action réservée à l'administrateur"></span>
                    )}

                    <div className="btn-group">
                      <button 
                        onClick={() => edit(p)} 
                        className="btn btn-warning btn-sm"
                        disabled={!isActif} // Optionnel : empêcher l'édition d'un archivé
                      >
                        Edit
                      </button>
                      {/* <button 
                        onClick={() => handleFullDelete(p.id_patient)} 
                        className="btn btn-danger btn-sm" 
                        title="Supprimer définitivement"
                      >
                        🗑️
                      </button> */}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
    </div>
  );
}

export default PatientsCRUD;
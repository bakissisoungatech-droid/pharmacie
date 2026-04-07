import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import socket from "../socket";

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

  const loadPatients = useCallback(async () => {
    try {
      const r = await axios.get(`http://localhost:3000/api/patient/`);
      setData(r.data);
    } catch (error) {
      console.error("Erreur patients", error);
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
      if (p.est_actif === false) return false;
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
    
    // On s'assure que le payload correspond exactement aux variables du backend
    const payload = { 
      nom, 
      prenom, 
      sexe, 
      telephone, 
      abonne: idAbonnement || "non", 
      consultation: idConsultation // On envoie le texte directement
    };

    try {
      if (editId) {
        await axios.put(`http://localhost:3000/api/patient/${editId}`, payload);
      } else {
        await axios.post("http://localhost:3000/api/patient/post", payload);
      }
      resetForm();
      loadPatients();
      alert("Patient enregistré avec succès !");
    } catch (error) { 
      console.error("Erreur envoi", error.response?.data || error.message); 
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

  const handleArchive = async (id) => {
    if (window.confirm("Archiver ce patient ? Il ne sera plus visible mais ses données resteront en base.")) {
      try {
        await axios.patch(`http://localhost:3000/api/patient/archive/${id}`);
        loadPatients();
      } catch (error) { alert("Erreur d'archivage"); }
    }
  };

  const handleFullDelete = async (id) => {
    const code = prompt("⚠️ ACTION IRRÉVERSIBLE ⚠️\nTous les examens et résultats seront supprimés.\nTapez 'CONFIRMER' pour valider :");
    if (code === "CONFIRMER") {
      try {
        await axios.delete(`http://localhost:3000/api/patient/full-delete/${id}`);
        loadPatients();
      } catch (error) { alert("Erreur lors de la suppression complète"); }
    }
  };

  return (
    <div className="container mt-4">
      {/* Styles pour l'impression */}
      <style>{`
        @media print {
          .no-print, form, .btn, .mb-3, .input-group { display: none !important; }
          .container { width: 100%; max-width: 100%; }
          table { width: 100%; border: 1px solid black !important; }
        }
      `}</style>

      <h3 className="no-print">Gestion des Patients</h3>

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
              value={idConsultation} // Utilise l'état consultation
              onChange={(e) => setIdConsultation(e.target.value)} // Met à jour l'état consultation
            >
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
            {filteredAndSortedData.map((p) => (
              <tr key={p.id_patient}>
                <td>{p.nom} {p.prenom}</td>
                <td>{p.sexe}</td>
                <td>{p.telephone}</td>
                <td><span className={`badge ${p.abonne === "non" ? "bg-secondary" : "bg-success"}`}>{p.abonne}</span></td>
                <td>
                  <span className={`badge ${p.consultation === "laboratoire" ? "bg-secondary" : "bg-info text-dark"}`}>
                    {p.consultation }
                  </span>
                </td>
                <td>{new Date(p.date_creation).toLocaleDateString()}</td>
                <td className="no-print">
                  <div className="btn-group">
                    <button onClick={() => edit(p)} className="btn btn-warning btn-sm">Edit</button>
                    
                    {/* Bouton Archiver (Simple suppression) */}
                    <button onClick={() => handleArchive(p.id_patient)} className="btn btn-outline-danger btn-sm" title="Archiver">
                      📦
                    </button>
                    
                    {/* Bouton Purge (Suppression totale) */}
                    <button onClick={() => handleFullDelete(p.id_patient)} className="btn btn-danger btn-sm" title="Supprimer définitivement">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PatientsCRUD;
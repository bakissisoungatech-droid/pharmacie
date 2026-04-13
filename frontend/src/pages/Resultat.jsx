import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

function ResultatExamen (){
  // États pour les listes
  const [examensEnAttente, setExamensEnAttente] = useState([]);
  const [historique, setHistorique] = useState([]);
  
  // États pour le formulaire et filtres
  const [selectedExamen, setSelectedExamen] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState({
    parametres: [],
    seroData: { resultat: "", titre: "", valeur: "", interpretation: "" }
  });

  // États de filtrage (Backend)
  const [filtreDate, setFiltreDate] = useState("tous"); 
  const [dateSelectionnee, setDateSelectionnee] = useState("");

  const API_URL = "http://localhost:3000/api/resultats";

  // Rafraîchir les données quand les filtres changent
  useEffect(() => {
    refreshData();
  }, [filtreDate, dateSelectionnee]);

  const refreshData = async () => {
    try {
      const params = { filtre: filtreDate, datePrecise: dateSelectionnee };
      const [attente, effectues] = await Promise.all([
        axios.get(`${API_URL}/en_attente`),
        axios.get(`${API_URL}/effectues`, { params }) 
      ]);
      setExamensEnAttente(attente.data);
      setHistorique(effectues.data);
    } catch (err) {
      console.error("Erreur chargement:", err);
    }
  };

  // --- LOGIQUE DE SELECTION ---
  const handleSelect = (examen) => {
    setSelectedExamen(examen);
    setIsEditing(false);
    
    if (examen.categorie.toUpperCase().includes("BIOCHIMIE")) {
      const params = (examen.parametre || "").split(",").map(p => ({
        parametre: p.trim(),
        resultat: "",
        valeur: (examen.valeurs_defaut || ""),
        interpretation: ""
      }));
      setFormData({ ...formData, parametres: params });
    } else {
      setFormData({ 
        ...formData, 
        seroData: { resultat: "", titre: examen.nom_examen, valeur: "", interpretation: "" } 
      });
    }
  };

  // --- ENREGISTREMENT / MODIFICATION ---
  const soumettreResultat = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        id_ligne: selectedExamen.id_ligne,
        id_examen_reel: selectedExamen.id_examen_reel,
        categorie: selectedExamen.categorie,
        valide_par: "LABO_USER",
        parametres: formData.parametres,
        seroData: formData.seroData
      };

      if (isEditing) {
        // Option 1: Appel PUT (si route créée)
        await axios.put(`${API_URL}/${selectedExamen.id_resultat}`, payload);
      } else {
        // Option 2: Appel POST
        await axios.post(API_URL, payload);
      }

      alert("Succès !");
      setSelectedExamen(null);
      refreshData();
    } catch (err) {
      alert("Erreur: " + err.message);
    }
  };

  const chargerPourModification = async (h) => {
    try {
      setIsEditing(true);
      setSelectedExamen({
        ...h,
        nom: h.nom_patient,
        id_examen_reel: h.id_examen
      });

      const res = await axios.get(`${API_URL}/details/${h.id_resultat}`);
      
      if (res.data.type === "BIOCHIMIE") {
        const params = res.data.data.map(p => ({
          parametre: p.nom_parametre,
          resultat: p.resultat,
          valeur: p.valeur,
          interpretation: p.interpretation
        }));
        setFormData({ ...formData, parametres: params });
      } else {
        setFormData({ ...formData, seroData: res.data.data[0] });
      }
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert("Erreur lors de la récupération des détails.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Supprimer ce résultat ?")) {
      await axios.delete(`${API_URL}/${id}`);
      refreshData();
    }
  };

  // --- RECHERCHE FILTRÉE (Textuelle uniquement, la date est gérée par le serveur) ---
  const historiqueFiltre = useMemo(() => {
    return historique.filter(h => 
      `${h.nom_patient} ${h.prenom_patient} ${h.nom_examen}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [historique, search]);

  return (
    <div className="container-fluid p-4">
      <div className="row">
        
        {/* COLONNE GAUCHE : EN ATTENTE */}
        <div className="col-md-4">
          <div className="card shadow-sm border-0 mb-4">
            <div className="card-header bg-warning text-dark fw-bold">⌛ Examens en attente</div>
            <div className="list-group list-group-flush" style={{maxHeight: '400px', overflowY: 'auto'}}>
              {examensEnAttente.map((ex, i) => (
                <button 
                  key={i} 
                  className={`list-group-item list-group-item-action ${selectedExamen?.id_ligne === ex.id_ligne ? 'active' : ''}`}
                  onClick={() => handleSelect(ex)}
                >
                  <div className="d-flex justify-content-between">
                    <strong>{ex.nom} {ex.prenom}</strong>
                    <small>{new Date(ex.date_demande).toLocaleDateString()}</small>
                  </div>
                  <small className="d-block text-uppercase">{ex.nom_examen}</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : FORMULAIRE ET HISTORIQUE */}
        <div className="col-md-8">
          {selectedExamen ? (
            <div className="card shadow border-primary mb-4">
              <div className="card-header bg-primary text-white d-flex justify-content-between">
                <span>{isEditing ? "MODIFICATION" : "SAISIE"} : {selectedExamen.nom_examen}</span>
                <button className="btn-close btn-close-white" onClick={() => setSelectedExamen(null)}></button>
              </div>
              <form className="card-body" onSubmit={soumettreResultat}>
                {/* Rendu dynamique Bio/Sero inchangé... */}
                {selectedExamen.categorie.toUpperCase().includes("BIOCHIMIE") && (
                   <table className="table table-sm">
                     <thead><tr><th>Paramètre</th><th>Résultat</th><th>Norme</th></tr></thead>
                     <tbody>
                       {formData.parametres.map((p, idx) => (
                         <tr key={idx}>
                           <td>{p.parametre}</td>
                           <td>
                             <input type="text" className="form-control form-control-sm" required value={p.resultat}
                               onChange={(e) => {
                                 const newParams = [...formData.parametres];
                                 newParams[idx].resultat = e.target.value;
                                 setFormData({ ...formData, parametres: newParams });
                               }}
                             />
                           </td>
                           <td><input type="text" className="form-control form-control-sm" value={p.valeur} readOnly /></td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                )}

                {selectedExamen.categorie.toUpperCase().includes("SEROLOGIE") && (
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Titre</label>
                      <input type="text" className="form-control" value={formData.seroData.titre} readOnly />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Résultat</label>
                      <select className="form-select" required value={formData.seroData.resultat}
                        onChange={(e) => setFormData({ ...formData, seroData: { ...formData.seroData, resultat: e.target.value }})}>
                        <option value="">-- Choisir --</option>
                        <option value="NEGATIF">NÉGATIF</option>
                        <option value="POSITIF">POSITIF</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <button type="submit" className="btn btn-success w-100">
                    {isEditing ? "💾 Enregistrer les modifications" : "✅ Valider le résultat"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="alert alert-info shadow-sm">Sélectionnez un examen à gauche pour commencer.</div>
          )}

          {/* TABLEAU HISTORIQUE AVEC FILTRES */}
          <div className="card shadow-sm border-0">
            <div className="card-header bg-dark text-white">
              <div className="row align-items-center g-2">
                <div className="col-md-3"><span>📚 Historique</span></div>
                <div className="col-md-3">
                  <select className="form-select form-select-sm" value={filtreDate} onChange={(e) => setFiltreDate(e.target.value)}>
                    <option value="tous">Toutes les dates</option>
                    <option value="aujourdhui">Aujourd'hui</option>
                    <option value="mois">Ce mois-ci</option>
                    <option value="precis">Jour précis...</option>
                  </select>
                </div>
                {filtreDate === "precis" && (
                  <div className="col-md-3">
                    <input type="date" className="form-control form-control-sm" onChange={(e) => setDateSelectionnee(e.target.value)} />
                  </div>
                )}
                <div className={filtreDate === "precis" ? "col-md-3" : "col-md-6"}>
                  <input type="text" className="form-control form-control-sm" placeholder="🔍 Rechercher..." onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="table-responsive" style={{maxHeight: '400px'}}>
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light sticky-top">
                  <tr><th>Date</th><th>Patient</th><th>Examen</th><th className="text-center">Actions</th></tr>
                </thead>
                <tbody>
                  {historiqueFiltre.map((h) => (
                    <tr key={h.id_resultat}>
                      <td>{new Date(h.date_resultat).toLocaleDateString()}</td>
                      <td className="fw-bold">{h.nom_patient} {h.prenom_patient}</td>
                      <td><span className="badge bg-secondary">{h.nom_examen}</span></td>
                      <td className="text-center">
                        <button className="btn btn-sm btn-outline-primary me-2" onClick={() => chargerPourModification(h)}>✏️</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(h.id_resultat)}>🗑️</button>
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
};

export default ResultatExamen;
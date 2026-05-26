import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";

function ResultatExamen() {
  // --- ÉTATS ---
  const [examensEnAttente, setExamensEnAttente] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [selectedExamen, setSelectedExamen] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [dateResultat, setDateResultat] = useState("");

  const [formData, setFormData] = useState({
    parametres: [],
    seroData: { resultat: "", titre: "", valeur: "", interpretation: "" }
  });

  // Filtrage
  const [filtreDate, setFiltreDate] = useState("tous");
  const [dateSelectionnee, setDateSelectionnee] = useState("");
  const [searchHistorique, setSearchHistorique] = useState("");
  const [filtreDateAttente, setFiltreDateAttente] = useState("tous");
  const [dateAttentePrecise, setDateAttentePrecise] = useState("");
  const [searchAttente, setSearchAttente] = useState("");

  const API_URL = "http://localhost:3000/api/resultats";

  const formatForDateTimeLocal = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    const tzoffset = d.getTimezoneOffset() * 60000; 
    const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  // --- LOGIQUE DE CALCUL AUTOMATIQUE ---
  const calculsAutomatiques = useMemo(() => {
    const getVal = (nom) => {
      if (!formData.parametres) return null;
      const p = formData.parametres.find(item => 
        item && item.parametre && item.parametre.toUpperCase().includes(nom.toUpperCase())
      );
      return p && p.resultat ? parseFloat(p.resultat.replace(',', '.')) : null;
    };

    const resultats = [];
    const creat = getVal("CRÉATININE") || getVal("CREAT");
    if (creat && selectedExamen?.age) {
      const poids = selectedExamen.poids || 70; 
      const k = selectedExamen.sexe === 'F' ? 1.04 : 1.23;
      const clairance = ((140 - selectedExamen.age) * poids * k) / creat;
      if(!isNaN(clairance)) {
        resultats.push({ nom: "Clairance Créat. (Cockcroft)", valeur: clairance.toFixed(2), unite: "ml/min" });
      }
    }

    const ct = getVal("CHOLESTÉROL TOTAL") || getVal("CHOL TOTAL") || getVal("CHOL-T");
    const tg = getVal("TRIGLYCÉRIDES") || getVal("TRIGLY");
    const hdl = getVal("HDL");

    if (ct && hdl) {
      resultats.push({ nom: "Rapport CT/HDL", valeur: (ct / hdl).toFixed(2), unite: "" });
      if (tg && tg < 4) { 
        const ldl = ct - hdl - (tg / 5);
        resultats.push({ nom: "LDL (Calculé)", valeur: ldl.toFixed(2), unite: "g/L" });
      }
    }
    return resultats;
  }, [formData.parametres, selectedExamen]);

  const refreshData = useCallback(async () => {
    try {
      const params = { filtre: filtreDate, datePrecise: dateSelectionnee };
      const [attente, effectues] = await Promise.all([
        axios.get(`${API_URL}/en_attente`),
        axios.get(`${API_URL}/effectues`, { params })
      ]);
      setExamensEnAttente(attente.data);
      setHistorique(effectues.data);
    } catch (err) { console.error("Erreur chargement:", err); alert("probleme de connexion internet");}
  }, [filtreDate, dateSelectionnee]);

  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    if (storedUser) setCurrentUser(JSON.parse(storedUser));
    else setCurrentUser({ nom: "Laborantin Démo" });
    refreshData();
  }, [refreshData]);

  const handleSelect = (examen) => {
    setIsEditing(false);
    setSelectedExamen(examen);
    setDateResultat(formatForDateTimeLocal(new Date()));
    
    const categorie = examen.categorie ? examen.categorie.toUpperCase() : "";
    const nomExamenUpper = examen.nom_examen ? examen.nom_examen.toUpperCase() : "";

    // Aiguillage Vitesse de Sédimentation (Gérée sous forme de tableau à paramètre unique)
    if (nomExamenUpper.includes("VITESSE") || nomExamenUpper.includes("SEDIMENTATION") || nomExamenUpper === "VS") {
      setFormData({
        parametres: [{
          parametre: "Vitesse de Sédimentation",
          nom_parametre: "Vitesse de Sédimentation",
          resultat: "",
          valeur: examen.valeurs_defaut || "mm/1ère heure",
          interpretation: ""
        }],
        seroData: { resultat: "", titre: "", valeur: "", interpretation: "" }
      });
    }
    // Biochimie & Hématologie classique
    else if (categorie.includes("BIOCHIMIE") || categorie.includes("HEMATOLOGIE")) {
      const nomsParams = examen.parametre 
        ? (examen.parametre.includes(';') ? examen.parametre.split(';') : examen.parametre.split(','))
        : [];

      const valeursParams = examen.valeurs_defaut
        ? (examen.valeurs_defaut.includes(';') ? examen.valeurs_defaut.split(';') : examen.valeurs_defaut.split(','))
        : [];

      const newParams = nomsParams.map((p, index) => ({
        parametre: p.trim(),
        nom_parametre: p.trim(),
        resultat: "",
        valeur: valeursParams[index] ? valeursParams[index].trim() : "-",
        interpretation: ""
      }));

      setFormData({
        parametres: newParams,
        seroData: { resultat: "", titre: "", valeur: "", interpretation: "" }
      });
    } else {
      setFormData({
        parametres: [],
        seroData: { 
          resultat: "", 
          valeur: examen.nom_examen, 
          titre: examen.nom_examen,  
          interpretation: "RAS" 
        }
      });
    }
  };

  // --- ACTION : AJOUTER UN PARAMÈTRE DIRECTEMENT DANS LE FORMULAIRE ---
  const ajouterParametre = () => {
    const nouveauParam = {
      parametre: "",
      nom_parametre: "",
      resultat: "",
      valeur: "-",
      interpretation: ""
    };
    setFormData({
      ...formData,
      parametres: [...formData.parametres, nouveauParam]
    });
  };

  // --- ACTION : SUPPRIMER UN PARAMÈTRE DU FORMULAIRE ---
  const supprimerParametre = (indexASupprimer) => {
    const nouveauxParams = formData.parametres.filter((_, idx) => idx !== indexASupprimer);
    setFormData({ ...formData, parametres: nouveauxParams });
  };

  const soumettreResultat = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert("Erreur : Aucun utilisateur connecté.");

    try {
      const parametresNettoyes = formData.parametres.map(p => ({
        parametre: p.parametre || p.nom_parametre,
        nom_parametre: p.parametre || p.nom_parametre,
        resultat: p.resultat,
        valeur: p.valeur,
        interpretation: p.interpretation
      }));

      const bioFormatte = {};
      parametresNettoyes.forEach(p => {
        if (p.nom_parametre) {
          bioFormatte[p.nom_parametre] = p.resultat;
        }
      });

      const payload = {
        id_ligne: selectedExamen.id_ligne,
        id_examen_reel: selectedExamen.id_examen_reel || selectedExamen.id_examen,
        nom_examen: selectedExamen.nom_examen, // Crucial pour l'aiguillage backend de la VS
        categorie: selectedExamen.categorie,
        valide_par: currentUser.nom,
        date_resultat: dateResultat, 
        bioData: bioFormatte, 
        seroData: formData.seroData,
        parametres: parametresNettoyes 
      };

      if (isEditing) {
        await axios.put(`${API_URL}/${selectedExamen.id_resultat}`, payload);
        alert("Résultat et date mis à jour !");
      } else {
        await axios.post(API_URL, payload);
        alert("Résultat enregistré avec la date spécifiée !");
      }

      setSelectedExamen(null);
      setIsEditing(false);
      refreshData();
    } catch (err) {
      alert("Erreur lors de la sauvegarde : " + (err.response?.data?.error || err.message));
    }
  };

  const chargerPourModification = async (h) => {
    try {
      setIsEditing(true);
      setSelectedExamen({
        ...h,
        nom: h.nom_patient || h.nom,
        prenom: h.prenom_patient || h.prenom,
        id_examen_reel: h.id_examen,
        nom_examen: h.nom_examen,
        categorie: h.categorie
      });

      setDateResultat(formatForDateTimeLocal(h.date_resultat));

      const res = await axios.get(`${API_URL}/details/${h.id_resultat}`);
      const typeReponse = res.data.type;

      // Gestion du retour d'édition Vitesse de Sédimentation
      if (typeReponse === "VITESSE_SEDIMENTATION") {
        const params = res.data.data.map(p => ({
          parametre: "Vitesse de Sédimentation",
          nom_parametre: "Vitesse de Sédimentation",
          resultat: p.resultat,
          valeur: "mm/1ère heure",
          interpretation: ""
        }));
        setFormData({ parametres: params, seroData: { resultat: "", titre: "", valeur: "", interpretation: "" } });
      }
      // Gestion Biochimie / Hématologie
      else if (typeReponse === "BIOCHIMIE") {
        const params = res.data.data.map(p => ({
          parametre: p.nom_parametre,
          nom_parametre: p.nom_parametre,
          resultat: p.resultat,
          valeur: p.valeur || "-",
          interpretation: p.interpretation || ""
        }));
        setFormData({ parametres: params, seroData: { resultat: "", titre: "", valeur: "", interpretation: "" } });
      } 
      // Gestion Sérologie
      else {
        if(res.data.data && res.data.data.length > 0) {
          setFormData({ parametres: [], seroData: res.data.data[0] });
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { alert("Erreur lors de la récupération des détails."); }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer ce résultat définitivement ?")) {
      try { await axios.delete(`${API_URL}/${id}`); refreshData(); } catch (err) { alert("Erreur de suppression");  }
    }
  };

  const attenteFiltre = useMemo(() => {
    return examensEnAttente.filter(ex => {
      const matchSearch = `${ex.nom} ${ex.prenom} ${ex.nom_examen}`.toLowerCase().includes(searchAttente.toLowerCase());
      const dateDemande = new Date(ex.date_demande).toLocaleDateString('en-CA');
      const aujourdhui = new Date().toLocaleDateString('en-CA');
      let matchDate = true;
      if (filtreDateAttente === "aujourdhui") matchDate = dateDemande === aujourdhui;
      else if (filtreDateAttente === "precis" && dateAttentePrecise) matchDate = dateDemande === dateAttentePrecise;
      return matchSearch && matchDate;
    });
  }, [examensEnAttente, searchAttente, filtreDateAttente, dateAttentePrecise]);

  const historiqueFiltre = useMemo(() => {
    return historique.filter(h =>
      `${h.nom_patient} ${h.prenom_patient} ${h.nom_examen}`.toLowerCase().includes(searchHistorique.toLowerCase())
    );
  }, [historique, searchHistorique]);

  // Détermination de l'affichage du bloc Tableau de Paramètres (vrai si Biochimie, Hématologie OU Vitesse de sédimentation)
  const isTableauParametresVisible = useMemo(() => {
    if (!selectedExamen) return false;
    const cat = selectedExamen.categorie?.toUpperCase() || "";
    const nom = selectedExamen.nom_examen?.toUpperCase() || "";
    return cat.includes("BIOCHIMIE") || cat.includes("HEMATOLOGIE") || nom.includes("VITESSE") || nom.includes("SEDIMENTATION") || nom === "VS";
  }, [selectedExamen]);

  return (
    <div className="container-fluid p-4">
      <div className="row">
        {/* COLONNE GAUCHE */}
        <div className="col-md-4">
          <div className="card shadow-sm border-0 mb-4">
            <div className="card-header bg-warning text-dark fw-bold">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span>⌛ Analyses en attente</span>
                <span className="badge bg-dark">{attenteFiltre.length}</span>
              </div>
              <div className="row g-1">
                <div className="col-6">
                  <select className="form-select form-select-sm" value={filtreDateAttente} onChange={(e) => setFiltreDateAttente(e.target.value)}>
                    <option value="tous">Toutes dates</option>
                    <option value="aujourdhui">Aujourd'hui</option>
                    <option value="precis">Jour précis...</option>
                  </select>
                </div>
                <div className="col-6">
                  {filtreDateAttente === "precis" ? (
                    <input type="date" className="date form-control form-control-sm" onChange={(e) => setDateAttentePrecise(e.target.value)} />
                  ) : (
                    <input type="text" className="form-control form-control-sm" placeholder="🔍 Filtrer..." value={searchAttente} onChange={(e) => setSearchAttente(e.target.value)} />
                  )}
                </div>
              </div>
            </div>
            <div className="list-group list-group-flush" style={{ maxHeight: '550px', overflowY: 'auto' }}>
              {attenteFiltre.map((ex, i) => (
                <button key={i} className={`list-group-item list-group-item-action ${selectedExamen?.id_ligne === ex.id_ligne ? 'list-group-item-primary' : ''}`} onClick={() => handleSelect(ex)}>
                  <div className="d-flex justify-content-between">
                    <strong className="text-truncate text-uppercase">{ex.nom} {ex.prenom}</strong>
                    <small className="text-muted">{new Date(ex.date_demande).toLocaleDateString()}</small>
                  </div>
                  <small className="d-block text-primary fw-bold">{ex.nom_examen}</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* COLONNE DROITE */}
        <div className="col-md-8">
          {selectedExamen ? (
            <div className="card shadow border-primary mb-4 position-relative">
              <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <span className="fw-bold">{isEditing ? "✏️ MODIFICATION" : "🧪 SAISIE DE RÉSULTATS"} : {selectedExamen.nom_examen}</span>
                <button className="btn-close btn-close-white" onClick={() => setSelectedExamen(null)}></button>
              </div>
              <form className="card-body" onSubmit={soumettreResultat}>
                
                {calculsAutomatiques.length > 0 && (
                  <div className="position-absolute end-0 top-50 translate-middle-y me-3 shadow-lg border rounded bg-white" style={{ zIndex: 100, width: '220px', fontSize: '0.85rem' }}>
                    <div className="bg-dark text-white px-2 py-1 rounded-top small fw-bold">📊 Formules auto-calculées</div>
                    <div className="p-2">
                      {calculsAutomatiques.map((c, i) => (
                        <div key={i} className="mb-2 border-bottom pb-1">
                          <span className="d-block text-muted small">{c.nom}</span>
                          <strong className="text-success fs-6">{c.valeur}</strong> <small className="text-muted">{c.unite}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="alert alert-light border mb-3 py-2 px-3 small">
                  📋 Patient : <strong className="text-uppercase">{selectedExamen.nom}</strong> {selectedExamen.prenom}
                  <br />
                   Unité de soin : <strong>{selectedExamen.categorie || 'Non spécifiée'}</strong>
                  <br />
                   Opérateur : <strong>{currentUser?.nom || 'Non connecté'}</strong>
                </div>

                <div className="row mb-3 p-2 bg-light rounded border mx-0">
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-danger">📅 Date et Heure d'enregistrement</label>
                    <input 
                      type="datetime-local" 
                      className="form-control border-danger fw-bold"
                      value={dateResultat}
                      required
                      onChange={(e) => setDateResultat(e.target.value)}
                    />
                  </div>
                </div>

                {/* TABLEAU PARAMÈTRES MIS À JOUR POUR PRENDRE EN CHARGE LA VS */}
                {isTableauParametresVisible && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h5 className="mb-0 text-secondary fw-bold">Paramètres de l'examen</h5>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-primary fw-bold"
                        onClick={ajouterParametre}
                      >
                        ➕ Ajouter un paramètre
                      </button>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-sm align-middle table-bordered">
                        <thead className="table-light">
                          <tr>
                            <th>Nom du Paramètre</th>
                            <th style={{ width: '25%' }}>Résultat</th>
                            <th style={{ width: '30%' }}>Valeurs de Référence</th>
                            <th style={{ width: '10%' }} className="text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.parametres.map((p, idx) => (
                            <tr key={idx}>
                              <td>
                                <input 
                                  type="text" 
                                  className="form-control form-control-sm border-0 fw-bold bg-transparent" 
                                  placeholder="Nom du paramètre..." 
                                  required
                                  value={p.parametre || p.nom_parametre || ""} 
                                  onChange={(e) => {
                                    const newParams = [...formData.parametres];
                                    newParams[idx].parametre = e.target.value;
                                    newParams[idx].nom_parametre = e.target.value;
                                    setFormData({ ...formData, parametres: newParams });
                                  }}
                                />
                              </td>
                              <td>
                                <input type="text" className="form-control form-control-sm border-primary" required value={p.resultat} onChange={(e) => {
                                  const newParams = [...formData.parametres];
                                  newParams[idx].resultat = e.target.value;
                                  setFormData({ ...formData, parametres: newParams });
                                }}/>
                              </td>
                              <td>
                                <input type="text" className="form-control form-control-sm" value={p.valeur || ""} onChange={(e) => {
                                  const newParams = [...formData.parametres];
                                  newParams[idx].valeur = e.target.value; 
                                  setFormData({ ...formData, parametres: newParams });
                                }}/>
                              </td>
                              <td className="text-center">
                                <button 
                                  type="button" 
                                  className="btn btn-sm btn-link text-danger p-0"
                                  onClick={() => supprimerParametre(idx)}
                                  title="Supprimer ce paramètre"
                                >
                                  ❌
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* BLOC SÉROLOGIE / BIOLOGIE (Exclut implicitement la VS puisque gérée en haut) */}
                {(selectedExamen.categorie?.toUpperCase().includes("BIOLOGIE") && !isTableauParametresVisible) && (
                  <div className="row g-3 p-3 border rounded bg-light">
                    <div className="col-md-4">
                      <div className="mb-2">
                        <label className="form-label fw-bold text-muted">Examen (Valeur fixe)</label>
                        <input 
                          type="text" 
                          className="form-control bg-white text-secondary" 
                          value={formData.seroData.valeur || ""} 
                          readOnly 
                        />
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div className="mb-2">
                        <label className="form-label fw-bold text-primary">Verdict Diagnostic</label>
                        <select 
                          className="form-select border-primary fw-bold" 
                          required 
                          value={formData.seroData.resultat || ""}
                          onChange={(e) => {
                            const nouveauVerdict = e.target.value;
                            let nouveauTitre = formData.seroData.titre;
                            
                            if (nouveauVerdict === "NEGATIF") {
                              nouveauTitre = formData.seroData.valeur;
                            }

                            setFormData({
                              ...formData,
                              seroData: { 
                                ...formData.seroData, 
                                resultat: nouveauVerdict,
                                titre: nouveauTitre
                              }
                            });
                          }}
                        >
                          <option value="">-- Choisir le résultat --</option>
                          <option value="NEGATIF">🔴 NÉGATIF</option>
                          <option value="POSITIF">🟢 POSITIF</option>
                        </select>
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div className="mb-2">
                        <label className="form-label fw-bold">Titre (Paramètre/Spécification)</label>
                        <input 
                          type="text" 
                          className={`form-control ${formData.seroData.resultat === "NEGATIF" ? "bg-light text-muted" : "border-warning fw-bold"}`}
                          value={formData.seroData.titre || ""} 
                          disabled={formData.seroData.resultat === "NEGATIF" || !formData.seroData.resultat}
                          placeholder="Spécifier si Positif..."
                          onChange={(e) => setFormData({
                            ...formData,
                            seroData: { ...formData.seroData, titre: e.target.value }
                          })}
                          required
                        />
                      </div>
                    </div>

                    <div className="col-md-12">
                      <div className="mb-0">
                        <label className="form-label fw-bold">Interprétation / Conclusion</label>
                        <textarea 
                          className="form-control" 
                          rows="2"
                          placeholder="Commentaire ou observation optionnelle..."
                          value={formData.seroData.interpretation || ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            seroData: { ...formData.seroData, interpretation: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <button type="submit" className="btn btn-success w-100 fw-bold py-2 shadow-sm">
                    {isEditing ? "💾 ENREGISTRER LES MODIFICATIONS (DATE + VALEURS)" : "✅ VALIDER ET TRANSMETTRE LE RÉSULTAT"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="alert alert-info shadow-sm py-3">💡 Sélectionnez un examen dans le volet de gauche pour démarrer la saisie.</div>
          )}

          {/* HISTORIQUE */}
          <div className="card shadow-sm border-0 mt-3">
            <div className="card-header bg-dark text-white">
              <div className="row align-items-center g-2">
                <div className="col-md-3"><span className="fw-bold">📚 Archives</span></div>
                <div className="col-md-3">
                  <select className="form-select form-select-sm" value={filtreDate} onChange={(e) => setFiltreDate(e.target.value)}>
                    <option value="tous">Toutes les dates</option>
                    <option value="aujourdhui">Aujourd'hui</option>
                    <option value="mois">Ce mois-ci</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <input type="text" className="form-control form-control-sm" placeholder="🔍 Rechercher..." onChange={(e) => setSearchHistorique(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="table-responsive" style={{ maxHeight: '350px' }}>
              <table className="table table-hover align-middle mb-0 table-sm">
                <thead className="table-light sticky-top">
                  <tr>
                    <th>Date Effective</th>
                    <th>Patient</th>
                    <th>Examen</th>
                    <th className="text-center">Options</th>
                  </tr>
                </thead>
                <tbody>
                  {historiqueFiltre.map((h) => (
                    <tr key={h.id_resultat}>
                      <td className="small text-muted">{new Date(h.date_resultat).toLocaleString('fr-FR')}</td>
                      <td className="fw-bold text-uppercase">{h.nom_patient} {h.prenom_patient}</td>
                      <td><span className="badge bg-secondary text-uppercase">{h.nom_examen}</span></td>
                      <td className="text-center">
                        <button className="btn btn-sm btn-outline-warning me-1" onClick={() => chargerPourModification(h)}>✏️</button>
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
}

export default ResultatExamen;
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

function SaisieResultat() {
  const [attente, setAttente] = useState([]);
  const [selectedExamen, setSelectedExamen] = useState(null);
  const [validePar, setValidePar] = useState("");
  const [parametres, setParametres] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // États pour les formulaires spécifiques
  const [bacterioData, setBacterioData] = useState({ nature: "", macroscopique: "", direct: "", culture: "" });
  const [seroData, setSeroData] = useState({ index: "", cutoff: "<6", interpretation: "Négatif",unite: "mg/L" });
  const [hematoData, setHematoData] = useState({ obs: "", conclusion: "" });

  const [resultatsEffectues, setResultatsEffectues] = useState([]);
  const [searchArchive, setSearchArchive] = useState("");
  const [filterDateDebut, setFilterDateDebut] = useState("");
  const [filterDateFin, setFilterDateFin] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'date_validation', direction: 'desc' });
  const [paraData, setParaData] = useState({ macro: "", direct: "", conclusion: "" });
  const [spermoData, setSpermoData] = useState({
  volume: "", ph: "8.0", viscosite: "Normale", m_rapide: "", m_lente: "", f_typiques: "", num_totale: "", obs: ""
  });

  // Référentiels pour les menus déroulants (Normes automatiques)
  const OPTIONS_PARASITO = {
    consistance: ["Solide", "Pâteuse", "Liquide", "Afécale"],
    aspect: ["Normal", "Sanguinolent", "Muqueux", "Glairo-sanguinolent"],
    direct_defaut: "Absence d'œufs de helminthes et de kystes de protozoaires."
  };

  const OPTIONS_SPERMO = {
    viscosite: ["Normale", "Diminuée", "Augmentée"],
    aspect: ["Opalescent", "Hétérogène", "Citrin"]
  };


  const UNITES_LABO = ["", "g/L", "mg/dL", "mmol/L", "µmol/L", "UI/L", "g/dL", "mm/1h", "pg", "fl", "10^3/µL", "10^6/µL", "%", "mg/L"];

  const REFERENTIEL_NORMES = {
    "Glycémie": { unite: "g/L", normale: "0.70 - 1.10" },
    "Urée": { unite: "g/L", normale: "0.15 - 0.45" },
    "Créatinine": { unite: "mg/L", normale: "7.0 - 13.0" },
    "Cholestérol": { unite: "g/L", normale: "< 2.00" },
    "Triglycérides": { unite: "g/L", normale: "0.40 - 1.50" },
    "TSH": { unite: "mUI/L", normale: "0.4 - 4.0" },
    "ASAT": { unite: "UI/L", normale: "< 40" },
    "ALAT": { unite: "UI/L", normale: "< 40" },
    "Transaminases (ASAT)": { unite: "UI/L", normale: "< 40" },
    "Transaminases (ALAT)": { unite: "UI/L", normale: "< 40" }
  };

  // Chargement initial
  useEffect(() => { 
    chargerAttente(); 
    chargerArchives();
  }, []);

  // Logique de pré-remplissage lors de la sélection
  useEffect(() => {
    if (selectedExamen) {
      const cat = (selectedExamen.categorie || "").toLowerCase();
      
      // Récupération des noms des paramètres et des valeurs/unités par défaut
      const nomsParams = selectedExamen.parametre ? selectedExamen.parametre.split(',') : [];
      const valeursDef = selectedExamen.valeurs_defaut ? selectedExamen.valeurs_defaut.split(',') : [];

      if (nomsParams.length > 0) {
        // On génère exactement le nombre de lignes prévues dans le catalogue
        const configurationAuto = nomsParams.map((nom, index) => {
          const nomTrim = nom.trim();
          const ref = REFERENTIEL_NORMES[nomTrim] || { unite: "", normale: "" };
          
          return {
            nom: nomTrim,
            valeur: "", 
            // Si une valeur par défaut existe (ex: "Négatif"), on l'utilise, sinon vide
            valeur_suggeree: valeursDef[index] ? valeursDef[index].trim() : "",
            unite: ref.unite, // On garde l'unité en mémoire vive pour l'affichage
            normale: ref.normale,
            interpretation: ""
          };
        });
        setParametres(configurationAuto);
      } else {
        // Si aucun paramètre n'est défini (Saisie libre), on met une ligne vide
        setParametres([{ nom: "", valeur: "", unite: "", normale: "", interpretation: "" }]);
      }
    }
  }, [selectedExamen]);

  const chargerAttente = async () => {
    try {
      const res = await axios.get("http://localhost:3000/api/resultats/en_attente");
      setAttente(res.data);
    } catch (err) { console.error("Erreur attente:", err); }
  };

  const chargerArchives = async () => {
    try {
      const res = await axios.get("http://localhost:3000/api/resultats/effectues");
      setResultatsEffectues(res.data);
    } catch (err) {
      console.error("Erreur archives:", err);
    }
  };

  const filteredAttente = useMemo(() => {
    return attente
      .filter(ex => `${ex.nom} ${ex.prenom} ${ex.nom_examen}`.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.categorie === b.categorie ? a.nom.localeCompare(b.nom) : a.categorie.localeCompare(b.categorie));
  }, [attente, searchTerm]);

  const archivesFiltrees = useMemo(() => {
    let resultats = [...resultatsEffectues];
    if (searchArchive) {
      resultats = resultats.filter(r => 
        `${r.nom_patient} ${r.nom_examen}`.toLowerCase().includes(searchArchive.toLowerCase())
      );
    }
    if (filterDateDebut) {
      resultats = resultats.filter(r => new Date(r.date_validation) >= new Date(filterDateDebut));
    }
    if (filterDateFin) {
      // On ajoute un jour ou on compare en début de journée pour inclure la date de fin
      resultats = resultats.filter(r => new Date(r.date_validation) <= new Date(filterDateFin + "T23:59:59"));
    }
    resultats.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return resultats;
  }, [resultatsEffectues, searchArchive, filterDateDebut, filterDateFin, sortConfig]);

  const handleParamChange = (index, field, value) => {
    const newParams = [...parametres];
    newParams[index][field] = value;

    // 1. Auto-complétion Nom -> Unité & Norme
    if (field === 'nom') {
      const match = Object.keys(REFERENTIEL_NORMES).find(k => k.toLowerCase() === value.trim().toLowerCase());
      if (match) {
        newParams[index].unite = REFERENTIEL_NORMES[match].unite;
        newParams[index].normale = REFERENTIEL_NORMES[match].normale;
      }
    }

    // 2. Aide à l'interprétation (Si valeur change et que la norme existe)
    if (field === 'valeur' && newParams[index].normale) {
      const val = parseFloat(value.replace(',', '.')); // Gérer les virgules
      const norme = newParams[index].normale;
      
      // Logique simplifiée pour les normes type "0.4 - 4.0" ou "< 40"
      if (!isNaN(val)) {
        if (norme.includes('-')) {
          const [min, max] = norme.split('-').map(n => parseFloat(n.trim()));
          if (val < min) newParams[index].interpretation = "Bas";
          else if (val > max) newParams[index].interpretation = "Elevé";
          else newParams[index].interpretation = "Normal";
        } else if (norme.includes('<')) {
          const max = parseFloat(norme.replace('<', '').trim());
          newParams[index].interpretation = val > max ? "Elevé" : "Normal";
        }
      }
    }

    setParametres(newParams);
  };
  const soumettreResultat = async () => {
    if (!validePar || !selectedExamen) return alert("Données manquantes");

    const cat = (selectedExamen.categorie || "").toLowerCase();

    try {
      const payload = { 
        id_ligne: selectedExamen.id_ligne,
        id_examen_reel: selectedExamen.id_examen_reel, // INDISPENSABLE pour les bilans
        valide_par: validePar,
        categorie: selectedExamen.categorie, 
        parametres: parametres,
        bacterioData: cat.includes("bactério") ? bacterioData : null,
        seroData: cat.includes("serologie") ? seroData : null,
        hematoData: cat.includes("hématologie") ? hematoData : null,
        paraData: (cat.includes("parasito") || cat.includes("copro") || cat.includes("urine")) ? paraData : null,
        spermoData: cat.includes("spermo") ? spermoData : null,
      };

      const response = await axios.post("http://localhost:3000/api/resultats", payload);
      
      if (response.data.success) {
        alert("✅ Examen validé !");
        setSelectedExamen(null);
        // Reset des champs
        setParametres([]);
        chargerAttente(); // La ligne validée disparaîtra, les autres restes
        chargerArchives();
      }
    } catch (err) { 
      alert("Erreur : " + (err.response?.data?.error || "Serveur injoignable")); 
    }
  };

  // ... (Garder handleKeyDown et ajouterParametre identiques)
  const ajouterParametre = () => {
    setParametres([...parametres, { nom: "", valeur: "", unite: "", normale: "", interpretation: "" }]);
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === parametres.length - 1 && parametres[index].valeur !== "") {
        ajouterParametre();
      }
    }
  };

  const handleSeroInterpretationChange = (nouvelleInterp) => {
    let nouvelIndex = seroData.index;
    
    if (nouvelleInterp === "Négatif") {
      // Si négatif, on suggère "<" suivi de la valeur du seuil
      nouvelIndex = `< ${seroData.cutoff}`;
    } else if (nouvelleInterp === "Positif" && seroData.index.includes("<")) {
      // Si on repasse en positif et que c'était un vestige du "négatif", on vide
      nouvelIndex = "";
    }

    setSeroData({
      ...seroData,
      interpretation: nouvelleInterp,
      index: nouvelIndex
    });
  };

  const preparerModification = async (archive) => {
    try {
      // 1. Récupérer les détails précis (lignes de paramètres) depuis l'API
      const res = await axios.get(`http://localhost:3000/api/resultats/details/${archive.id_resultat}`);
      const details = res.data;

      if (!details || details.length === 0) {
        alert("Aucun détail trouvé pour ce résultat.");
        return;
      }

      const cat = (archive.categorie || "").toLowerCase();

      // 2. Préparer l'objet d'examen sélectionné
      setSelectedExamen({
        id_ligne: archive.id_ligne,
        nom_examen: archive.nom_examen,
        nom: archive.nom_patient,
        prenom: archive.prenom_patient,
        categorie: archive.categorie,
        type_resultat: details.length > 1 ? "multiple" : "simple"
      });

      // 3. Charger le responsable
      setValidePar(archive.valide_par || "");

      // 4. Aiguillage des données selon la catégorie
      if (cat.includes("bactério")) {
        setBacterioData({
          nature: details[0].nature_prelevement || "",
          macroscopique: details[0].examen_macroscopique || "",
          direct: details[0].examen_direct_gram || "",
          culture: details[0].culture_identification || ""
        });
      } 
      else if (cat.includes("serologie")) {
        setSeroData({
          index: details[0].valeur || "",
          cutoff: details[0].valeur_normale?.replace("Index: ", "") || "<6",
          interpretation: details[0].interpretation || "Négatif"
        });
      }
      else if (cat.includes("parasito") || cat.includes("copro") || cat.includes("urine")) {
        setParaData({
          consistance: details[0].consistance || "",
          macro: details[0].aspect_macro || "",
          direct: details[0].examen_direct || "",
          conclusion: details[0].conclusion || ""
        });
      }
      else {
        // CAS PAR DÉFAUT (Biochimie / Hématologie)
        // On transforme les lignes de la DB en format compatible avec notre tableau de saisie
        const paramsCharges = details.map(d => ({
          nom: d.nom_parametre,
          valeur: d.valeur,
          unite: d.unite,
          normale: d.valeur_normale,
          interpretation: d.interpretation || ""
        }));
        setParametres(paramsCharges);

        if (cat.includes("hématologie")) {
          setHematoData({ obs: details[0].observations || "", conclusion: "" });
        }
      }

      // Remonter en haut de page pour voir le formulaire
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      console.error("Erreur modification:", err);
      alert("Impossible de charger les détails du résultat.");
    }
  };

// 2. Rendu du Formulaire Spécifique Hématologie (ajouté)
const renderFormulaireDynamique = () => {
  if (!selectedExamen || !selectedExamen.categorie) return null;
    const cat = selectedExamen.categorie.toLowerCase();

    if (cat.includes("parasito") || cat.includes("copro")) {
    return (
      <div className="p-3 border rounded bg-success bg-opacity-10">
        <h6 className="fw-bold text-success">💩 Examen Parasitologique / Coprologie</h6>
        <div className="row g-2 mb-2">
          <div className="col-md-6">
            <label className="small">Consistance</label>
            <select className="form-select form-select-sm" onChange={e => setParaData({...paraData, consistance: e.target.value})}>
              {OPTIONS_PARASITO.consistance.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="small">Aspect Macro</label>
            <select className="form-select form-select-sm" onChange={e => setParaData({...paraData, macro: e.target.value})}>
              {OPTIONS_PARASITO.aspect.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
        <textarea 
          className="form-control mb-2" 
          placeholder="Examen direct (Microscopie)" 
          defaultValue={OPTIONS_PARASITO.direct_defaut}
          onChange={e => setParaData({...paraData, direct: e.target.value})} 
        />
        <textarea className="form-control" placeholder="Conclusion" onChange={e => setParaData({...paraData, conclusion: e.target.value})} />
      </div>
    );
  }

  // CAS : SPERMOGRAMME
  if (cat.includes("spermo")) {
    return (
      <div className="p-3 border rounded bg-secondary bg-opacity-10">
        <h6 className="fw-bold">🧬 Spermogramme</h6>
        <div className="row g-2">
          <div className="col-md-3">
            <label className="small">Volume (mL)</label>
            <input type="text" className="form-control form-control-sm" placeholder="ex: 3.5" onChange={e => setSpermoData({...spermoData, volume: e.target.value})} />
          </div>
          <div className="col-md-3">
            <label className="small">pH</label>
            <input type="text" className="form-control form-control-sm" defaultValue="8.0" onChange={e => setSpermoData({...spermoData, ph: e.target.value})} />
          </div>
          <div className="col-md-6">
            <label className="small">Viscosité</label>
            <select className="form-select form-select-sm" onChange={e => setSpermoData({...spermoData, viscosite: e.target.value})}>
              {OPTIONS_SPERMO.viscosite.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="col-md-4">
            <label className="small">Mobilité Rapide (%)</label>
            <input type="text" className="form-control form-control-sm" onChange={e => setSpermoData({...spermoData, m_rapide: e.target.value})} />
          </div>
          <div className="col-md-4">
            <label className="small">Formes Typiques (%)</label>
            <input type="text" className="form-control form-control-sm" onChange={e => setSpermoData({...spermoData, f_typiques: e.target.value})} />
          </div>
          <div className="col-md-4">
            <label className="small">Numération (M/mL)</label>
            <input type="text" className="form-control form-control-sm" onChange={e => setSpermoData({...spermoData, num_totale: e.target.value})} />
          </div>
        </div>
      </div>
    );
  }

  // CAS 1 : BACTÉRIOLOGIE (Formulaire complexe + Antibiogramme)
  if (cat.includes("bactério")) {
    return (
      <div className="p-3 border rounded bg-warning bg-opacity-10">
        <h6 className="fw-bold">🧫 Examen Bactériologique</h6>
        <input className="form-control mb-2" placeholder="Nature du prélèvement" onChange={e => setBacterioData({...bacterioData, nature: e.target.value})} />
        <textarea className="form-control mb-2" placeholder="Examen direct / Gram" onChange={e => setBacterioData({...bacterioData, direct: e.target.value})} />
        <input className="form-control mb-2" placeholder="Culture / Identification" onChange={e => setBacterioData({...bacterioData, culture: e.target.value})} />
        <hr />
        <p className="small">Antibiogramme (Nom / SIR)</p>
        {renderTableauSaisie()} 
      </div>
    );
  }

  // CAS 2 : SÉROLOGIE (Index + Conclusion rapide)
  if (cat.includes("serologie")) {
    return (
      <div className="p-3 border rounded bg-info bg-opacity-10">
        <h6 className="fw-bold text-info">💉 Test Sérologique / Immunologie</h6>
        <div className="row g-3 align-items-end">
          
          {/* CHAMP SEUIL (Configurable) */}
          <div className="col-md-3">
            <label className="small fw-bold">Valeur normale</label>
            <div className="input-group input-group-sm">
              <input 
                type="text" 
                className="form-control" 
                value={seroData.cutoff} 
                onChange={(e) => {
                  const nSeuil = e.target.value;
                  setSeroData(prev => ({
                    ...prev, 
                    cutoff: nSeuil,
                    // Si c'est déjà négatif, on met à jour la valeur en temps réel
                    index: prev.interpretation === "Négatif" ? `< ${nSeuil}` : prev.index
                  }));
                }}
              />
              <span className="input-group-text">mg/L</span>
            </div>
          </div>

          {/* CHAMP INTERPRÉTATION */}
          <div className="col-md-4">
            <label className="small fw-bold">Interprétation</label>
            <select 
              className="form-select form-select-sm" 
              value={seroData.interpretation}
              onChange={(e) => handleSeroInterpretationChange(e.target.value)}
            >
              <option value="Négatif">Négatif (Normal)</option>
              <option value="Positif">Positif (Pathologique)</option>
              <option value="Douteux">Douteux / A recontrôler</option>
            </select>
          </div>

          {/* CHAMP VALEUR / INDEX */}
          <div className="col-md-5">
            <label className="small fw-bold">Valeur trouvée (Résultat)</label>
            <input 
              className={`form-control form-control-sm fw-bold ${seroData.interpretation === 'Positif' ? 'text-danger' : 'text-success'}`}
              placeholder="Ex: 12.5 ou < 6" 
              value={seroData.index} 
              onChange={(e) => setSeroData({...seroData, index: e.target.value})} 
            />
          </div>

        </div>
        <p className="mt-2 mb-0 x-small text-muted">
          * Si négatif, la valeur est automatiquement formatée à <strong>{"< " + seroData.cutoff}</strong>.
        </p>
      </div>
    );
  }

 // CAS PAR DÉFAUT (Biochimie, etc.)
    return (
      <div>
        {cat.includes("hématologie") && (
          <textarea 
            className="form-control mb-3" 
            placeholder="Observations Frottis..." 
            onChange={e => setHematoData({...hematoData, obs: e.target.value})} 
          />
        )}
        {renderTableauSaisie()}
      </div>
    );
};

const renderTableauSaisie = () => (
    <div className="table-responsive">
      <table className="table table-bordered align-middle">
        <thead className="table-light">
          <tr>
            <th style={{ width: '30%' }}>Paramètre</th>
            <th>Résultat / Valeur</th>
            <th>Normes & Unité</th>
            <th>Interprétation</th>
          </tr>
        </thead>
        <tbody>
          {parametres.map((p, index) => (
            <tr key={index}>
              <td className="fw-bold text-secondary">{p.nom || "Paramètre libre"}</td>
              <td>
                <div className="input-group input-group-sm">
                  <input 
                    type="text" 
                    className="form-control fw-bold border-primary" 
                    value={p.valeur} 
                    onChange={(e) => handleParamChange(index, 'valeur', e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                  />
                  {p.unite && <span className="input-group-text bg-white text-muted">{p.unite}</span>}
                </div>
              </td>
              <td className="small text-muted">{p.normale} {p.unite}</td>
              <td>
                <select 
                  className={`form-select form-select-sm ${p.interpretation === 'Normal' ? 'text-success' : 'text-danger'}`}
                  value={p.interpretation} 
                  onChange={(e) => handleParamChange(index, 'interpretation', e.target.value)}
                >
                  <option value="">-</option>
                  <option value="Normal">Normal</option>
                  <option value="Elevé">Elevé</option>
                  <option value="Bas">Bas</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!selectedExamen?.parametre && (
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={ajouterParametre}>
          + Ajouter un paramètre
        </button>
      )}
    </div>
  );
  return (
  <div className="container-fluid mt-4">
    {/* DATALISTS pour l'auto-complétion */}
    <datalist id="liste-unites">
      {UNITES_LABO.map(u => u && <option key={u} value={u} />)}
    </datalist>
    <datalist id="liste-parametres">
      {Object.keys(REFERENTIEL_NORMES).map(name => <option key={name} value={name} />)}
    </datalist>

    <div className="row">
      {/* --- COLONNE GAUCHE : LISTE D'ATTENTE --- */}
      <div className="col-md-4">
        <div className="card shadow-sm border-0">
          <div className="card-header bg-primary text-white fw-bold">⏳ Examens en attente</div>
          <div className="p-2 bg-light">
            <input 
              type="text" 
              className="form-control form-control-sm" 
              placeholder="Rechercher patient..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
          <div className="list-group list-group-flush" style={{maxHeight: '75vh', overflowY: 'auto'}}>
            {filteredAttente.map(ex => (
              <button 
                key={ex.id_ligne} 
                className={`list-group-item list-group-item-action ${selectedExamen?.id_ligne === ex.id_ligne ? 'active' : ''}`} 
                onClick={() => setSelectedExamen(ex)}
              >
                <div className="d-flex justify-content-between">
                  <small className={selectedExamen?.id_ligne === ex.id_ligne ? 'text-white' : 'text-primary'}>
                    {ex.categorie}
                  </small>
                  <small className="text-muted">{new Date(ex.date_demande).toLocaleDateString()}</small>
                </div>
                <strong className="d-block text-uppercase">{ex.nom} {ex.prenom}</strong>
                <div className="small italic">{ex.nom_examen}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* --- COLONNE DROITE : FORMULAIRE DE SAISIE --- */}
      <div className="col-md-8">
        {selectedExamen ? (
          <div className="card shadow-lg p-4 border-0 animate__animated animate__fadeIn">
            <h4 className="text-primary border-bottom pb-2 mb-4">
              🔬 {selectedExamen.categorie} : {selectedExamen.nom_examen}
            </h4>
            
            <div className="row mb-4">
              <div className="col-md-6">
                <label className="small fw-bold text-secondary">Responsable Validation</label>
                <input 
                  className="form-control border-primary" 
                  value={validePar} 
                  onChange={e => setValidePar(e.target.value)} 
                  placeholder="Nom du biologiste / technicien" 
                />
              </div>
              <div className="col-md-6">
                <label className="small fw-bold text-secondary">Patient</label>
                <input 
                  className="form-control bg-light fw-bold" 
                  value={`${selectedExamen.nom} ${selectedExamen.prenom}`} 
                  disabled 
                />
              </div>
            </div>

            {/* FORMULAIRE DYNAMIQUE SELON LA CATÉGORIE */}
            <div className="mb-4">
              {renderFormulaireDynamique()}
            </div>

            <button 
              className="btn btn-success btn-lg w-100 shadow-sm fw-bold" 
              onClick={soumettreResultat}
            >
              ✅ ENREGISTRER ET VALIDER LE RÉSULTAT
            </button>
          </div>
        ) : (
          <div className="text-center p-5 border rounded bg-white shadow-sm h-100 d-flex flex-column justify-content-center">
            <i className="bi bi-microscope text-light" style={{fontSize: '4rem'}}></i>
            <h5 className="text-muted">Sélectionnez un examen dans la liste de gauche pour commencer la saisie.</h5>
          </div>
        )}
      </div>
    </div>

    {/* SECTION BAS : HISTORIQUE */}
      <div className="card shadow border-0 mt-5 mb-5">
        <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">📋 Historique des Résultats Effectués</h5>
          <button className="btn btn-sm btn-outline-light" onClick={chargerArchives}>🔄 Actualiser</button>
        </div>
        <div className="card-body">
          <div className="row g-3 mb-4 bg-light p-3 rounded shadow-sm">
            <div className="col-md-4">
              <label className="small fw-bold">Recherche</label>
              <input type="text" className="form-control" placeholder="Patient ou Examen..." value={searchArchive} onChange={e => setSearchArchive(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="small fw-bold">Du</label>
              <input type="date" className="form-control" value={filterDateDebut} onChange={e => setFilterDateDebut(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="small fw-bold">Au</label>
              <input type="date" className="form-control" value={filterDateFin} onChange={e => setFilterDateFin(e.target.value)} />
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button className="btn btn-secondary w-100" onClick={() => {setSearchArchive(""); setFilterDateDebut(""); setFilterDateFin("");}}>Réinitialiser</button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover border">
              <thead className="table-secondary">
                <tr>
                  <th onClick={() => setSortConfig({key: 'date_validation', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'})} style={{cursor: 'pointer'}}>
                    Date {sortConfig.key === 'date_validation' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Patient</th>
                  <th>Examen</th>
                  <th>Responsable</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivesFiltrees.map((res, index) => (
                  <tr key={index}>
                    <td>{new Date(res.date_validation).toLocaleString()}</td>
                    <td className="fw-bold text-uppercase">{res.nom_patient}</td>
                    <td><span className="badge bg-info text-dark">{res.nom_examen}</span></td>
                    <td>{res.valide_par}</td>
                    <td className="text-center">
                      <button className="btn btn-sm btn-outline-primary me-2">🖨️ Imprimer</button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => preparerModification(res)}>✏️ Modifier</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  </div>
);
}

export default SaisieResultat;
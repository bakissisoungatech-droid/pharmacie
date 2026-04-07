import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import socket from "../socket";

function ExamenCRUD() {
  const [data, setData] = useState([]);
  const [nomExamen, setNomExamen] = useState("");
  const [categorie, setCategorie] = useState("");
  const [parametre, setParametre] = useState("");
  const [editId, setEditId] = useState(null);
  const [sousCategories, setSousCategories] = useState("");
  const [isBilanMode, setIsBilanMode] = useState(false);
  const [examensInclus, setExamensInclus] = useState([]); // IDs des examens à affilier
  const [valeursDefaut, setValeursDefaut] = useState("");
  const [prix, setPrix] = useState("");
  const [resultat, setResultat] = useState("");

  const [searchBilan, setSearchBilan] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategorie, setFilterCategorie] = useState("tous");
  const [sortConfig, setSortConfig] = useState({ key: "nom_examen", direction: "asc" });

  // --- RÉFÉRENTIEL DES PARAMÈTRES (Options suggérées) ---
  const SUGGESTIONS_PARAMETRES = [
    "Glycémie", "Urée", "Créatinine", "Cholestérol", "Triglycérides", 
    "Acide Urique", "ASAT", "ALAT", "NFS", "VS", "Groupe Sanguin"
  ];

  const loadExamens = useCallback(async () => {
    try {
      const r = await axios.get(`http://localhost:3000/api/examen/`);
      setData(r.data);
    } catch (error) {
      console.error("Erreur chargement examens", error);
    }
  }, []);

  useEffect(() => {
    loadExamens();
    socket.on("examens_updated", loadExamens);
    return () => socket.off("examens_updated", loadExamens);
  }, [loadExamens]);

  const filteredData = useMemo(() => {
    let result = Array.isArray(data) ? data.filter((item) => {
      const matchSearch = item.nom_examen?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = filterCategorie === "tous" || item.categorie === filterCategorie;
      const matchActif = item.est_actif !== false;
      return matchSearch && matchCat && matchActif;
    }) : [];

    result.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [data, searchTerm, filterCategorie, sortConfig]);

  // Liste des catégories existantes en base pour le menu déroulant
  const categoriesExistantes = useMemo(() => {
    return [...new Set(data.map(ex => ex.categorie))].filter(Boolean);
  }, [data]);

  // Mise à jour du Submit
  const submit = async (e) => {
    e.preventDefault();

    const payload = { 
      nom_examen: nomExamen, 
      categorie: isBilanMode ? "BILAN" : categorie, 
      parametre: isBilanMode ? "" : parametre,     
      valeurs_defaut: isBilanMode ? "" : valeursDefaut,
      sous_categories: sousCategories,
      examens_inclus: isBilanMode ? examensInclus : [],
      prix: prix, 
      // On envoie la chaîne brute. 
      // Exemple: "Négatif, Négatif" pour un examen à 2 paramètres.
      resultat: isBilanMode ? "" : resultat 
    };

    try {
      if (editId) {
        await axios.put(`http://localhost:3000/api/examen/${editId}`, payload);
      } else {
        await axios.post("http://localhost:3000/api/examen/post", payload);
      }
      resetForm();
      loadExamens();
      alert("Catalogue mis à jour avec succès !");
    } catch (error) {
      console.error("Erreur:", error.response?.data || error.message);
    }
  };

  // Modification de la fonction edit pour détecter le bilan via la catégorie
  const edit = (ex) => {
    setEditId(ex.id_examen);
    setNomExamen(ex.nom_examen);
    setSousCategories(ex.sous_categories || "");
    setParametre(ex.parametre || "");
    setValeursDefaut(ex.valeurs_defaut || "");
    setPrix(ex.prix || "");      // Charger le prix
    setResultat(ex.resultat || ""); // Charger le résultat

    if (ex.categorie === 'BILAN') {
      setIsBilanMode(true);
      setCategorie("BILAN");
    } else {
      setIsBilanMode(false);
      setCategorie(ex.categorie);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setNomExamen("");
    setCategorie("");
    setSousCategories("");
    setParametre("");
    setValeursDefaut("");
    setPrix("");     // Reset
    setResultat(""); // Reset
    setEditId(null);
    setExamensInclus([]);
    setIsBilanMode(false);
  };

  // --- FONCTIONS DE SUPPRESSION ADAPTÉES ---
  const handleArchive = async (id) => {
    if (window.confirm("Archiver cet examen ?")) {
      try {
        await axios.patch(`http://localhost:3000/api/examen/archive/${id}`);
        loadExamens();
      } catch (error) { alert("Erreur d'archivage"); }
    }
  };

  const handleFullDelete = async (id) => {
    const code = prompt("⚠️ PURGE TOTALE ⚠️\nSupprime l'examen et TOUS ses résultats passés.\nTapez 'CONFIRMER' :");
    if (code === "CONFIRMER") {
      try {
        await axios.delete(`http://localhost:3000/api/examen/full-delete/${id}`);
        loadExamens();
      } catch (error) { alert("Erreur lors de la purge"); }
    }
  };

  return (
  <div className="container mt-4">
    <h3 className="no-print mb-4">⚙️ Configuration du Catalogue</h3>

    {/* Sélecteur de Mode */}
    <div className="btn-group mb-3 w-100 shadow-sm">
      <button 
        type="button"
        className={`btn ${!isBilanMode ? 'btn-primary' : 'btn-outline-primary'}`} 
        onClick={() => { 
          setIsBilanMode(false); 
          setCategorie(""); // On réinitialise la catégorie pour un examen normal
        }}
      >
        🧬 Examen Individuel
      </button>
      <button 
        type="button"
        className={`btn ${isBilanMode ? 'btn-success' : 'btn-outline-success'}`} 
        onClick={() => { 
          setIsBilanMode(true); 
          setCategorie("BILAN"); // On force la catégorie BILAN
        }}
      >
        📁 Créer un Bilan (Pack)
      </button>
    </div>

    {/* --- SECTION BILAN (Affichage des examens à inclure) --- */}
    {isBilanMode && (
      <div className="card p-3 border-success mb-3 shadow-sm bg-white">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <label className="fw-bold text-success m-0">Sélectionner les examens du pack :</label>
          <span className="badge bg-success">{examensInclus.length} sélectionné(s)</span>
        </div>
        
        <input 
          type="text" 
          className="form-control form-control-sm mb-2" 
          placeholder="🔍 Rechercher un examen à inclure..." 
          value={searchBilan}
          onChange={(e) => setSearchBilan(e.target.value)}
        />

        <div className="border rounded p-2 bg-light" style={{ maxHeight: '200px', overflowY: 'auto' }}>
          <div className="row g-2">
            {data
              .filter(ex => ex.categorie !== 'BILAN' && ex.nom_examen.toLowerCase().includes(searchBilan.toLowerCase()))
              .map(ex => (
                <div className="col-md-4" key={ex.id_examen}>
                  <div 
                    className={`p-2 border rounded small d-flex align-items-center justify-content-between ${examensInclus.includes(ex.id_examen) ? 'bg-success text-white' : 'bg-white'}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setExamensInclus(prev => 
                        prev.includes(ex.id_examen) ? prev.filter(id => id !== ex.id_examen) : [...prev, ex.id_examen]
                      );
                    }}
                  >
                    <span className="text-truncate">{ex.nom_examen}</span>
                    {examensInclus.includes(ex.id_examen) ? <span>✅</span> : <small className="text-muted">{ex.categorie?.charAt(0)}</small>}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    )}

    {/* FORMULAIRE PRINCIPAL */}
    <form onSubmit={submit} className="card p-3 shadow-sm mb-4 border-0 bg-light">
      <div className="row g-3">
        <div className="col-md-4">
          <label className="small fw-bold">{isBilanMode ? "Nom du Bilan (Pack)" : "Nom de l'examen"}</label>
          <input 
            className="form-control" 
            value={nomExamen} 
            onChange={(e)=>setNomExamen(e.target.value)} 
            required 
            placeholder={isBilanMode ? "ex: Bilan Lipidique" : "ex: Glycémie"} 
          />
        </div>
        
        {!isBilanMode && (
          <div className="col-md-4">
            <label className="small fw-bold">Catégorie</label>
            <input className="form-control" list="list-categories" value={categorie} onChange={(e)=>setCategorie(e.target.value)} required />
          </div>
        )}

        <div className="col-md-4">
          <label className="small fw-bold">Sous-Catégorie</label>
          <input className="form-control" value={sousCategories} onChange={(e)=>setSousCategories(e.target.value)} />
        </div>

        {/* --- CORRECTION ICI : Champ Paramètres affiché si on n'est PAS en mode Bilan --- */}
        {!isBilanMode && (
        <div className="row g-3 mt-1">
          <div className="col-md-6">
            <label className="small fw-bold text-primary">Noms des Paramètres</label>
            <input 
              className="form-control" 
              placeholder="Ex: LMS, LMD, MDC" 
              value={parametre} 
              onChange={(e) => setParametre(e.target.value)}
            />
            <div className="form-text">Les noms des lignes (séparés par des virgules).</div>
          </div>
          
          <div className="col-md-6">
            <label className="small fw-bold text-success">Valeurs par défaut (Optionnel)</label>
            <input 
              className="form-control" 
              placeholder="Ex: Négatif, Négatif, Négatif" 
              value={valeursDefaut} 
              onChange={(e) => setValeursDefaut(e.target.value)}
            />
            <div className="form-text">Pré-remplissage des résultats dans le même ordre.</div>
          </div>
        </div>
      )}

      <div className="row mb-3">
      {!isBilanMode && (
        <div className="col-md-6">
          <label className="form-label fw-bold text-danger">Unités / Résultats (par défaut)</label>
          <input 
            type="text" 
            className="form-control border-danger" 
            value={resultat} 
            onChange={(e) => setResultat(e.target.value)} 
            placeholder="Ex: mg/L, Négatif, UI/mL"
          />
          <div className="form-text">
            Séparez par des virgules si l'examen a plusieurs paramètres (ex: Négatif, Positif).
          </div>
        </div>
      )}

      <div className="col-md-6">
        <label className="form-label fw-bold">Prix (FCFA)</label>
        <input 
          type="number" 
          className="form-control" 
          value={prix} 
          onChange={(e) => setPrix(e.target.value)} 
          placeholder="Ex: 5000"
        />
      </div>
    </div>
      </div>

      <div className="d-flex gap-2 mt-3">
        <button type="submit" className={`btn ${editId ? 'btn-warning' : (isBilanMode ? 'btn-success' : 'btn-primary')} flex-grow-1 fw-bold`}>
          {editId ? "💾 METTRE À JOUR" : (isBilanMode ? "➕ ENREGISTRER LE BILAN" : "➕ AJOUTER AU CATALOGUE")}
        </button>
        {editId && <button type="button" className="btn btn-secondary" onClick={resetForm}>Annuler</button>}
      </div>
    </form>
    
    <div className="row mb-3 g-2 no-print align-items-end">
        <div className="col-md-8">
          <label className="small fw-bold">Recherche rapide</label>
          <input className="form-control" placeholder="🔍 Rechercher un examen par nom..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
        </div>
        <div className="col-md-4">
          <label className="small fw-bold">Filtrer par Catégorie</label>
          <select className="form-select" value={filterCategorie} onChange={(e)=>setFilterCategorie(e.target.value)}>
            <option value="tous">Toutes les catégories</option>
            {categoriesExistantes.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      <div className="table-responsive shadow-sm rounded">
        <table className="table table-hover">
          <thead className="table-dark">
            <tr>
              <th>Examen</th>
              <th>Configuration (Paramètre : Valeur)</th>
              <th>prix</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((ex) => {
              const params = ex.parametre ? ex.parametre.split(',') : [];
              const defaults = ex.valeurs_defaut ? ex.valeurs_defaut.split(',') : [];

              return (
                <tr key={ex.id_examen}>
                  <td>
                    <div className="fw-bold">{ex.nom_examen}</div>
                    <small className={`badge ${ex.categorie === 'BILAN' ? 'bg-success' : 'bg-light text-dark border'}`}>
                      {ex.categorie}
                    </small>
                  </td>
                  <td>
                    {ex.categorie === 'BILAN' ? (
                      <span className="text-success small italic">📦 Composition du pack (Bilan)</span>
                    ) : params.length > 0 ? (
                      <div className="d-flex flex-wrap gap-1">
                        {params.map((p, i) => (
                          <span key={i} className="badge border text-dark bg-white">
                            {p.trim()} {defaults[i] ? ` : ${defaults[i].trim()}` : ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted small italic">Saisie libre</span>
                    )}
                  </td>
                  <td>
                    <div className="fw-bold">{ex.prix}</div>
                  </td>
                  <td className="no-print">
                    <div className="btn-group">
                      <button onClick={() => edit(ex)} className="btn btn-warning btn-sm">✏️</button>
                      <button onClick={() => handleArchive(ex.id_examen)} className="btn btn-outline-danger btn-sm">📦</button>
                      <button onClick={() => handleFullDelete(ex.id_examen)} className="btn btn-danger btn-sm">🗑️</button>
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

export default ExamenCRUD;
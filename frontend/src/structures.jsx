import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';

// --- COMPOSANT COMPTE À REBOURS ---
function CompteARebours({ dateExpiration }) {
  const [tempsRestant, setTempsRestant] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!dateExpiration) {
      setTempsRestant("Non définie");
      return;
    }

    const calculerTemps = () => {
      const difference = new Date(dateExpiration) - new Date();
      if (difference <= 0) {
        setTempsRestant("Expiré 🚫");
        setIsExpired(true);
        return;
      }
      const jours = Math.floor(difference / (1000 * 60 * 60 * 24));
      const heures = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);

      if (jours > 30) {
        setTempsRestant(`${jours} jours`);
      } else {
        setTempsRestant(`⚠️ ${jours}j ${heures}h ${minutes}m`);
      }
    };

    calculerTemps();
    const interval = setInterval(calculerTemps, 60000);
    return () => clearInterval(interval);
  }, [dateExpiration]);

  return (
    <span className={`badge ${isExpired ? "bg-danger" : tempsRestant.includes("⚠️") ? "bg-warning text-dark" : "bg-success"}`}>
      {tempsRestant}
    </span>
  );
}

function GestionStructures() {
  // États CRUD standards et nouveaux champs
  const [data, setData] = useState([]);
  const [nom, setNom] = useState("");
  const [raisonSociale, setRaisonSociale] = useState("");
  const [adresse, setAdresse] = useState("");
  const [telephone, setTelephone] = useState("");
  const [mdp, setMdp] = useState("");
  const [logo, setLogo] = useState(""); // Contiendra la chaîne Base64 (data:image/...;base64,...)
  const [dateExpiration, setDateExpiration] = useState("");
  const [actif, setActif] = useState(true);
  const [editId, setEditId] = useState(null);

  // NOUVEAUX ÉTATS POUR LES COLONNES AJOUTÉES
  const [pays, setPays] = useState("");
  const [ville, setVille] = useState("");

  // Authentification de terminal
  const [loginNom, setLoginNom] = useState("");
  const [loginMdp, setLoginMdp] = useState("");
  const [currentStructureId, setCurrentStructureId] = useState(localStorage.getItem("id_structure"));

  const loadData = useCallback(async () => {
    try {
      const response = await axios.get(`http://192.168.100.34:3000/api/structure`);
      setData(response.data);
    } catch (error) {
      console.error("Erreur de chargement des structures", error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- MÉTHODE DE CONVERSION DE L'IMAGE EN BASE64 ---
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Limitation optionnelle à 1 Mo pour ne pas surcharger la base de données
      if (file.size > 1024 * 1024) {
        alert("Le logo est trop lourd. Choisissez une image de moins de 1 Mo.");
        e.target.value = ""; // Réinitialise l'input
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result); // Stocke la chaîne Base64 complète
      };
      reader.readAsDataURL(file);
    }
  };

  // Envoi Formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nom || !raisonSociale) {
      alert("Le nom et la raison sociale sont obligatoires");
      return;
    }

    const formData = { 
      nom, 
      raison_sociale: raisonSociale, 
      adresse, 
      telephone, 
      mdp,
      logo, // Envoyé sous forme de chaîne de caractères
      date_expiration: dateExpiration || null,
      actif,
      pays: pays || null, // NOUVEAU
      ville: ville || null  // NOUVEAU
    };

    try {
      if (editId) {
        await axios.put(`http://192.168.100.34:3000/api/structure/${editId}`, formData);
        alert("Structure mise à jour !");
      } else {
        if (!mdp) { alert("Le mot de passe est obligatoire à la création"); return; }
        await axios.post(`http://192.168.100.34:3000/api/structure/post`, formData);
        alert("Structure créée !");
      }
      
      resetForm();
      loadData();
      // Réinitialiser manuellement l'input file du DOM
      const fileInput = document.getElementById("logoInput");
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Erreur lors de l'enregistrement", error);
      alert("Erreur : " + (error.response?.data?.error || error.message));
    }
  };

  const resetForm = () => {
    setNom("");
    setRaisonSociale("");
    setAdresse("");
    setTelephone("");
    setMdp("");
    setLogo("");
    setDateExpiration("");
    setActif(true);
    setPays(""); // NOUVEAU
    setVille(""); // NOUVEAU
    setEditId(null);
    const fileInput = document.getElementById("logoInput");
    if (fileInput) fileInput.value = "";
  };

  const handleToggleActif = async (id) => {
    try {
      await axios.patch(`http://192.168.100.34:3000/api/structure/${id}/toggle-actif`);
      if (currentStructureId === id) {
        handleLogoutStructure();
      }
      loadData();
    } catch (error) {
      alert("Erreur de modification d'état");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer cette structure ?")) {
      try {
        await axios.delete(`http://192.168.100.34:3000/api/structure/${id}`);
        if (currentStructureId === id) handleLogoutStructure();
        loadData();
      } catch (error) {
        alert("Impossible de supprimer la structure.");
      }
    }
  };

  const handleEdit = (s) => {
    setNom(s.nom || "");
    setRaisonSociale(s.raison_sociale || "");
    setAdresse(s.adresse || "");
    setTelephone(s.telephone || "");
    setLogo(s.logo || ""); // Si s.logo est null, l'état devient "" au lieu de rompre le contrôle
    setDateExpiration(s.date_expiration ? s.date_expiration.substring(0, 16) : ""); 
    setActif(s.actif ?? true);
    setPays(s.pays || ""); // NOUVEAU
    setVille(s.ville || ""); // NOUVEAU
    setMdp(""); 
    setEditId(s.id_structure);
  };

  const handleLoginStructure = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`http://192.168.100.34:3000/api/structure/connexion`, {
        nom: loginNom,
        mdp: loginMdp
      });

      if (response.data.success) {
        const uuidStructure = response.data.structureId;
        localStorage.setItem("id_structure", uuidStructure);
        setCurrentStructureId(uuidStructure);
        alert("Structure identifiée !");
        setLoginNom("");
        setLoginMdp("");
      }
    } catch (error) {
      alert("Échec d'authentification : " + (error.response?.data?.message || "Erreur d'accès"));
    }
  };

  const handleLogoutStructure = () => {
    localStorage.removeItem("id_structure");
    setCurrentStructureId(null);
    alert("Structure effacée.");
  };

  return (
    <div className="container-fluid pt-4 bg-light" style={{ minHeight: "100vh" }}>
      <div className="container-fluid">
        <h2 className="mb-4 fw-bold text-primary">Gestion Multi-Établissements</h2>

        {/* STATUT TERMINAL */}
        <div className="alert alert-white border shadow-sm d-flex justify-content-between align-items-center mb-4">
          <div>
            <strong>📍 Statut de ce poste :</strong> {currentStructureId ? (
              <span> Lié à l'UUID : <code className="text-success">{currentStructureId}</code></span>
            ) : (
              <span className="text-danger"> Aucun terminal configuré sur ce navigateur.</span>
            )}
          </div>
          {currentStructureId && (
            <button onClick={handleLogoutStructure} className="btn btn-sm btn-danger">Délier l'appareil</button>
          )}
        </div>

        <div className="row g-4">
          {/* PANNEAU DE CONFIGURATION */}
          <div className="col-xl-4">
            <div className="card p-4 shadow-sm border-0 mb-4">
              <h5 className="fw-bold text-dark mb-3">{editId ? "📝 Éditer l'Établissement" : "➕ Ajouter un Établissement"}</h5>
              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-6 mb-2">
                    <label className="form-label small mb-1">Nom Code (Unique)</label>
                    <input type="text" className="form-control form-control-sm" value={nom} onChange={(e) => setNom(e.target.value)} required />
                  </div>
                  <div className="col-6 mb-2">
                    <label className="form-label small mb-1">Raison Sociale</label>
                    <input type="text" className="form-control form-control-sm" value={raisonSociale} onChange={(e) => setRaisonSociale(e.target.value)} required />
                  </div>
                </div>
                
                {/* INPUT POUR LE LOGO */}
                <div className="mb-2">
                  <label className="form-label small mb-1">Logo de l'Établissement</label>
                  <input 
                    id="logoInput"
                    type="file" 
                    className="form-control form-control-sm" 
                    accept="image/*"
                    onChange={handleLogoChange} 
                  />
                  {logo && (
                    <div className="mt-2 d-flex align-items-center gap-2 bg-light p-2 rounded border">
                      <img src={logo} alt="Aperçu" className="rounded" style={{ width: "40px", height: "40px", objectFit: "cover" }} />
                      <span className="text-muted" style={{ fontSize: "0.75rem" }}>Fichier chargé en mémoire</span>
                      <button type="button" className="btn btn-sm btn-link text-danger ms-auto p-0" onClick={() => { setLogo(""); const input = document.getElementById("logoInput"); if(input) input.value=""; }}>Supprimer</button>
                    </div>
                  )}
                </div>

                {/* SÉLECTEUR GÉOGRAPHIQUE : PAYS & VILLE */}
                <div className="row">
                  <div className="col-6 mb-2">
                    <label className="form-label small mb-1">Pays</label>
                    <input 
                      type="text" 
                      className="form-control form-control-sm" 
                      placeholder="ex: Congo, France..." 
                      value={pays} 
                      onChange={(e) => setPays(e.target.value)} 
                    />
                  </div>
                  <div className="col-6 mb-2">
                    <label className="form-label small mb-1">Ville</label>
                    <input 
                      type="text" 
                      className="form-control form-control-sm" 
                      placeholder="ex: Pointe-Noire, Paris..." 
                      value={ville} 
                      onChange={(e) => setVille(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="row">
                  <div className="col-6 mb-2">
                    <label className="form-label small mb-1">Téléphone</label>
                    <input type="text" className="form-control form-control-sm" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
                  </div>
                  <div className="col-6 mb-2">
                    <label className="form-label small mb-1">Fin Abonnement</label>
                    <input type="datetime-local" className="form-control form-control-sm" value={dateExpiration} onChange={(e) => setDateExpiration(e.target.value)} />
                  </div>
                </div>

                <div className="mb-2">
                  <label className="form-label small mb-1">Adresse Géographique</label>
                  <input type="text" className="form-control form-control-sm" value={adresse || ""} onChange={(e) => setAdresse(e.target.value)} />
                </div>

                <div className="mb-3">
                  <label className="form-label small mb-1">Clé d'accès (Password)</label>
                  <input type="password" className="form-control form-control-sm" value={mdp} onChange={(e) => setMdp(e.target.value)} placeholder={editId ? "Inchangé si vide" : ""} />
                </div>
                
                <div className="d-flex gap-2">
                  <button className="btn btn-primary btn-sm flex-grow-1" type="submit">Enregistrer</button>
                  {editId && <button className="btn btn-secondary btn-sm" type="button" onClick={resetForm}>Annuler</button>}
                </div>
              </form>
            </div>

            <div className="card p-4 shadow-sm border-0">
              <h5 className="fw-bold text-secondary mb-3">🔑 Enrôler ce navigateur</h5>
              <form onSubmit={handleLoginStructure}>
                <div className="mb-2">
                  <input type="text" className="form-control form-control-sm" placeholder="Nom de la structure" value={loginNom} onChange={(e) => setLoginNom(e.target.value)} required />
                </div>
                <div className="mb-3">
                  <input type="password" className="form-control form-control-sm" placeholder="Mot de passe structure" value={loginMdp} onChange={(e) => setLoginMdp(e.target.value)} required />
                </div>
                <button className="btn btn-dark btn-sm w-100" type="submit">Associer ce Terminal</button>
              </form>
            </div>
          </div>

          {/* TABLEAU DES STRUCTURES */}
          <div className="col-xl-8">
            <div className="card p-4 shadow-sm border-0">
              <h5 className="fw-bold text-success mb-3">Registre des Cliniques & Pharmacies</h5>
              <div className="table-responsive">
                <table className="table align-middle table-hover">
                  <thead className="table-light small">
                    <tr>
                      <th>Logo</th>
                      <th>Structure</th>
                      <th>Localisation</th> {/* NOUVEAU TITRE DE COLONNE */}
                      <th>Abonnement / Validité</th>
                      <th>Visibilité / Statut</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="small">
                    {data.map((s) => (
                      <tr key={s.id_structure} className={!s.actif ? "table-light text-muted" : ""}>
                        <td>
                          {s.logo ? (
                            <img src={s.logo} alt="Logo" className="rounded border" style={{ width: "40px", height: "40px", objectFit: "cover" }} />
                          ) : (
                            <div className="bg-secondary text-white rounded d-flex align-items-center justify-content-center border" style={{ width: "40px", height: "40px", fontSize: "0.8rem" }}>🏥</div>
                          )}
                        </td>
                        <td>
                          <div className="fw-bold">{s.nom}</div>
                          <span className="text-muted text-uppercase" style={{ fontSize: "0.75rem" }}>{s.raison_sociale}</span>
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>{s.telephone || "Pas de numéro"}</div>
                        </td>
                        {/* NOUVELLE CELLULE : LOCALISATION (PAYS / VILLE ET ADRESSE) */}
                        <td>
                          {s.ville || s.pays ? (
                            <div className="fw-bold text-dark">
                              {s.ville && <span>{s.ville}</span>}
                              {s.ville && s.pays && <span>, </span>}
                              {s.pays && <span className="text-secondary">{s.pays}</span>}
                            </div>
                          ) : (
                            <div className="text-muted italic">Non renseigné</div>
                          )}
                          <div className="text-muted text-truncate" style={{ fontSize: "0.75rem", maxWidth: "150px" }} title={s.adresse}>
                            {s.adresse || "Pas d'adresse"}
                          </div>
                        </td>
                        <td>
                          <CompteARebours dateExpiration={s.date_expiration} />
                          <div className="text-muted mt-1" style={{ fontSize: "0.7rem" }}>
                            {s.date_expiration ? new Date(s.date_expiration).toLocaleDateString() : "Indéterminée"}
                          </div>
                        </td>
                        <td>
                          <div className="form-check form-switch">
                            <input 
                              className="form-check-input" 
                              type="checkbox" 
                              role="switch"
                              checked={s.actif} 
                              onChange={() => handleToggleActif(s.id_structure)} 
                            />
                            <label className={`form-check-label px-1 rounded ${s.actif ? "text-success fw-bold" : "text-danger"}`}>
                              {s.actif ? "Visible" : "Cachée"}
                            </label>
                          </div>
                        </td>
                        <td className="text-end">
                          <div className="btn-group shadow-sm">
                            <button onClick={() => handleEdit(s)} className="btn btn-light btn-sm border text-warning">Modifier</button>
                            <button onClick={() => handleDelete(s.id_structure)} className="btn btn-light btn-sm border text-danger">Supprimer</button>
                          </div>
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
    </div>
  );
}

export default GestionStructures;
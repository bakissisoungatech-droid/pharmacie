import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import socket from "../socket";
import Logo from "../assets/logo.png";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

function ProduitsEtStock() {
  // --- ÉTATS GLOBAUX & SESSION ---
  const [data, setData] = useState([]);
  const [alertesPeremption, setAlertesPeremption] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [activePage, setActivePage] = useState(() => {
    return sessionStorage.getItem("activePage") || "dashboard";
  });

  // --- ÉTATS FORMULAIRE PRODUIT (CATALOGUE) ---
  const [nom, setNom] = useState("");
  const [prixVenteUnitaire, setPrixVenteUnitaire] = useState("");
  const [stockAlerte, setStockAlerte] = useState(5);
  const [editId, setEditId] = useState(null);

  // --- ÉTATS FORMULAIRE ARRIVAGE / GESTION LOTS ---
  const [selectedProduit, setSelectedProduit] = useState(null); 
  const [lotsDuProduit, setLotsDuProduit] = useState([]);
  const [quantiteDisponible, setQuantiteDisponible] = useState("");
  const [datePeremption, setDatePeremption] = useState("");
  const [prixAchatUnitaire, setPrixAchatUnitaire] = useState("");
  const [editLotId, setEditLotId] = useState(null);

  // --- RECHERCHE, FILTRES & COLLAPSE ---
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStock, setFilterStock] = useState("tous");
  const [sortConfig, setSortConfig] = useState({ key: "nom", direction: "asc" });
  const [showPeremptionCollapse, setShowPeremptionCollapse] = useState(false);

  // 1. Récupération de l'utilisateur connecté depuis sessionStorage
  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Erreur de lecture du user", e);
      }
    }
  }, []);

  // Synchronisation de la page active avec sessionStorage
  useEffect(() => {
    sessionStorage.setItem("activePage", activePage);
  }, [activePage]);

  // Récupération de l'identifiant de structure depuis sessionStorage ou l'objet user
  const getStructureId = useCallback(() => {
    return sessionStorage.getItem("id_structure") || currentUser?.id_structure;
  }, [currentUser]);

  const getAxiosConfig = useCallback(() => {
    const idStructure = getStructureId();
    if (!idStructure) return {};
    return { headers: { "id_structure": idStructure } };
  }, [getStructureId]);

  // --- CHARGER LES LOTS D'UN PRODUIT SPÉCIFIQUE ---
  const loadLotsDuProduit = useCallback(async (idProduit) => {
    if (!idProduit) return;
    try {
      const res = await axios.get(`https://pharmacie-production-9a16.up.railway.app/api/lots/produit/${idProduit}`, getAxiosConfig());
      setLotsDuProduit(res.data);
    } catch (error) {
      console.error("Erreur chargement des lots du produit", error);
    }
  }, [getAxiosConfig]);

  // --- CHARGEMENT SYNCHRONISÉ DES DONNÉES ---
  const loadToutesDonnees = useCallback(async () => {
    const idStructure = getStructureId();
    if (!idStructure) return;
    try {
      const [resProd, resAlertes] = await Promise.all([
        axios.get("https://pharmacie-production-9a16.up.railway.app/api/produit", getAxiosConfig()),
        axios.get("https://pharmacie-production-9a16.up.railway.app/api/lots/alertes-peremption", getAxiosConfig())
      ]);
      
      setData(resProd.data);
      setAlertesPeremption(resAlertes.data);
      
      if (resAlertes.data.length > 0) {
        setShowPeremptionCollapse(true);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données", error);
    }
  }, [getStructureId, getAxiosConfig]);

  useEffect(() => {
    const idStructure = getStructureId();
    if (!idStructure) return;

    loadToutesDonnees();

    const handleRefresh = () => {
      loadToutesDonnees();
      if (selectedProduit) {
        loadLotsDuProduit(selectedProduit.id_produit);
      }
    };
    socket.on("refresh_data", handleRefresh);

    return () => {
      socket.off("refresh_data", handleRefresh);
    };
  }, [getStructureId, loadToutesDonnees, loadLotsDuProduit, selectedProduit]);

  // --- ACTIONS DU CATALOGUE (PRODUITS) ---
  const submitProduit = async (e) => {
    e.preventDefault();
    const idStructure = getStructureId();
    if (!idStructure) return alert("Votre session a expiré.");

    const payload = {
      nom,
      prix_vente_unitaire: parseFloat(prixVenteUnitaire),
      stock_alerte: parseInt(stockAlerte, 10),
      id_structure: idStructure
    };

    try {
      if (editId) {
        await axios.put(`https://pharmacie-production-9a16.up.railway.app/api/produit/update/${editId}`, payload, getAxiosConfig());
      } else {
        await axios.post("https://pharmacie-production-9a16.up.railway.app/api/produit", payload, getAxiosConfig());
      }
      resetFormProduit();
      loadToutesDonnees();
      alert("Catalogue mis à jour !");
    } catch (error) {
      alert("Erreur enregistrement : " + (error.response?.data?.error || error.message));
    }
  };

  const startEdit = (p) => {
    setNom(p.nom);
    setPrixVenteUnitaire(p.prix_vente_unitaire);
    setStockAlerte(p.stock_alerte);
    setEditId(p.id_produit);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetFormProduit = () => {
    setNom("");
    setPrixVenteUnitaire("");
    setStockAlerte(5);
    setEditId(null);
  };

  const handleDeleteProduit = async (id) => {
    const roleUser = currentUser?.role?.toLowerCase();
    const rolesAutorises = ["admin", "pharmacien", "proprio"];
    if (!rolesAutorises.includes(roleUser)) {
      return alert("Accès refusé : Autorisation insuffisante.");
    }

    const code = prompt("⚠️ SUPPRESSION DU PRODUIT ET DE SES LOTS ⚠️\nTapez 'CONFIRMER' :");
    if (code === "CONFIRMER") {
      try {
        await axios.delete(`https://pharmacie-production-9a16.up.railway.app/api/produit/delete/${id}`, getAxiosConfig());
        loadToutesDonnees();
        alert("Produit et tous ses lots associés ont été supprimés.");
      } catch (error) {
        alert("Impossible de supprimer le produit : " + (error.response?.data?.error || error.message));
      }
    }
  };

  // --- ACTIONS DES LOTS (ARRIVAGES, MODIFICATIONS & SUPPRESSIONS) ---
  const openArrivageModal = (produit) => {
    setSelectedProduit(produit);
    resetFormLot();
    loadLotsDuProduit(produit.id_produit);
  };

  const resetFormLot = () => {
    setQuantiteDisponible("");
    setDatePeremption("");
    setPrixAchatUnitaire("");
    setEditLotId(null);
  };

  const startEditLot = (lot) => {
    setEditLotId(lot.id_lot);
    setQuantiteDisponible(lot.quantite_disponible);
    const dateFormatted = lot.date_peremption ? lot.date_peremption.split('T')[0] : "";
    setDatePeremption(dateFormatted);
    setPrixAchatUnitaire(lot.prix_achat_unitaire || "");
  };

  const submitArrivage = async (e) => {
    e.preventDefault();
    const idStructure = getStructureId();
    if (!idStructure) return alert("Session expirée.");

    const payload = {
      id_structure: idStructure,
      id_produit: selectedProduit?.id_produit,
      quantite_disponible: parseInt(quantiteDisponible, 10),
      date_peremption: datePeremption,
      prix_achat_unitaire: prixAchatUnitaire ? parseFloat(prixAchatUnitaire) : null,
      id_utilisateur: currentUser?.id_utilisateur
    };

    try {
      if (editLotId) {
        await axios.put(`https://pharmacie-production-9a16.up.railway.app/api/lots/update/${editLotId}`, payload, getAxiosConfig());
        alert("Informations du lot corrigées avec succès !");
      } else {
        await axios.post("https://pharmacie-production-9a16.up.railway.app/api/lots", payload, getAxiosConfig());
        alert(`Arrivage de ${quantiteDisponible} unité(s) validé pour : ${selectedProduit?.nom}`);
      }
      
      resetFormLot();
      loadLotsDuProduit(selectedProduit.id_produit);
      loadToutesDonnees();
    } catch (error) {
      alert("Erreur opération lot : " + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteLot = async (id_lot) => {
    try {
      const response = await fetch(`https://pharmacie-production-9a16.up.railway.app/api/lots/${id_lot}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "id_structure": userStructureId // Transmettre l'id_structure dans le header
        },
        body: JSON.stringify({
          id_utilisateur: currentUserId,
          motif: "Erreur d'encodage"
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      console.log("Succès :", data.message);
    } catch (error) {
      console.error("Erreur :", error.message);
    }
  };

  // const handleDeleteLot = async (id_lot) => {
  //   const roleUser = currentUser?.role?.toLowerCase();
  //   if (!["admin", "pharmacien", "proprio"].includes(roleUser)) {
  //     return alert("Droits insuffisants pour supprimer définitivement un lot.");
  //   }

  //   if (!window.confirm("⚠️ ATTENTION ! Voulez-vous supprimer définitivement ce lot du stock ? Cette action écrasera ses données.")) return;
    
  //   try {
  //     await axios.delete(`https://pharmacie-production-9a16.up.railway.app/api/lots/delete/${id_lot}`, getAxiosConfig());
  //     alert("Lot supprimé définitivement.");
  //     resetFormLot();
  //     loadLotsDuProduit(selectedProduit.id_produit);
  //     loadToutesDonnees();
  //   } catch (error) {
  //     alert("Erreur lors de la suppression : " + (error.response?.data?.error || error.message));
  //   }
  // };

  const handleRetraitPerime = async (id_lot) => {
    if (!window.confirm("Confirmez-vous la mise au rebut de ce lot ? Sa quantité passera à 0.")) return;
    try {
      await axios.post(
        `https://pharmacie-production-9a16.up.railway.app/api/lots/retrait-perime/${id_lot}`,
        { id_utilisateur: currentUser?.id_utilisateur, motif: "Retrait via interface unifiée" },
        getAxiosConfig()
      );
      alert("Lot mis au rebut (quantité passée à 0).");
      loadToutesDonnees();
      if (selectedProduit) loadLotsDuProduit(selectedProduit.id_produit);
    } catch (error) {
      alert("Erreur lors du retrait : " + (error.response?.data?.error || error.message));
    }
  };

  // --- TRI ET FILTRES DU TABLEAU ---
  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let result = data.filter((p) => {
      const matchesSearch = p.nom.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesStock = true;
      const stock = parseInt(p.stock_total, 10);
      const alerte = parseInt(p.stock_alerte, 10);

      if (filterStock === "alerte") matchesStock = stock <= alerte && stock > 0;
      else if (filterStock === "rupture") matchesStock = stock === 0;

      return matchesSearch && matchesStock;
    });

    result.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      if (sortConfig.key === "prix_vente_unitaire" || sortConfig.key === "stock_total") {
        aValue = parseFloat(aValue);
        bValue = parseFloat(bValue);
      }
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [data, searchTerm, filterStock, sortConfig]);

  return (
    <div className="container mt-4">
      <style>{`@media print { .no-print, form, .btn, .mb-3, .input-group, .btn-group, .collapse { display: none !important; } @page { margin: 1cm; } .container { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; } table { width: 100% !important; border-collapse: collapse !important; font-size: 12px; } th, td { border: 1px solid #000 !important; padding: 8px !important; } .badge { border: 1px solid #000 !important; background: transparent !important; color: #000 !important; } }`}</style>

      {/* HEADER IMPRESSION */}
      <div className="d-none d-print-block mb-4">
        <div className="row align-items-center border-bottom pb-3">
          <div className="col-6">
            {Logo && <img src={Logo} style={{ width: "60px" }} alt="Logo" />}
            <h5 className="fw-bold mb-0">GESTION DU STOCK PHARMACEUTIQUE</h5>
          </div>
          <div className="col-6 text-end">
            <h3 className="text-uppercase fw-bold mb-0">État Général du Catalogue</h3>
            <p className="mb-0 text-muted">Généré le : {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* --- SECTION COLLAPSE : ALERTES PÉREMPTION --- */}
      <div className="no-print mb-3">
        <button 
          className={`btn w-100 fw-bold d-flex justify-content-between align-items-center ${alertesPeremption.length > 0 ? "btn-outline-danger" : "btn-outline-secondary"}`}
          onClick={() => setShowPeremptionCollapse(!showPeremptionCollapse)}
        >
          <span>⚠️ SUIVI DES DATES CRITIQUES (Lots ≤ 90 jours ou Périmés)</span>
          <span className="badge bg-danger fs-6">{alertesPeremption.length}</span>
        </button>

        <div className={`collapse mt-2 ${showPeremptionCollapse ? "show" : ""}`}>
          <div className="card card-body shadow-sm border-danger">
            <div className="table-responsive" style={{ maxHeight: "250px", overflowY: "auto" }}>
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-dark sticky-top">
                  <tr>
                    <th>Médicament</th>
                    <th>Quantité rest.</th>
                    <th>Date d'expiration</th>
                    <th>Statut</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alertesPeremption.map((lot) => {
                    const jours = parseInt(lot.jours_restants, 10);
                    const estPerime = jours <= 0;
                    return (
                      <tr key={lot.id_lot} className={estPerime ? "table-danger" : "table-warning"}>
                        <td className="fw-bold">{lot.nom_produit}</td>
                        <td className="fw-bold">{lot.quantite_disponible}</td>
                        <td>{new Date(lot.date_peremption).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge ${estPerime ? "bg-danger" : "bg-dark"}`}>
                            {estPerime ? "PÉRIMÉ" : `${jours} jours restants`}
                          </span>
                        </td>
                        <td className="text-center">
                          <button type="button" className="btn btn-danger btn-sm py-0 shadow-sm" onClick={() => handleRetraitPerime(lot.id_lot)}>
                            🗑️ Rebut
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {alertesPeremption.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-3">🎉 Aucun lot critique ou périmé en stock.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* --- FORMULAIRE CATALOGUE (PRODUIT) --- */}
      <h4 className="no-print mb-3 fw-bold text-secondary">{editId ? "📝 Modification Produit" : "➕ Ajouter un Nouveau Produit au Catalogue"}</h4>
      <form onSubmit={submitProduit} className="card p-3 shadow-sm mb-4 no-print border-start border-primary border-3">
        <div className="row">
          <div className="col-md-5 mb-2">
            <label className="form-label small fw-bold">Nom du médicament</label>
            <input className="form-control" placeholder="Ex: Paracétamol 500mg" value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>
          <div className="col-md-4 mb-2">
            <label className="form-label small fw-bold">Prix de vente unitaire (FCFA / €)</label>
            <input type="number" step="0.01" className="form-control" placeholder="Prix" value={prixVenteUnitaire} onChange={(e) => setPrixVenteUnitaire(e.target.value)} required />
          </div>
          <div className="col-md-3 mb-2">
            <label className="form-label small fw-bold">Seuil d'alerte stock</label>
            <input type="number" className="form-control" value={stockAlerte} onChange={(e) => setStockAlerte(e.target.value)} required />
          </div>
        </div>
        <div className="d-flex gap-2 mt-2">
          <button type="submit" className="btn btn-primary fw-bold">{editId ? "Enregistrer les modifications" : "Ajouter au catalogue"}</button>
          {editId && <button type="button" className="btn btn-secondary" onClick={resetFormProduit}>Annuler</button>}
        </div>
      </form>

      {/* --- FILTRES DE RECHERCHE --- */}
      <div className="row mb-3 g-2 no-print align-items-center">
        <div className="col-md-5">
          <div className="input-group">
            <span className="input-group-text bg-white border-end-0">🔍</span>
            <input type="text" className="form-control border-start-0" placeholder="Rechercher un produit dans le catalogue..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="col-md-4">
          <select className="form-select fw-bold" value={filterStock} onChange={(e) => setFilterStock(e.target.value)}>
            <option value="tous">📦 Tous les niveaux de stock</option>
            <option value="alerte">⚠️ En Alerte (Stock Bas)</option>
            <option value="rupture">🚨 En Rupture de stock</option>
          </select>
        </div>
        <div className="col-md-3">
          <button onClick={() => window.print()} className="btn btn-dark w-100 fw-bold">🖨️ Imprimer le Rapport</button>
        </div>
      </div>

      {/* --- TABLEAU DE BORD CENTRAL --- */}
      <div className="table-responsive shadow-sm rounded">
        <table className="table table-hover border align-middle mb-0 bg-white">
          <thead className="table-dark">
            <tr>
              <th onClick={() => requestSort("nom")} style={{ cursor: "pointer" }}>Désignation {sortConfig.key === "nom" && (sortConfig.direction === "asc" ? "↑" : "↓")}</th>
              <th onClick={() => requestSort("prix_vente_unitaire")} style={{ cursor: "pointer" }}>Prix de Vente {sortConfig.key === "prix_vente_unitaire" && (sortConfig.direction === "asc" ? "↑" : "↓")}</th>
              <th onClick={() => requestSort("stock_total")} style={{ cursor: "pointer" }}>Stock Total {sortConfig.key === "stock_total" && (sortConfig.direction === "asc" ? "↑" : "↓")}</th>
              <th>Seuil Alerte</th>
              <th>Statut</th>
              <th className="no-print text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.map((p) => {
              const stock = parseInt(p.stock_total, 10);
              const alerte = parseInt(p.stock_alerte, 10);

              let badgeColor = "bg-success";
              let statusLabel = "Disponible";

              if (stock === 0) {
                badgeColor = "bg-danger";
                statusLabel = "Rupture";
              } else if (stock <= alerte) {
                badgeColor = "bg-warning text-dark";
                statusLabel = "Stock Bas";
              }

              return (
                <tr key={p.id_produit}>
                  <td className="fw-bold text-primary">{p.nom}</td>
                  <td className="fw-bold">{parseFloat(p.prix_vente_unitaire).toLocaleString()}</td>
                  <td className={`fs-5 fw-bold ${stock <= alerte ? "text-danger" : "text-success"}`}>{stock}</td>
                  <td><span className="badge bg-light text-dark border">{alerte}</span></td>
                  <td><span className={`badge ${badgeColor}`}>{statusLabel}</span></td>
                  <td className="no-print text-end">
                    <div className="btn-group shadow-sm">
                      <button 
                        className="btn btn-success btn-sm fw-bold" 
                        data-bs-toggle="modal" 
                        data-bs-target="#arrivageModal" 
                        onClick={() => openArrivageModal(p)}
                      >
                        📦 Gérer Lots / Arrivage
                      </button>
                      <button onClick={() => startEdit(p)} className="btn btn-warning btn-sm">Modifier</button>
                      {/* Affichage conditionnel normalisé en minuscules */}
                      {["admin", "pharmacien", "proprio"].includes(currentUser?.role?.toLowerCase()) && (
                        <button onClick={() => handleDeleteProduit(p.id_produit)} className="btn btn-danger btn-sm">Supprimer</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredAndSortedData.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center text-muted py-4">Aucun produit trouvé dans cette catégorie.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- MODALE BOOTSTRAP UNIFIÉE --- */}
      <div className="modal fade" id="arrivageModal" tabIndex="-1" aria-labelledby="arrivageModalLabel" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content border-success">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title fw-bold" id="arrivageModalLabel">
                {editLotId ? "✏️ Correction d'un Lot Existant" : "📦 Nouvel Arrivage de Lot"}
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close" onClick={resetFormLot}></button>
            </div>
            
            <form onSubmit={submitArrivage}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label small fw-bold">Produit ciblé</label>
                    <input type="text" className="form-control bg-light fw-bold text-uppercase" value={selectedProduit ? selectedProduit.nom : ""} disabled />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label small fw-bold">Quantité reçue</label>
                    <input type="number" min="0" className="form-control text-center fw-bold" placeholder="Ex: 150" value={quantiteDisponible} onChange={(e) => setQuantiteDisponible(e.target.value)} required />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label small fw-bold">Date de péremption</label>
                    <input type="date" className="form-control" value={datePeremption} onChange={(e) => setDatePeremption(e.target.value)} required />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label small fw-bold">Prix d'achat unitaire</label>
                    <input type="number" step="0.01" className="form-control" placeholder="Optionnel" value={prixAchatUnitaire} onChange={(e) => setPrixAchatUnitaire(e.target.value)} />
                  </div>
                </div>
                
                <div className="d-flex justify-content-end gap-2 mb-3 border-bottom pb-3">
                  {editLotId && <button type="button" className="btn btn-sm btn-secondary" onClick={resetFormLot}>Annuler la sélection</button>}
                  <button type="submit" className={`btn btn-sm fw-bold ${editLotId ? "btn-warning" : "btn-success"}`}>
                    {editLotId ? "💾 Valider les corrections du lot" : "➕ Ajouter ce lot au stock"}
                  </button>
                </div>

                {/* --- SOUS-SECTION : LISTE DES LOTS --- */}
                <h6 className="fw-bold text-dark mt-2 mb-2">📋 Lots actuellement enregistrés pour ce produit :</h6>
                <div className="table-responsive border rounded" style={{ maxHeight: "200px" }}>
                  <table className="table table-sm table-striped hover align-middle mb-0" style={{ fontSize: '13px' }}>
                    <thead className="table-secondary sticky-top">
                      <tr>
                        <th>Quantité</th>
                        <th>Péremption</th>
                        <th>Prix Achat</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lotsDuProduit.map((lot) => (
                        <tr key={lot.id_lot} className={editLotId === lot.id_lot ? "table-warning fw-bold" : ""}>
                          <td>{lot.quantite_disponible} u.</td>
                          <td>{new Date(lot.date_peremption).toLocaleDateString()}</td>
                          <td>{lot.prix_achat_unitaire ? `${parseFloat(lot.prix_achat_unitaire).toLocaleString()} U.` : "-"}</td>
                          <td className="text-end">
                            <div className="btn-group shadow-sm">
                              <button type="button" className="btn btn-warning btn-sm py-0" onClick={() => startEditLot(lot)}>✏️</button>
                              {["admin", "pharmacien", "proprio"].includes(currentUser?.role?.toLowerCase()) && (
                                <button type="button" className="btn btn-danger btn-sm py-0" onClick={() => handleDeleteLot(lot.id_lot)}>🗑️</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {lotsDuProduit.length === 0 && (
                        <tr>
                          <td colSpan="4" className="text-center text-muted py-2">Aucun lot actif pour ce produit. Ajoutez-en un au-dessus.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" onClick={resetFormLot}>Fermer</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProduitsEtStock;
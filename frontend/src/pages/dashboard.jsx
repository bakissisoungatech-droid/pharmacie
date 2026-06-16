import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import socket from "../socket";

// Importation correcte des éléments pour les graphiques Chart.js
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from "chart.js";
import { Line as LineChart, Bar as BarChart } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // --- ÉTAT POUR LA NAVIGATION PAR ONGLETS ---
  const [activeTab, setActiveTab] = useState("vue_generale"); // "vue_generale" ou "entrees_produits"
  const [entreesStock, setEntreesStock] = useState([]);

  // --- ÉTATS POUR LES FILTRES D'INTERVALLE ---
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // --- ÉTATS POUR LES FILTRES DES MODALES ---
  const [filtrePaiement, setFiltrePaiement] = useState("TOUS");
  const [selectedAbonne, setSelectedAbonne] = useState("TOUS");

  // --- ÉTATS POUR LES MODALES DE DÉTAILS ---
  const [showVentesModal, setShowVentesModal] = useState(false); 
  const [showRecettesModal, setShowRecettesModal] = useState(false);
  const [showRecouvrementModal, setShowRecouvrementModal] = useState(false);
  const [showRuptureModal, setShowRuptureModal] = useState(false);
  const [showCritiqueModal, setShowCritiqueModal] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try { setCurrentUser(JSON.parse(storedUser)); } catch (e) { console.error(e); }
    }
  }, []);

  const getStructureId = useCallback(() => {
    return localStorage.getItem("id_structure") || currentUser?.id_structure;
  }, [currentUser]);

  const getAxiosConfig = useCallback(() => {
    const idStructure = getStructureId();
    if (!idStructure) return {};
    
    return { 
      headers: { "id_structure": idStructure },
      params: {
        startDate: startDate || undefined,
        endDate: endDate || undefined
      }
    };
  }, [getStructureId, startDate, endDate]);

  const loadStats = useCallback(async () => {
    const idStructure = getStructureId();
    if (!idStructure) return;
    try {
      const r = await axios.get("http://192.168.100.34:3000/api/dashboard/stats", getAxiosConfig());
      setStats(r.data);
    } catch (error) {
      console.error("Erreur chargement statistiques dashboard", error);
    }
  }, [getStructureId, getAxiosConfig]);

  const loadEntreesStock = useCallback(async () => {
    const idStructure = getStructureId();
    if (!idStructure) return;
    try {
      const r = await axios.get("http://192.168.100.34:3000/api/dashboard/entrees", getAxiosConfig());
      setEntreesStock(r.data);
    } catch (error) {
      console.error("Erreur chargement entrées de stock", error);
    }
  }, [getStructureId, getAxiosConfig]);

  useEffect(() => {
    loadStats();
    loadEntreesStock();
  }, [loadStats, loadEntreesStock]);

  useEffect(() => {
    const idStructure = getStructureId();
    if (!idStructure) return;

    const handleRefresh = () => {
      loadStats();
      loadEntreesStock();
    };
    socket.on("refresh_data", handleRefresh);

    return () => { socket.off("refresh_data", handleRefresh); };
  }, [getStructureId, loadStats, loadEntreesStock]);

  // --- EXTRACTION DE LA LISTE DES ABONNÉS / TIERS ---
  const modesStandards = ["ESPECES", "MOBILE_MONEY", "CARTE", "CHEQUE"];
  
  const listeAbonnes = useMemo(() => {
    if (!stats?.liste_ventes_details) return [];
    const abonnesSet = new Set();
    stats.liste_ventes_details.forEach(v => {
      if (v.mode_paiement && !modesStandards.includes(v.mode_paiement)) {
        abonnesSet.add(v.mode_paiement);
      }
    });
    return Array.from(abonnesSet).sort();
  }, [stats?.liste_ventes_details]);

  useEffect(() => {
    setSelectedAbonne("TOUS");
  }, [filtrePaiement]);

  const resetFiltresModale = () => {
    setFiltrePaiement("TOUS");
    setSelectedAbonne("TOUS");
  };

  const filtrerTransactions = useCallback((liste) => {
    if (!liste) return [];
    let resultats = liste;

    if (filtrePaiement !== "TOUS") {
      if (filtrePaiement === "ABONNEMENT") {
        resultats = resultats.filter(v => !modesStandards.includes(v.mode_paiement));
        if (selectedAbonne !== "TOUS") {
          resultats = resultats.filter(v => v.mode_paiement === selectedAbonne);
        }
      } else {
        resultats = resultats.filter(v => v.mode_paiement === filtrePaiement);
      }
    }
    return resultats;
  }, [filtrePaiement, selectedAbonne]);

  const ventesGlobalesFiltrees = useMemo(() => {
    return filtrerTransactions(stats?.liste_ventes_details);
  }, [stats?.liste_ventes_details, filtrerTransactions]);

  const recettesDirectesFiltrees = useMemo(() => {
    const deBase = stats?.liste_ventes_details?.filter(v => modesStandards.includes(v.mode_paiement)) || [];
    return filtrerTransactions(deBase);
  }, [stats?.liste_ventes_details, filtrerTransactions]);

  const recouvrementFiltres = useMemo(() => {
    const deBase = stats?.liste_ventes_details?.filter(v => !modesStandards.includes(v.mode_paiement)) || [];
    return filtrerTransactions(deBase);
  }, [stats?.liste_ventes_details, filtrerTransactions]);

  const totalVentesGlobales = useMemo(() => {
    return ventesGlobalesFiltrees.reduce((sum, v) => sum + parseFloat(v.total_net_patient || 0), 0);
  }, [ventesGlobalesFiltrees]);

  const totalRecettesDirectes = useMemo(() => {
    return recettesDirectesFiltrees.reduce((sum, v) => sum + parseFloat(v.total_net_patient || 0), 0);
  }, [recettesDirectesFiltrees]);

  const totalRecouvrementTiers = useMemo(() => {
    return recouvrementFiltres.reduce((sum, v) => {
      const brut = parseFloat(v.total_brut_article || (v.quantite * (v.prix_unitaire_base || v.prix_unitaire_vendu)));
      const patient = parseFloat(v.total_net_patient || 0);
      return sum + (brut - patient);
    }, 0);
  }, [recouvrementFiltres]);

  const entreesJournalieres = useMemo(() => {
    const aujourdhui = new Date().toISOString().split('T')[0];
    return entreesStock.filter(entry => {
      const dateEntree = new Date(entry.date_entree).toISOString().split('T')[0];
      return dateEntree === aujourdhui;
    });
  }, [entreesStock]);

  const handlePrintVentes = () => {
    window.print();
  };

  // --- CONFIGURATION DES GRAPHIQUES ---
  const lineChartData = {
    labels: stats?.evolution_ca?.map(item => new Date(item.date_vente).toLocaleDateString("fr-FR", { weekday: 'short', day: 'numeric' })) || [],
    datasets: [
      {
        label: "CA Réel Global (FCFA)",
        data: stats?.evolution_ca?.map(item => parseFloat(item.total_ventes_brut)) || [],
        borderColor: "#0d6efd",
        backgroundColor: "rgba(13, 110, 253, 0.05)",
        tension: 0.3,
        fill: true,
      },
      {
        label: "Recette Directe Patient (FCFA)",
        data: stats?.evolution_ca?.map(item => parseFloat(item.total_ventes_net_patient)) || [],
        borderColor: "#198754",
        backgroundColor: "transparent",
        borderDash: [5, 5],
        tension: 0.3,
        fill: false,
      }
    ]
  };

  const barChartData = {
    labels: stats?.top_ventes?.map(item => item.nom) || [],
    datasets: [
      {
        label: "Quantités vendues",
        data: stats?.top_ventes?.map(item => item.quantite_vendue) || [],
        backgroundColor: "#0dcaf0",
      }
    ]
  };

  if (!stats) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement des indicateurs...</span>
        </div>
      </div>
    );
  }

  // --- RENDER DU COMPOSANT FILTRE FINANCIER (Déclaré en dehors du JSX principal) ---
  const renderFiltresModale = () => (
    <div className="d-flex align-items-center gap-2 flex-wrap mb-3 p-2 bg-light rounded border no-print">
      <span className="small fw-bold text-muted">Filtrer les résultats :</span>
      <select className="form-select form-select-sm" style={{ width: "210px" }} value={filtrePaiement} onChange={(e) => setFiltrePaiement(e.target.value)}>
        <option value="TOUS">🔍 Tous les règlements</option>
        <option value="ESPECES">💵 Espèces</option>
        <option value="MOBILE_MONEY">📱 Mobile Money</option>
        <option value="CARTE">💳 Carte Bancaire</option>
        <option value="CHEQUE">✍️ Chèque</option>
        <option value="ABONNEMENT">🔒 Prise en charge / Sociétés</option>
      </select>
      {filtrePaiement === "ABONNEMENT" && (
        <select className="form-select form-select-sm" style={{ width: "230px", backgroundColor: "#fff3cd", fontWeight: "bold" }} value={selectedAbonne} onChange={(e) => setSelectedAbonne(e.target.value)}>
          <option value="TOUS">👤 Tous les tiers payants</option>
          {listeAbonnes.map((abonne, idx) => (
            <option key={idx} value={abonne}>👤 {abonne}</option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <div className="container mt-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-section, .print-section * { visibility: visible; }
          .print-section { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        .hover-shadow:hover { transform: translateY(-3px); transition: all 0.2s ease-in-out; box-shadow: 0 .5rem 1rem rgba(0,0,0,.15)!important; }
      `}</style>

      {/* --- EN-TÊTE --- */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 no-print">
        <div>
          <h3>Tableau de Bord Structure</h3>
          {/* <span className="badge bg-secondary p-2">Rôle : {currentUser?.role || "Utilisateur"}</span> */}
        </div>

        <div className="card p-2 shadow-sm border-0 bg-light">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="small fw-bold text-muted">Période :</span>
            <input type="date" className="form-control form-control-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span className="small text-muted">au</span>
            <input type="date" className="form-control form-control-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            {(startDate || endDate) && (
              <button className="btn btn-outline-danger btn-sm" onClick={() => { setStartDate(""); setEndDate(""); }}>Effacer</button>
            )}
          </div>
        </div>
      </div>

      {/* --- ONGLETS --- */}
      <div className="no-print mb-4">
        <ul className="nav nav-tabs border-bottom-2">
          <li className="nav-item">
            <button 
              className={`nav-link fw-bold px-4 ${activeTab === "vue_generale" ? "active text-primary" : "text-secondary"}`}
              onClick={() => { setActiveTab("vue_generale"); resetFiltresModale(); }}
            >
              📊 Vue Générale Ventes
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-link fw-bold px-4 ${activeTab === "entrees_produits" ? "active text-primary" : "text-secondary"}`}
              onClick={() => { setActiveTab("entrees_produits"); resetFiltresModale(); }}
            >
              📦 Entrées &amp; États Stocks
            </button>
          </li>
        </ul>
      </div>

      {/* ================= VUE GÉNÉRALE VENTES ================= */}
      {activeTab === "vue_generale" && (
        <>
          <div className="row g-3 mb-4 no-print justify-content-start">
            <div className="col-md-4" style={{ cursor: 'pointer' }} onClick={() => { resetFiltresModale(); setShowVentesModal(true); }}>
              <div className="card shadow-sm border-0 bg-primary text-white p-3 h-100 hover-shadow">
                <div className="small text-uppercase text-white-50 fw-bold">Chiffre d'Affaires Global</div>
                <div className="fs-3 fw-bold my-2">
                  {stats.indicateurs.ca_global?.toLocaleString()} <span className="fs-6">FCFA</span>
                </div>
                <div className="small text-white-50">Activité réelle de la structure 🔍</div>
              </div>
            </div>

            <div className="col-md-4" style={{ cursor: 'pointer' }} onClick={() => { resetFiltresModale(); setShowRecettesModal(true); }}>
              <div className="card shadow-sm border-0 bg-success text-white p-3 h-100 hover-shadow">
                <div className="small text-uppercase text-white-50 fw-bold">Recettes Directes En Caisse</div>
                <div className="fs-3 fw-bold my-2">
                  {stats.indicateurs?.ca_patient_recette?.toLocaleString('fr-FR')} <span className="fs-6">FCFA</span>
                </div>
                <div className="small text-white-50">Espèces / Mobile Money perçus 💵</div>
              </div>
            </div>

            <div className="col-md-4" style={{ cursor: 'pointer' }} onClick={() => { resetFiltresModale(); setShowRecouvrementModal(true); }}>
              <div className="card shadow-sm border-0 bg-warning text-dark p-3 h-100 hover-shadow">
                <div className="small text-uppercase text-muted fw-bold">À Recouvrer (Tiers / Sociétés)</div>
                <div className="fs-3 fw-bold my-2">
                  {stats.indicateurs?.ca_prise_en_charge?.toLocaleString('fr-FR')} <span className="fs-6">FCFA</span>
                </div>
                <div className="small text-muted">Prises en charge à facturer 🏢</div>
              </div>
            </div>
          </div>

          <div className="row g-4 mb-5 no-print">
            <div className="col-md-7">
              <div className="card p-3 shadow-sm h-100">
                <h5 className="card-title fw-bold text-secondary mb-3">📈 Activité Commerciale (7 jours glissants)</h5>
                <div style={{ minHeight: "280px" }}>
                  <LineChart data={lineChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
              </div>
            </div>

            <div className="col-md-5">
              <div className="card p-3 shadow-sm h-100">
                <h5 className="card-title fw-bold text-secondary mb-3">🏆 Top 5 des Médicaments</h5>
                <div style={{ minHeight: "280px" }}>
                  <BarChart data={barChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ================= ENTRÉES & ÉTATS STOCKS ================= */}
      {activeTab === "entrees_produits" && (
        <>
          <div className="row g-3 mb-4 no-print">
            {/* <div className="col-md-4">
              <div className="card shadow-sm border-0 bg-dark text-white p-3 h-100">
                <div className="small text-uppercase text-white-50 fw-bold">💼 Réceptions du Jour</div>
                <div className="display-6 fw-bold my-1 text-info">{entreesJournalieres.length}</div>
                <div className="small text-white-50">Nouveaux lots enregistrés aujourd'hui 📅</div>
              </div>
            </div> */}

            <div className="col-md-4" style={{ cursor: 'pointer' }} onClick={() => setShowRuptureModal(true)}>
              <div className="card shadow-sm border-0 bg-danger text-white p-3 h-100 hover-shadow">
                <div className="small text-uppercase text-white-50 fw-bold">⚠️ Ruptures Stock</div>
                <div className="display-6 fw-bold my-1">{stats.indicateurs.produits_rupture}</div>
                <div className="small text-white-50">Médicaments épuisés à réapprovisionner 🔍</div>
              </div>
            </div>

            <div className="col-md-4" style={{ cursor: 'pointer' }} onClick={() => setShowCritiqueModal(true)}>
              <div className="card shadow-sm border-0 bg-secondary text-white p-3 h-100 hover-shadow">
                <div className="small text-uppercase text-white-50 fw-bold">⏳ Lots Critiques</div>
                <div className="display-6 fw-bold my-1 text-warning">{stats.indicateurs.lots_critiques}</div>
                <div className="small text-white-50">Péremption sous 30 jours ⏳</div>
              </div>
            </div>
          </div>

          <div className="card p-4 shadow-sm border-0 mb-5">
            <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
              <h5 className="fw-bold text-secondary m-0">📋 Historique des Entrées &amp; Réceptions de Médicaments</h5>
              <span className="badge bg-dark p-2 fs-6">{entreesStock.length} lots au total</span>
            </div>

            <div className="table-responsive">
              <table className="table table-striped table-hover align-middle border">
                <thead className="table-dark">
                  <tr>
                    <th>Date &amp; Heure d'Entrée</th>
                    <th>Nom du Médicament</th>
                    <th>Numéro de Lot Généré</th>
                    <th className="text-center">Quantité Initialement Reçue</th>
                    <th>Date de Péremption fixée</th>
                    <th className="text-end">Valeur Estimée Public</th>
                  </tr>
                </thead>
                <tbody>
                  {entreesStock.length > 0 ? (
                    entreesStock.map((entry, index) => (
                      <tr key={index}>
                        <td className="text-muted">{new Date(entry.date_entree).toLocaleString("fr-FR")}</td>
                        <td className="fw-bold text-primary">{entry.nom_produit}</td>
                        <td><code>{entry.id_lot?.substring(0, 18)}...</code></td>
                        <td className="text-center">
                          <span className="badge bg-success px-3 py-2 fs-6 rounded-pill">
                            +{entry.quantite_disponible} units
                          </span>
                        </td>
                        <td className="fw-bold text-secondary">
                          {new Date(entry.date_peremption).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="text-end fw-bold text-dark">
                          {(parseFloat(entry.prix_vente_unitaire || 0) * entry.quantite_disponible).toLocaleString()} FCFA
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center py-4 text-muted">
                        Aucune entrée de produit enregistrée. 📦
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ================= MODALE 1 : CHIFFRE D'AFFAIRES GLOBAL ================= */}
      {showVentesModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-xl modal-dialog-centered print-section">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold mb-0">📋 Journal de Ventes (Vue Globale)</h5>
                <button type="button" className="btn-close btn-close-white no-print" onClick={() => setShowVentesModal(false)}></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                {renderFiltresModale()}
                {ventesGlobalesFiltrees.length > 0 ? (
                  <>
                    <table className="table table-striped table-hover align-middle small">
                      <thead className="table-dark">
                        <tr>
                          <th>Date &amp; Heure</th>
                          <th>Médicament</th>
                          <th className="text-center">Qté</th>
                          <th className="text-end">Prix Public</th>
                          <th className="text-end">Net Encaissé</th>
                          <th className="text-end">Total Brut</th>
                          <th className="text-end">Total Recette Patient</th>
                          <th>Mode / Tiers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ventesGlobalesFiltrees.map((v, index) => {
                          const isAbonnement = !modesStandards.includes(v.mode_paiement);
                          return (
                            <tr key={index}>
                              <td>{new Date(v.date_vente).toLocaleString("fr-FR")}</td>
                              <td className="fw-bold text-primary">{v.nom_produit}</td>
                              <td className="text-center fw-bold">{v.quantite}</td>
                              <td className="text-end text-muted">{parseFloat(v.prix_unitaire_base || v.prix_unitaire_vendu).toLocaleString()} F</td>
                              <td className="text-end">{parseFloat(v.prix_unitaire_vendu).toLocaleString()} F</td>
                              <td className="text-end fw-bold text-secondary">{(parseFloat(v.total_brut_article || (v.quantite * (v.prix_unitaire_base || v.prix_unitaire_vendu)))).toLocaleString()} F</td>
                              <td className="text-end fw-bold text-success">{(parseFloat(v.total_net_patient || (v.quantite * v.prix_unitaire_vendu))).toLocaleString()} FCFA</td>
                              <td>
                                <span className={`badge ${isAbonnement ? "bg-warning text-dark" : "bg-light text-dark"} border`}>
                                  {isAbonnement ? `👤 ${v.mode_paiement}` : v.mode_paiement || "N/A"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="d-flex justify-content-end align-items-center mt-3 p-3 bg-light rounded border">
                      <h5 className="fw-bold mb-0 text-dark">
                        TOTAL RECALCULÉ : <span className="text-primary">{totalVentesGlobales.toLocaleString()} FCFA</span>
                      </h5>
                    </div>
                  </>
                ) : (
                  <p className="text-center my-4 text-muted">Aucune transaction trouvée.</p>
                )}
              </div>
              <div className="modal-footer bg-light no-print">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowVentesModal(false)}>Fermer</button>
                <button type="button" className="btn btn-dark btn-sm fw-bold" onClick={handlePrintVentes} disabled={ventesGlobalesFiltrees.length === 0}>🖨️ Imprimer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE 2 : RECETTES DIRECTES EN CAISSE ================= */}
      {showRecettesModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-xl modal-dialog-centered print-section">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-success text-white d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold mb-0">💵 Journal des Recettes Directes</h5>
                <button type="button" className="btn-close btn-close-white no-print" onClick={() => setShowRecettesModal(false)}></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                {renderFiltresModale()}
                {recettesDirectesFiltrees.length > 0 ? (
                  <>
                    <table className="table table-striped table-hover align-middle small">
                      <thead className="table-dark">
                        <tr>
                          <th>Date &amp; Heure</th>
                          <th>Médicament</th>
                          <th className="text-center">Qté</th>
                          <th className="text-end">Prix Unitaire</th>
                          <th className="text-end">Total Brut</th>
                          <th className="text-end">Net Encaissé Patient</th>
                          <th>Mode de Paiement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recettesDirectesFiltrees.map((v, index) => (
                          <tr key={index}>
                            <td>{new Date(v.date_vente).toLocaleString("fr-FR")}</td>
                            <td className="fw-bold text-success">{v.nom_produit}</td>
                            <td className="text-center fw-bold">{v.quantite}</td>
                            <td className="text-end">{parseFloat(v.prix_unitaire_vendu).toLocaleString()} F</td>
                            <td className="text-end text-muted">{(parseFloat(v.total_brut_article || (v.quantite * v.prix_unitaire_vendu))).toLocaleString()} F</td>
                            <td className="text-end fw-bold text-success">{(parseFloat(v.total_net_patient || (v.quantite * v.prix_unitaire_vendu))).toLocaleString()} FCFA</td>
                            <td><span className="badge bg-light text-dark border fw-bold">{v.mode_paiement}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="d-flex justify-content-end align-items-center mt-3 p-3 bg-light rounded border">
                      <h5 className="fw-bold mb-0 text-dark">
                        TOTAL EN CAISSE FILTRÉ : <span className="text-success">{totalRecettesDirectes.toLocaleString()} FCFA</span>
                      </h5>
                    </div>
                  </>
                ) : (
                  <p className="text-center my-4 text-muted">Aucune recette directe trouvée avec ces critères.</p>
                )}
              </div>
              <div className="modal-footer bg-light no-print">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRecettesModal(false)}>Fermer</button>
                <button type="button" className="btn btn-dark btn-sm fw-bold" onClick={handlePrintVentes} disabled={recettesDirectesFiltrees.length === 0}>🖨️ Imprimer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE 3 : À RECOUVRER (TIERS / SOCIÉTÉS) ================= */}
      {showRecouvrementModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-xl modal-dialog-centered print-section">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-warning text-dark d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold mb-0">🏢 Dossiers Prises en Charge Sociétés &amp; Assurances</h5>
                <button type="button" className="btn-close no-print" onClick={() => setShowRecouvrementModal(false)}></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                {renderFiltresModale()}
                {recouvrementFiltres.length > 0 ? (
                  <>
                    <table className="table table-striped table-hover align-middle small">
                      <thead className="table-dark">
                        <tr>
                          <th>Date &amp; Heure</th>
                          <th>Médicament</th>
                          <th className="text-center">Qté</th>
                          <th className="text-end">Total Brut (Public)</th>
                          <th className="text-end">Part Patient</th>
                          <th className="text-end">Part Tiers (À Recouvrer)</th>
                          <th>Société / Assurance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recouvrementFiltres.map((v, index) => {
                          const totalBrut = parseFloat(v.total_brut_article || (v.quantite * (v.prix_unitaire_base || v.prix_unitaire_vendu)));
                          const partPatient = parseFloat(v.total_net_patient || 0);
                          const partTiers = totalBrut - partPatient;
                          return (
                            <tr key={index}>
                              <td>{new Date(v.date_vente).toLocaleString("fr-FR")}</td>
                              <td className="fw-bold text-dark">{v.nom_produit}</td>
                              <td className="text-center fw-bold">{v.quantite}</td>
                              <td className="text-end text-muted">{totalBrut.toLocaleString()} F</td>
                              <td className="text-end text-danger">{partPatient.toLocaleString()} F</td>
                              <td className="text-end fw-bold text-primary">{partTiers.toLocaleString()} FCFA</td>
                              <td><span className="badge bg-warning text-dark border fw-bold">🏢 {v.mode_paiement}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="d-flex justify-content-end align-items-center mt-3 p-3 bg-light rounded border">
                      <h5 className="fw-bold mb-0 text-dark">
                        TOTAL HORS PART PATIENT : <span className="text-primary">{totalRecouvrementTiers.toLocaleString()} FCFA</span>
                      </h5>
                    </div>
                  </>
                ) : (
                  <p className="text-center my-4 text-muted">Aucun enregistrement trouvé.</p>
                )}
              </div>
              <div className="modal-footer bg-light no-print">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRecouvrementModal(false)}>Fermer</button>
                <button type="button" className="btn btn-dark btn-sm fw-bold" onClick={handlePrintVentes} disabled={recouvrementFiltres.length === 0}>🖨️ Imprimer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE 4 : RUPTURES DE STOCK ================= */}
      {showRuptureModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold">⚠️ Produits en rupture de stock</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowRuptureModal(false)}></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {stats.liste_ruptures && stats.liste_ruptures.length > 0 ? (
                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr><th>Nom du médicament</th></tr>
                    </thead>
                    <tbody>
                      {stats.liste_ruptures.map((prod, index) => (
                        <tr key={index}><td className="fw-bold text-secondary">{prod.nom}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center my-3 text-muted">Aucun produit en rupture complète ! 🎉</p>
                )}
              </div>
              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRuptureModal(false)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE 5 : LOTS CRITIQUES ================= */}
      {showCritiqueModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold text-warning">⏳ Alertes de Péremption &amp; Lots Critiques</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCritiqueModal(false)}></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {stats.indicateurs?.lots_critiques > 0 && stats.liste_critiques?.length > 0 ? (
                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Médicament</th>
                        <th>Identifiant Lot</th>
                        <th className="text-end">Quantité Restante</th>
                        <th>Date Péremption</th>
                        <th>statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.liste_critiques.map((lot, index) => (
                        <tr key={index}>
                          <td className="fw-bold">{lot.nom_produit}</td>
                          <td><code>{lot.id_lot}</code></td>
                          <td className="text-end fw-bold text-danger">{lot.quantite_disponible}</td>
                          <td>{new Date(lot.date_peremption).toLocaleDateString("fr-FR")}</td>
                          <td className="text-end fw-bold text-danger">{lot.statut}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center my-3 text-muted">Aucun lot critique. 👍</p>
                )}
              </div>
              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCritiqueModal(false)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
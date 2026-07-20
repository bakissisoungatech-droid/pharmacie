import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import socket from "../socket";
import { Modal } from 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

function Caisse() {
  const [produits, setProduits] = useState([]);
  const [panier, setPanier] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [modePaiement, setModePaiement] = useState("ESPECES");
  const [currentUser, setCurrentUser] = useState(null);
  const [structureInfo, setStructureInfo] = useState(null);
  const [abonnements, setAbonnements] = useState([]); 

  // --- ÉTATS POUR LE TAUX MODIFIABLE EN DIRECT ---
  const [tauxApplique, setTauxApplique] = useState(0);

  // --- ÉTATS POUR L'HISTORIQUE ET LA FACTURE ---
  const [ventesRecentes, setVentesRecentes] = useState([]);
  const [venteSelectionnee, setVenteSelectionnee] = useState(null);

  // 1. Récupération de l'ID depuis le LocalStorage
  const getStructureId = useCallback(() => {
    const localId = localStorage.getItem("id_structure") || localStorage.getItem("structureId");
    if (localId) return localId;

    if (structureInfo?.id_structure || structureInfo?.id) {
      return structureInfo?.id_structure || structureInfo?.id;
    }

    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        return parsed?.id_structure || parsed?.structure?.id_structure || parsed?.structure_info?.id_structure || parsed?.structureId;
      } catch (e) {
        console.error(e);
      }
    }
    return currentUser?.id_structure || currentUser?.structureId;
  }, [currentUser, structureInfo]);

  const getAxiosConfig = useCallback(() => {
    const idStructure = getStructureId();
    if (!idStructure) return {};
    return { headers: { "id_structure": idStructure } };
  }, [getStructureId]);

  // 2. Chargement initial local
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    let parsedUser = null;
    if (storedUser) {
      try {
        parsedUser = JSON.parse(storedUser);
        setCurrentUser(parsedUser);
      } catch (e) {
        console.error("Erreur de lecture du user", e);
      }
    }
    
    const storedStructure = localStorage.getItem("structure");
    if (storedStructure) {
      try { 
        setStructureInfo(JSON.parse(storedStructure)); 
      } catch(e){
        console.error("Erreur parse structure", e);
      }
    }
  }, []);

  // 3. Configuration de la structure
  const loadStructureConfig = useCallback(async () => {
    const idLocalStorage = getStructureId();
    if (!idLocalStorage) return;

    try {
      const r = await axios.get("https://postgres-production-2352.up.railway.app/api/structure", getAxiosConfig());
      
      if (r.data && Array.isArray(r.data)) {
        const structureTrouvee = r.data.find(
          (str) => str.id_structure === idLocalStorage || str.id === idLocalStorage
        );

        if (structureTrouvee) {
          const structureValidee = {
            id_structure: structureTrouvee.id_structure,
            nom: structureTrouvee.nom,
            raison_sociale: structureTrouvee.raison_sociale,
            adresse: structureTrouvee.adresse,
            telephone: structureTrouvee.telephone,
            logo: structureTrouvee.logo
          };
          setStructureInfo(structureValidee);
          localStorage.setItem("structure", JSON.stringify(structureValidee));
          localStorage.setItem("nom_structure", structureValidee.nom);
        }
      } else if (r.data && !Array.isArray(r.data)) {
        if (r.data.id_structure === idLocalStorage || r.data.id === idLocalStorage) {
          setStructureInfo(r.data);
          localStorage.setItem("structure", JSON.stringify(r.data));
        }
      }
    } catch (error) {
      console.error("Erreur lors de la comparaison de la structure :", error);
    }
  }, [getStructureId, getAxiosConfig]);

  const loadProduits = useCallback(async () => {
    const idStructure = getStructureId();
    if (!idStructure) return;
    try {
      const r = await axios.get("https://postgres-production-2352.up.railway.app/api/produit", getAxiosConfig());
      setProduits(r.data);
    } catch (error) {
      console.error("Erreur chargement produits caisse", error);
    }
  }, [getStructureId, getAxiosConfig]);

  const loadVentesRecentes = useCallback(async () => {
    const idStructure = getStructureId();
    if (!idStructure) return;
    try {
      const r = await axios.get("https://postgres-production-2352.up.railway.app/api/vente", getAxiosConfig());
      setVentesRecentes(r.data);
    } catch (error) {
      console.error("Erreur chargement historique ventes", error);
    }
  }, [getStructureId, getAxiosConfig]);

  const loadAbonnements = useCallback(async () => {
    const idStructure = getStructureId();
    if (!idStructure) return;
    try {
      const response = await axios.get("https://postgres-production-2352.up.railway.app/api/abonnement", getAxiosConfig());
      setAbonnements(response.data);
    } catch (error) {
      console.error("Erreur de chargement des abonnements", error);
    }
  }, [getStructureId, getAxiosConfig]);

  // 4. Déclencheur global
  useEffect(() => {
    const idStructure = getStructureId();
    if (!idStructure) return;

    loadStructureConfig(); 
    loadProduits();
    loadVentesRecentes();
    loadAbonnements();

    const handleRefresh = () => {
      loadProduits();
      loadVentesRecentes();
      loadAbonnements();
    };
    socket.on("refresh_data", handleRefresh);

    return () => {
      socket.off("refresh_data", handleRefresh);
    };
  }, [getStructureId, loadStructureConfig, loadProduits, loadVentesRecentes, loadAbonnements]);

  // --- RECHERCHE ---
  const produitsFilitres = useMemo(() => {
    if (!searchTerm) return [];
    return produits.filter((p) =>
      p.nom?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  }, [produits, searchTerm]);

  // --- GESTION DU PANIER ---
  const ajouterAuPanier = (produit) => {
    const stockTotal = parseInt(produit.stock_total, 10);
    if (stockTotal <= 0) {
      alert("Ce produit est en rupture de stock !");
      return;
    }

    setPanier((prevPanier) => {
      const existe = prevPanier.find((item) => item.id_produit === produit.id_produit);
      if (existe) {
        if (existe.quantite_panier >= stockTotal) {
          alert(`Impossible d'ajouter plus. Stock max disponible : ${stockTotal}`);
          return prevPanier;
        }
        return prevPanier.map((item) =>
          item.id_produit === produit.id_produit
            ? { ...item, quantite_panier: item.quantite_panier + 1 }
            : item
        );
      }
      return [...prevPanier, { ...produit, quantite_panier: 1 }];
    });
    setSearchTerm("");
  };

  // Permet la saisie fluide au clavier de la quantité
  const changerQuantitePanier = (id_produit, nouvelleQuantite, stockTotal) => {
    if (nouvelleQuantite === "") {
      setPanier((prev) =>
        prev.map((item) =>
          item.id_produit === id_produit ? { ...item, quantite_panier: "" } : item
        )
      );
      return;
    }

    const qte = parseInt(nouvelleQuantite, 10);
    if (isNaN(qte) || qte < 0) return;

    if (qte > parseInt(stockTotal, 10)) {
      alert(`Le stock disponible est insuffisant (${stockTotal} max).`);
      return;
    }

    setPanier((prev) =>
      prev.map((item) =>
        item.id_produit === id_produit ? { ...item, quantite_panier: qte } : item
      )
    );
  };

  const supprimerDuPanier = (id_produit) => {
    setPanier((prev) => prev.filter((item) => item.id_produit !== id_produit));
  };

  // --- CALCULS DES TOTAUX PANIER ---
  const totalBrut = useMemo(() => {
    return panier.reduce(
      (sum, item) => sum + parseFloat(item.prix_vente_unitaire || 0) * (parseInt(item.quantite_panier, 10) || 0),
      0
    );
  }, [panier]);

  const montantReduction = useMemo(() => {
    return (totalBrut * (parseFloat(tauxApplique) || 0)) / 100;
  }, [totalBrut, tauxApplique]);

  const totalA_Payer = useMemo(() => {
    return totalBrut - montantReduction;
  }, [totalBrut, montantReduction]);

  const handleModePaiementChange = (e) => {
    const valeurSelectionnee = e.target.value;
    setModePaiement(valeurSelectionnee);

    const abonneTrouve = abonnements.find(sub => sub.nom === valeurSelectionnee);
    if (abonneTrouve) {
      setTauxApplique(Number(abonneTrouve.taux) || 0);
    } else {
      setTauxApplique(0); 
    }
  };

  const handleTauxChange = (e) => {
    const val = e.target.value;
    if (val === "") {
      setTauxApplique("");
      return;
    }
    const num = parseFloat(val);
    if (num >= 0 && num <= 100) {
      setTauxApplique(num);
    }
  };

  const handleOuvrirFacture = async (vente) => {
    try {
      const res = await axios.get(`https://postgres-production-2352.up.railway.app/api/vente/details/${vente.id_vente}`, getAxiosConfig());
      setVenteSelectionnee({
        ...vente,
        items: res.data
      });

      const modalElement = document.getElementById("factureModal");
      const modalInstance = new Modal(modalElement); 
      modalInstance.show();
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la récupération des détails de la facture.");
    }
  };

  const validerVente = async (e) => {
    e.preventDefault();
    const idStructure = getStructureId();
    
    if (!idStructure) {
      return alert("Erreur : L'identifiant de la structure est introuvable. Veuillez vous reconnecter.");
    }
    if (panier.length === 0) return alert("Le panier est vide.");

    // Vérification qu'aucune quantité n'est restée vide ou à 0
    const aDesErreurs = panier.some(item => !item.quantite_panier || item.quantite_panier <= 0);
    if (aDesErreurs) {
      return alert("Veuillez saisir une quantité valide pour tous les produits.");
    }

    const articles = panier.map((item) => ({
      id_produit: item.id_produit,
      quantite: parseInt(item.quantite_panier, 10),
    }));

    const payload = {
      id_structure: idStructure, 
      id_utilisateur: currentUser?.id_utilisateur,
      mode_paiement: modePaiement,
      taux_reduction: parseFloat(tauxApplique) || 0,
      articles,
    };

    try {
      const resVente = await axios.post(
        "https://postgres-production-2352.up.railway.app/api/vente", 
        payload, 
        { headers: { "id_structure": idStructure } }
      );
      
      alert("Vente enregistrée avec succès !");
      
      setPanier([]);
      setTauxApplique(0);
      setModePaiement("ESPECES");
      loadProduits();
      loadVentesRecentes();

      if (resVente.data && resVente.data.id_vente) {
        const prepVenteObj = {
          id_vente: resVente.data.id_vente,
          total_somme: resVente.data.total_somme,
          total_sans_reduction: resVente.data.total_sans_reduction,
          total_prise_en_charge: resVente.data.total_prise_en_charge,
          mode_paiement: resVente.data.mode_paiement || modePaiement,
          date_vente: resVente.data.date_vente || new Date().toISOString()
        };
        handleOuvrirFacture(prepVenteObj);
      }
    } catch (error) {
      alert("Erreur lors de la vente : " + (error.response?.data?.error || error.message));
    }
  };

  const handlePrintFacture = () => {
    window.print();
  };

  const headerData = useMemo(() => {
    let logo = structureInfo?.logo || null;
    if (logo && !logo.startsWith("http") && !logo.startsWith("data:")) {
      logo = `https://postgres-production-2352.up.railway.app/${logo}`;
    }
    return {
      logo: logo,
      nom: structureInfo?.nom || "PHARMACIE DE LA CLINIQUE",
      adresse: structureInfo?.adresse || "Brazzaville, République du Congo",
      telephone: structureInfo?.telephone || "(+242) -- --- -- --",
      raisonSociale: structureInfo?.raison_sociale || null
    };
  }, [structureInfo]);

  return (
    <div className="container mt-4">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #factureModal, #factureModal * { visibility: visible !important; }
          #factureModal { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; display: block !important; opacity: 1 !important; background: white !important; }
          .modal-dialog-centered { display: block !important; transform: none !important; top: 0 !important; margin: 0 !important; }
          .modal-dialog { max-width: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
          .modal-content { border: none !important; box-shadow: none !important; background: white !important; }
          .no-print-btn, .btn-close, .modal-header, .modal-footer { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 0.5cm; }
        }
      `}</style>

      <div className="no-print">
        <h3 className="mb-4">Interface de Caisse</h3>

        <div className="row">
          {/* Recherche & Panier */}
          <div className="col-md-8 mb-4">
            <div className="card p-3 shadow-sm mb-3 position-relative">
              <h5 className="card-title fw-bold">Recherche de médicaments</h5>
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Tapez le nom du produit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {produitsFilitres.length > 0 && (
                <ul className="list-group position-absolute left-0 w-100 shadow-lg" style={{ zIndex: 1000, top: "75px" }}>
                  {produitsFilitres.map((p) => (
                    <button
                      key={p.id_produit}
                      type="button"
                      className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                      onClick={() => ajouterAuPanier(p)}
                    >
                      <span className="fw-bold">{p.nom}</span>
                      <span>
                        {parseFloat(p.prix_vente_unitaire).toLocaleString()} FCFA | Stock:{" "}
                        <strong className={parseInt(p.stock_total, 10) <= 5 ? "text-danger" : "text-success"}>
                          {p.stock_total}
                        </strong>
                      </span>
                    </button>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-3 shadow-sm">
              <h5 className="card-title fw-bold mb-3">Panier en cours</h5>
              <div className="table-responsive">
                <table className="table border align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Produit</th>
                      <th>Prix Public</th>
                      <th style={{ width: "130px" }}>Quantité</th>
                      <th>Sous-total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {panier.map((item) => (
                      <tr key={item.id_produit}>
                        <td className="fw-bold">{item.nom}</td>
                        <td>{parseFloat(item.prix_vente_unitaire).toLocaleString()} FCFA</td>
                        <td>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={item.quantite_panier}
                            min="1"
                            onChange={(e) => changerQuantitePanier(item.id_produit, e.target.value, item.stock_total)}
                          />
                        </td>
                        <td className="fw-bold">
                          {(parseFloat(item.prix_vente_unitaire) * (parseInt(item.quantite_panier, 10) || 0)).toLocaleString()} FCFA
                        </td>
                        <td>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => supprimerDuPanier(item.id_produit)}>
                            ❌
                          </button>
                        </td>
                      </tr>
                    ))}
                    {panier.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center text-muted py-4">
                          Le panier est vide.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Résumé Financier */}
          <div className="col-md-4 mb-4">
            <div className="card p-3 shadow-sm bg-dark text-white h-100 d-flex flex-column justify-content-between">
              <div>
                <h5 className="fw-bold text-uppercase text-muted border-bottom pb-2">Résumé Vente</h5>
                <div className="my-3 border-bottom border-secondary pb-2">
                  <div className="d-flex justify-content-between small text-muted">
                    <span>Total Brut :</span>
                    <span>{totalBrut.toLocaleString()} FCFA</span>
                  </div>
                  {parseFloat(tauxApplique) > 0 && (
                    <>
                      <div className="d-flex justify-content-between small text-danger fw-bold mt-1">
                        <span>Prise en charge ({tauxApplique}%) :</span>
                        <span>-{montantReduction.toLocaleString()} FCFA</span>
                      </div>
                      <div className="d-flex justify-content-between small text-info fw-bold mt-1">
                        <span>Reste à Charge :</span>
                        <span>{totalA_Payer.toLocaleString()} FCFA</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="my-4 text-center">
                  <span className="text-muted d-block small">NET À ENCAISSER</span>
                  <span className="display-5 fw-bold text-warning">{totalA_Payer.toLocaleString()}</span>
                  <span className="ms-2 text-warning fw-bold">FCFA</span>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold text-muted">Mode de Règlement / Abonnement</label>
                  <select className="form-select bg-secondary text-white border-0 mb-3" value={modePaiement} onChange={handleModePaiementChange}>
                    <option value="ESPECES">💵 Espèces</option>
                    <option value="MOBILE_MONEY">📱 Mobile Money</option>
                    <option value="CARTE">💳 Carte Bancaire</option>
                    <option value="CHEQUE">✍️ Chèque</option>
                    <optgroup label="🔒 Prises en charge / Sociétés">
                      {abonnements.map((sub) => (
                        <option key={sub.id_abonnement} value={sub.nom}>
                          👤 {sub.nom} ({sub.taux || 0}%)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* --- AJOUT DU CHAMP POUR MODIFIER LE POURCENTAGE EN DIRECT --- */}
                <div className="mb-3 p-2 border border-secondary rounded bg-transparent">
                  <label className="form-label small fw-bold text-warning">Taux de Réduction Manuel (%)</label>
                  <div className="input-group input-group-sm">
                    <input 
                      type="number" 
                      className="form-control bg-dark text-white border-secondary"
                      min="0" 
                      max="100"
                      step="0.5"
                      value={tauxApplique} 
                      onChange={handleTauxChange}
                      placeholder="Ex: 10"
                    />
                    <span className="input-group-text bg-secondary text-white border-secondary">%</span>
                  </div>
                  <small className="text-muted d-block mt-1">Le caissier peut ajuster ce pourcentage librement.</small>
                </div>

              </div>

              <button onClick={validerVente} disabled={panier.length === 0} className="btn btn-warning btn-lg w-100 fw-bold mt-3 py-3 text-uppercase shadow">
                🚀 Valider l'encaissement
              </button>
            </div>
          </div>
        </div>

        {/* Historique */}
        <div className="row mt-2">
          <div className="col-12">
            <div className="card p-3 shadow-sm">
              <h5 className="card-title fw-bold text-secondary mb-3">📋 Ventes Récentes</h5>
              <div className="table-responsive" style={{ maxHeight: "250px" }}>
                <table className="table table-sm table-hover border align-middle mb-0">
                  <thead className="table-secondary sticky-top">
                    <tr>
                      <th>Date / Heure</th>
                      <th>Réf Vente</th>
                      <th>Mode</th>
                      <th className="text-end">Total Brut</th>
                      <th className="text-end">Prise en Charge</th>
                      <th className="text-end">Net Encaissé</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventesRecentes.map((v) => {
                      const brutTotal = parseFloat(v.total_sans_reduction || v.total_somme || 0);
                      const netPaye = parseFloat(v.total_somme || 0);
                      const partAbonne = parseFloat(v.total_prise_en_charge || 0);
                      return (
                        <tr key={v.id_vente}>
                          <td>{v.date_vente ? new Date(v.date_vente).toLocaleString() : "---"}</td>
                          <td className="small fw-bold text-uppercase">{v.id_vente ? `${v.id_vente.substring(0, 8)}...` : "---"}</td>
                          <td><span className="badge bg-light text-dark border">{v.mode_paiement}</span></td>
                          <td className="text-end text-muted">{brutTotal.toLocaleString()} F</td>
                          <td className="text-end text-danger fw-bold">{partAbonne > 0 ? `-${partAbonne.toLocaleString()} F` : "0 F"}</td>
                          <td className="text-end fw-bold text-success">{netPaye.toLocaleString()} FCFA</td>
                          <td className="text-end">
                            <button className="btn btn-sm btn-dark fw-bold" onClick={() => handleOuvrirFacture(v)}>🖨️ Facture</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODALE FACTURE */}
      <div className="modal fade" id="factureModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header no-print-btn">
              <h5 className="modal-title fw-bold">📄 Aperçu Facture</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              {venteSelectionnee ? (
                <div className="p-2 text-dark">
                  <div className="d-flex align-items-center border-bottom pb-3 mb-3">
                    {headerData.logo && (
                      <div className="me-3">
                        <img 
                          src={headerData.logo} 
                          style={{ width: "80px", maxHeight: "80px", objectFit: "contain" }} 
                          alt="Logo" 
                          onError={(e) => e.target.style.display = 'none'} 
                        />
                      </div>
                    )}
                    <div>
                      <h5 className="fw-bold text-uppercase mb-1">{headerData.nom}</h5>
                      <p className="small text-muted mb-0">{headerData.adresse}</p>
                      <p className="small text-muted mb-0 fw-bold">Tél: {headerData.telephone}</p>
                    </div>
                  </div>

                  <div className="row small mb-3">
                    <div className="col-7">
                      <strong>Facture N°:</strong> <span className="text-uppercase">{venteSelectionnee.id_vente?.substring(0, 13)}</span><br />
                      <strong>Date:</strong> {new Date(venteSelectionnee.date_vente).toLocaleString()}<br />
                    </div>
                    <div className="col-5 text-end">
                      <strong>Règlement:</strong> {venteSelectionnee.mode_paiement}<br />
                      <strong>Caissier:</strong> {currentUser?.nom_utilisateur || "Opérateur"}
                    </div>
                  </div>

                  <table className="table table-sm table-bordered align-middle small mb-3">
                    <thead className="table-light">
                      <tr>
                        <th>Médicament</th>
                        <th className="text-center">Qté</th>
                        <th className="text-end">Public</th>
                        <th className="text-end">Taux</th>
                        <th className="text-end">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {venteSelectionnee.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td className="fw-bold">{item.nom_produit}</td>
                          <td className="text-center">{item.quantite}</td>
                          <td className="text-end">{parseFloat(item.prix_unitaire_base || item.prix_unitaire_vendu).toLocaleString()}</td>
                          <td className="text-end text-danger">{item.taux_reduction > 0 ? `${item.taux_reduction}%` : "0%"}</td>
                          <td className="text-end fw-bold">{(item.quantite * item.prix_unitaire_vendu).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="border-top pt-2 text-end small">
                    <div className="d-flex justify-content-between border-bottom pb-1 mb-1">
                      <span>Total Public Brut :</span>
                      <span className="fw-bold">{parseFloat(venteSelectionnee.total_sans_reduction || 0).toLocaleString()} FCFA</span>
                    </div>
                    {parseFloat(venteSelectionnee.total_prise_en_charge) > 0 && (
                      <div className="d-flex justify-content-between border-bottom pb-1 mb-1 text-danger fw-bold">
                        <span>Pris en charge :</span>
                        <span>-{parseFloat(venteSelectionnee.total_prise_en_charge).toLocaleString()} FCFA</span>
                      </div>
                    )}
                    <div className="d-flex justify-content-between pt-1">
                      <h6 className="fw-bold text-uppercase m-0">Reste à payer :</h6>
                      <h5 className="fw-bold text-success m-0">{parseFloat(venteSelectionnee.total_somme || 0).toLocaleString()} FCFA</h5>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted">Chargement...</p>
              )}
            </div>
            <div className="modal-footer no-print-btn bg-light">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
              <button type="button" className="btn btn-dark fw-bold" onClick={handlePrintFacture}>🖨️ Lancer l'impression</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Caisse;
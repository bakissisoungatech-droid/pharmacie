import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import socket from "../socket";

function LotsStock() {
  const [produits, setProduits] = useState([]);
  const [alertesPeremption, setAlertesPeremption] = useState([]);

  // Champs du formulaire d'entrée en stock
  const [idProduit, setIdProduit] = useState("");
  const [quantiteDisponible, setQuantiteDisponible] = useState("");
  const [datePeremption, setDatePeremption] = useState("");
  const [prixAchatUnitaire, setPrixAchatUnitaire] = useState("");

  const [currentUser, setCurrentUser] = useState(null);

  // Récupération de l'utilisateur connecté
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Erreur de lecture du user", e);
      }
    }
  }, []);

  const getStructureId = useCallback(() => {
    return localStorage.getItem("id_structure") || currentUser?.id_structure;
  }, [currentUser]);

  const getAxiosConfig = useCallback(() => {
    const idStructure = getStructureId();
    if (!idStructure) return {};
    return { headers: { "id_structure": idStructure } };
  }, [getStructureId]);

  // --- CHARGEMENT DES DONNÉES ---
  const loadDonneesStock = useCallback(async () => {
    const idStructure = getStructureId();
    if (!idStructure) return;

    try {
      // 1. Charger les produits pour le sélecteur du formulaire
      const resProd = await axios.get("https://pharmacie-production-9a16.up.railway.app/api/produit", getAxiosConfig());
      setProduits(resProd.data);

      // 2. Charger les alertes de péremption (lots à -90 jours ou périmés)
      const resAlertes = await axios.get("https://pharmacie-production-9a16.up.railway.app/api/lots/alertes-peremption", getAxiosConfig());
      setAlertesPeremption(resAlertes.data);
    } catch (error) {
      console.error("Erreur lors du chargement des données de stock", error);
    }
  }, [getStructureId, getAxiosConfig]);

  useEffect(() => {
    const idStructure = getStructureId();
    if (!idStructure) return;

    loadDonneesStock();

    const handleRefresh = () => loadDonneesStock();
    socket.on("refresh_data", handleRefresh);

    return () => {
      socket.off("refresh_data", handleRefresh);
    };
  }, [getStructureId, loadDonneesStock]);

  // --- RECEPTION DE NOUVEAU STOCK (POST LOT) ---
  const handleEntreeStock = async (e) => {
    e.preventDefault();
    const idStructure = getStructureId();
    if (!idStructure) {
      alert("Votre session a expiré.");
      return;
    }

    const payload = {
      id_structure: idStructure,
      id_produit: idProduit,
      quantite_disponible: parseInt(quantiteDisponible, 10),
      date_peremption: datePeremption,
      prix_achat_unitaire: prixAchatUnitaire ? parseFloat(prixAchatUnitaire) : null,
      id_utilisateur: currentUser?.id_utilisateur // Pour l'historique d'audit des mouvements
    };

    try {
      await axios.post("https://pharmacie-production-9a16.up.railway.app/api/lots", payload, getAxiosConfig());
      alert("Nouvel arrivage enregistré et stock mis à jour !");
      
      // Réinitialisation du formulaire
      setIdProduit("");
      setQuantiteDisponible("");
      setDatePeremption("");
      setPrixAchatUnitaire("");
      
      loadDonneesStock();
    } catch (error) {
      alert("Erreur lors de l'entrée en stock : " + (error.response?.data?.error || error.message));
    }
  };

  // --- RETRAIT MANUEL D'UN LOT PÉRIMÉ ---
  const handleRetraitPerime = async (id_lot) => {
    const confirmation = window.confirm("Confirmez-vous le retrait et la mise au rebut de ce lot périmé ? Sa quantité disponible passera à 0.");
    if (!confirmation) return;

    try {
      await axios.post(
        `https://pharmacie-production-9a16.up.railway.app/api/lots/retrait-perime/${id_lot}`,
        {
          id_utilisateur: currentUser?.id_utilisateur,
          motif: "Retrait manuel via l'interface des périssables"
        },
        getAxiosConfig()
      );
      alert("Lot retiré du stock.");
      loadDonneesStock();
    } catch (error) {
      alert("Erreur lors du retrait du lot : " + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="container mt-4">
      <h3 className="mb-4">Gestion des Arrivages & Péremptions</h3>

      <div className="row g-4">
        {/* Formulaire d'entrée fournisseur / arrivage */}
        <div className="col-md-5">
          <div className="card p-3 shadow-sm border-primary">
            <h5 className="card-title fw-bold text-primary mb-3">📦 Enregistrer un Arrivage</h5>
            <form onSubmit={handleEntreeStock}>
              
              <div className="mb-3">
                <label className="form-label small fw-bold">Sélectionner le médicament</label>
                <select className="form-select" value={idProduit} onChange={(e) => setIdProduit(e.target.value)} required>
                  <option value="">-- Choisir un produit du catalogue --</option>
                  {produits.map((p) => (
                    <option key={p.id_produit} value={p.id_produit}>
                      {p.nom} (Stock actuel : {p.stock_total})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold">Quantité reçue</label>
                <input type="number" min="1" className="form-control" placeholder="Ex: 100" value={quantiteDisponible} onChange={(e) => setQuantiteDisponible(e.target.value)} required />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold">Date de péremption</label>
                <input type="date" className="form-control" value={datePeremption} onChange={(e) => setDatePeremption(e.target.value)} required />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold">Prix d'achat unitaire (Optionnel)</label>
                <input type="number" step="0.01" className="form-control" placeholder="Prix d'achat" value={prixAchatUnitaire} onChange={(e) => setPrixAchatUnitaire(e.target.value)} />
              </div>

              <button type="submit" className="btn btn-primary w-100 fw-bold">
                💾 Valider l'entrée en stock
              </button>
            </form>
          </div>
        </div>

        {/* Tableau de suivi des alertes de péremption */}
        <div className="col-md-7">
          <div className="card p-3 shadow-sm border-danger">
            <h5 className="card-title fw-bold text-danger mb-3">⚠️ Suivi des Dates Critiques (≤ 90 Jours)</h5>
            <div className="table-responsive">
              <table className="table table-sm table-hover border align-middle">
                <thead className="table-dark">
                  <tr>
                    <th>Médicament</th>
                    <th>Quantité</th>
                    <th>Date Exp.</th>
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
                        <td>{lot.quantite_disponible}</td>
                        <td>{new Date(lot.date_peremption).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge ${estPerime ? "bg-danger" : "bg-dark"}`}>
                            {estPerime ? "PÉRIMÉ" : `${jours} jours restants`}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-danger btn-sm px-2 py-0"
                            title="Retirer du stock (Passer à 0)"
                            onClick={() => handleRetraitPerime(lot.id_lot)}
                          >
                            🗑️ Jeter
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {alertesPeremption.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">
                        🎉 Aucun lot périmé ou proche de l'expiration à signaler.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LotsStock;
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

function ListeResultatsGroupes() {
  const [resultats, setResultats] = useState([]);
  const [filterDate, setFilterDate] = useState(""); // Nouvel état pour la date
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cette API doit retourner les lignes de résultats avec l'id_demande
        const res = await axios.get("http://localhost:3000/api/resultats/complets");
        setResultats(res.data);
      } catch (err) { console.error(err); }
    };
    fetchData();
  }, []);

  // --- LOGIQUE DE GROUPAGE ---
  const demandesGroupees = useMemo(() => {
    const dossiers = {};
    if (!resultats || resultats.length === 0) return [];

    resultats.forEach((ligne) => {
      const cleDossier = `${ligne.id_patient}_${ligne.id_demande}`;

      if (!dossiers[cleDossier]) {
        dossiers[cleDossier] = {
          infosPatient: { id: ligne.id_patient, nom: ligne.nom, prenom: ligne.prenom, date: ligne.date_demande },
          categories: {} 
        };
      }

      const catNom = ligne.categorie || "Autres";
      
      // On crée une clé unique par examen pour forcer un tableau individuel
      // Si c'est un bilan, on ajoute le préfixe pour le style
      const examenCle = ligne.est_bilan === 'OUI' 
        ? `BILAN : ${ligne.nom_examen}` 
        : ligne.nom_examen;

      if (!dossiers[cleDossier].categories[catNom]) {
        dossiers[cleDossier].categories[catNom] = {};
      }
      
      if (!dossiers[cleDossier].categories[catNom][examenCle]) {
        dossiers[cleDossier].categories[catNom][examenCle] = [];
      }

      dossiers[cleDossier].categories[catNom][examenCle].push(ligne);
    });

    // ... (ton code de filtrage par nom et date reste identique)
    return Object.values(dossiers).filter(d => {
        const nomComplet = `${d.infosPatient.nom || ""} ${d.infosPatient.prenom || ""}`.toLowerCase();
        const matchNom = nomComplet.includes(search.toLowerCase());
        let matchDate = true;
        if (filterDate !== "" && d.infosPatient.date) {
            const dateDossier = new Date(d.infosPatient.date).toISOString().split('T')[0];
            matchDate = dateDossier === filterDate;
        }
        return matchNom && matchDate;
    });
  }, [resultats, search, filterDate]);
  

  const imprimerDossier = (groupe) => {
    // Logique d'impression pour TOUS les examens du groupe
    console.log("Impression pour :", groupe.infosPatient.nom, groupe.examens);
    window.print();
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4 bg-light p-3 rounded shadow-sm">
        <h4>📋 Dossiers de Résultats Terminés</h4>
        <div className="d-flex gap-2 w-50">
          <input 
            type="date" 
            className="form-control" 
            onChange={(e) => setFilterDate(e.target.value)}
            title="Filtrer par date de demande"
          />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Rechercher un patient..." 
            onChange={(e) => setSearch(e.target.value)}
          />
          {/* Bouton optionnel pour réinitialiser les filtres */}
          {(search || filterDate) && (
            <button className="btn btn-outline-secondary btn-sm" onClick={() => {setSearch(""); setFilterDate("");}}>
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {demandesGroupees.map((groupe, idx) => (
        <div key={idx} className="card shadow-sm mb-5 border-primary">
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <div>
              <strong className="text-uppercase">{groupe.infosPatient.nom} {groupe.infosPatient.prenom}</strong>
              <span className="ms-3 small">📅 {new Date(groupe.infosPatient.date).toLocaleString()}</span>
            </div>
            <button className="btn btn-sm btn-light" onClick={() => imprimerDossier(groupe)}>🖨️ Imprimer Dossier</button>
          </div>
          
          <div className="card-body">
            {Object.entries(groupe.categories).map(([nomCat, examensDuGroupe], catIdx) => (
              <div key={catIdx} className="mb-5 border rounded shadow-sm bg-white">
                {/* TITRE DE LA CATÉGORIE (BIOCHIMIE, etc.) */}
                <h5 className="bg-dark text-white p-2 text-uppercase small fw-bold rounded-top mb-0">
                  {nomCat}
                </h5>
                
                <div className="p-3">
                  {Object.entries(examensDuGroupe).map(([nomExamen, lignes], exIdx) => {
                    const isBio = lignes[0]?.est_biochimie === 'OUI';
                    const isBilan = lignes[0]?.est_bilan === 'OUI';

                    return (
                      <div key={exIdx} className="mb-4">
                        {/* EN-TÊTE DE L'EXAMEN SEUL */}
                        <div className={`p-2 border border-bottom-0 rounded-top ${isBilan ? 'bg-primary text-white' : 'bg-light fw-bold'}`}>
                          <small>{isBilan ? "📑 BILAN : " : "🔬 EXAMEN : "}{nomExamen}</small>
                        </div>

                        <div className="table-responsive">
                          <table className="table table-sm table-bordered mb-0">
                            <thead className="table-secondary small text-center">
                              <tr>
                                <th style={{ width: '25%' }}>Paramètre</th>
                                <th>Résultat</th>
                                {/* COLONNES DYNAMIQUES SELON TYPE */}
                                {isBio ? (
                                  <th style={{ width: '35%' }}>Valeurs de Référence</th>
                                ) : (
                                  <>
                                    <th>Titre</th>
                                    <th>Valeur</th>
                                    <th>Interprétation</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody className="small">
                              {lignes.map((ligne, lIdx) => (
                                <tr key={lIdx} className="text-center align-middle">
                                  <td className="text-start ps-2">{ligne.nom_parametre}</td>
                                  <td className={`fw-bold ${ligne.valeur_resultat === 'POSITIF' ? 'text-danger' : ''}`}>
                                    {ligne.valeur_resultat}
                                  </td>

                                  {isBio ? (
                                    <td>{ligne.norme_reference}</td>
                                  ) : (
                                    <>
                                      <td>{ligne.titre_sero}</td>
                                      <td>{ligne.norme_reference}</td>
                                      <td className="fst-italic">{ligne.interpretation_sero}</td>
                                    </>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ListeResultatsGroupes;
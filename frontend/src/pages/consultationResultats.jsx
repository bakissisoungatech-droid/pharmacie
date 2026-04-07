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
      
      // LOGIQUE CRITIQUE : Si c'est un bilan, il devient lui-même sa propre "sous-catégorie" 
      // pour avoir son propre tableau dédié.
      const sousCatNom = ligne.est_bilan === 'OUI' 
        ? `BILAN : ${ligne.nom_examen}` 
        : (ligne.sous_categories || "Général");

      if (!dossiers[cleDossier].categories[catNom]) {
        dossiers[cleDossier].categories[catNom] = {};
      }
      
      if (!dossiers[cleDossier].categories[catNom][sousCatNom]) {
        dossiers[cleDossier].categories[catNom][sousCatNom] = [];
      }

      dossiers[cleDossier].categories[catNom][sousCatNom].push(ligne);
    });

    // Remplace ton bloc filter dans useMemo par celui-ci :
    return Object.values(dossiers).filter(d => {
        // Sécurité Nom
        const nomComplet = `${d.infosPatient.nom || ""} ${d.infosPatient.prenom || ""}`.toLowerCase();
        const matchNom = nomComplet.includes(search.toLowerCase());
        
        // Sécurité Date
        let matchDate = true;
        if (filterDate !== "" && d.infosPatient.date) {
            try {
                const dateDossier = new Date(d.infosPatient.date).toISOString().split('T')[0];
                matchDate = dateDossier === filterDate;
            } catch (e) {
                matchDate = false;
            }
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
            {Object.entries(groupe.categories).map(([nomCat, sousGroupes], catIdx) => {
              const isBacterio = nomCat.toLowerCase().includes("bactério");
              const isSero = nomCat.toLowerCase().includes("serologie");

              return (
                <div key={catIdx} className="mb-4 border rounded p-2 bg-white">
                  {/* TITRE CATÉGORIE PRINCIPALE */}
                  <h5 className="bg-dark text-white p-2 text-uppercase small fw-bold rounded-top mb-0">
                    {nomCat}
                  </h5>
                  
                  {/* BOUCLE SUR LES SOUS-CATÉGORIES */}
                  
                  {Object.entries(sousGroupes).map(([nomSousCat, examens], sCatIdx) => (
                    <div key={sCatIdx} className="mt-3 px-2 border-start border-3 border-info ms-2 mb-4">
                      <h6 className="text-primary fw-bold text-uppercase small bg-light p-2 rounded">
                        {nomSousCat.includes("BILAN") ? `📑 ${nomSousCat}` : `📂 ${nomSousCat}`}
                      </h6>

                      <div className="table-responsive">
                        <table className="table table-sm table-bordered mb-0">
                          <thead className="table-secondary small text-center">
                            <tr>
                              <th style={{width: '30%'}}>Examen</th>
                              <th>Paramètre</th>
                              <th>Valeur</th>
                              <th>Unités</th>
                              <th>Normes</th>
                            </tr>
                          </thead>
                          <tbody className="small">
                            {examens.map((ex, l) => (
                              <tr key={l}>
                                {/* Utilise les nouveaux noms de colonnes définis dans le SQL */}
                                <td>{ex.nom_parametre}</td>
                                <td className="fw-bold">{ex.valeur_resultat}</td>
                                <td className="text-muted small">{ex.norme_reference}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ListeResultatsGroupes;
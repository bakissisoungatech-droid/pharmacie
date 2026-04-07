import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

function ListeResultatsGroupes() {
  const [resultats, setResultats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterDate, setFilterDate] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await axios.get("http://localhost:3000/api/resultats/complets");
        setResultats(res.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const demandesGroupees = useMemo(() => {
    const dossiers = {};
    if (!resultats || resultats.length === 0) return [];

    resultats.forEach((ligne) => {
      const cleDossier = `${ligne.id_patient}_${ligne.id_demande}`;
      if (!dossiers[cleDossier]) {
        dossiers[cleDossier] = {
          infos: { nom: ligne.nom, prenom: ligne.prenom, date: ligne.date_demande },
          categories: {}
        };
      }

      const cat = ligne.categorie || "AUTRES";
      const sousCat = ligne.est_bilan === 'OUI' ? `BILAN : ${ligne.nom_examen}` : "EXAMENS SIMPLES";

      if (!dossiers[cleDossier].categories[cat]) dossiers[cleDossier].categories[cat] = {};
      if (!dossiers[cleDossier].categories[cat][sousCat]) dossiers[cleDossier].categories[cat][sousCat] = [];
      
      dossiers[cleDossier].categories[cat][sousCat].push(ligne);
    });

    return Object.values(dossiers).filter(d => {
      const matchNom = `${d.infos.nom} ${d.infos.prenom}`.toLowerCase().includes(search.toLowerCase());
      const matchDate = !filterDate || (d.infos.date && new Date(d.infos.date).toISOString().split('T')[0] === filterDate);
      return matchNom && matchDate;
    });
  }, [resultats, search, filterDate]);

  if (loading) return <div className="text-center mt-5"><div className="spinner-border text-primary"></div><p>Chargement des dossiers...</p></div>;
  if (error) return <div className="alert alert-danger m-5"><h4>Erreur Serveur</h4><code>{error}</code></div>;

  return (
    <div className="container py-4">
      <div className="card shadow-sm mb-4 border-0">
        <div className="card-body d-flex gap-3 align-items-center bg-white rounded">
          <h4 className="mb-0 me-auto text-primary fw-bold">Consultation</h4>
          <input type="date" className="form-control w-auto" onChange={e => setFilterDate(e.target.value)} />
          <input type="text" className="form-control w-25" placeholder="Nom du patient..." onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {demandesGroupees.length === 0 ? (
        <div className="text-center py-5 text-muted">Aucun résultat trouvé pour ces critères.</div>
      ) : (
        demandesGroupees.map((dossier, i) => (
          <div key={i} className="card shadow-sm mb-4 border-0 rounded-3">
            <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
              <span className="h5 mb-0 text-uppercase">{dossier.infos.nom} {dossier.infos.prenom}</span>
              <span className="badge bg-primary">Demande du : {new Date(dossier.infos.date).toLocaleDateString()}</span>
            </div>
            <div className="card-body bg-light">
              {Object.entries(dossier.categories).map(([cat, sousCats], j) => (
                <div key={j} className="mb-4">
                  <h6 className="text-primary border-bottom pb-2 fw-bold">{cat}</h6>
                  {Object.entries(sousCats).map(([sCat, examens], k) => (
                    <div key={k} className="ms-3 mb-3">
                      <p className="small fw-bold text-muted mb-1">{sCat}</p>
                      <table className="table table-sm table-bordered bg-white shadow-sm">
                        <thead className="table-secondary small">
                          <tr><th>Examen / Paramètre</th><th>Résultat</th><th>Référence</th></tr>
                        </thead>
                        <tbody>
                          {examens.map((ex, l) => (
                            <tr key={l}>
                              <td>{ex.nom_parametre || ex.nom_examen}</td>
                              <td className="fw-bold">{ex.valeur}</td>
                              <td className="text-muted small">{ex.valeur_normale}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default ListeResultatsGroupes;
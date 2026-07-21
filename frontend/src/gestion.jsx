import React, { useState, useEffect } from "react";
import logo from "/bakissi.png"

// --- IMPORTS DES COMPOSANTS PHARMACIE ---
import Dashboard from "./pages/dashboard"; 
import ProduitsEtStock from "./pages/produits"; 
import Caisse from "./pages/caisse"; 
import LotsStock from "./pages/lotStock"; 

// --- IMPORTS CONFIGURATION & AUTHENTIFICATION ---
import Abonnement from "./pages/abonnement";
import Inscription from "./inscription2";
import Login from "./login";

const GestionStructures = () => <div className="card p-3">Gestion Structures</div>;
const AuthentificationUnique = () => <div className="card p-3">Authentification Unique</div>;

function GestionPharmacie() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Récupérer le rôle en extrayant proprement la clé depuis l'objet "user"
  const getRoleFromSession = () => {
    try {
      const storedUser = sessionStorage.getItem("user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        return parsed.role ? parsed.role.toLowerCase() : "visiteur";
      }
    } catch (e) {
      console.error("Erreur de lecture du rôle", e);
    }
    return "visiteur"; 
  };

  const [activePage, setActivePage] = useState(() => {
    return sessionStorage.getItem("activePage") || "dashboard";
  });
  
  const [userRole, setUserRole] = useState(() => getRoleFromSession()); 

  const [openMenus, setOpenMenus] = useState({
    officine: true,
    administration: false,
  });

  // Synchronisation de la page active uniquement
  useEffect(() => {
    sessionStorage.setItem("activePage", activePage);
  }, [activePage]);

  // Écouteur ciblé uniquement sur les changements de session
  useEffect(() => {
    const handleSessionChange = () => {
      setUserRole(getRoleFromSession());
    };

    window.addEventListener("sessionUpdate", handleSessionChange);
    window.addEventListener("storage", handleSessionChange);

    return () => {
      window.removeEventListener("sessionUpdate", handleSessionChange);
      window.removeEventListener("storage", handleSessionChange);
    };
  }, []);

  const toggleMenu = (menuKey) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }));
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    setIsSidebarOpen(false);
  };

  // 🟢 CORRECTION ICI : Remplacement de "caisse" par "caissier"
  const renderContent = () => {
    switch (activePage) {
      case "dashboard": return <Dashboard />;
      case "caisse": return ["admin", "caissier"].includes(userRole) ? <Caisse /> : <Dashboard />;
      case "lots": return ["admin", "pharmacien"].includes(userRole) ? <LotsStock /> : <Dashboard />;
      case "produits": return ["admin", "pharmacien"].includes(userRole) ? <ProduitsEtStock /> : <Dashboard />;
      case "abonnement": return userRole === "admin" ? <Abonnement /> : <Dashboard />;
      case "utilisateurs": return userRole === "admin" ? <Inscription /> : <Dashboard />;
      case "structures": return userRole === "admin" ? <GestionStructures /> : <Dashboard />;
      case "login": return <Login />;
      case "login1": return <AuthentificationUnique />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="d-flex position-relative style-parent-container">
      
      {/* 1. BOUTON BURGER */}
      <button
        className="btn btn-dark d-md-none m-2 no-print"
        style={{ 
          position: "fixed", 
          top: "10px", 
          left: "10px", 
          zIndex: 1100,
          boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
        }}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-label="Toggle Navigation"
      >
        {isSidebarOpen ? "✕" : "☰"}
      </button>

      {/* 2. OVERLAY FLOU */}
      {isSidebarOpen && (
        <div 
          className="d-md-none position-fixed top-0 start-0 w-100 h-100 no-print" 
          style={{ 
            backgroundColor: "rgba(0,0,0,0.5)", 
            zIndex: 1040, 
            backdropFilter: "blur(2px)" 
          }}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 3. BARRE DE NAVIGATION LATÉRALE */}
      <div
        className={`bg-dark text-white p-3 vh-100 no-print 
          ${isSidebarOpen ? "position-fixed top-0 start-0" : "d-none"} 
          d-md-block sticky-md-top`}
        style={{ 
          width: "260px", 
          overflowY: "auto", 
          boxShadow: "4px 0 10px rgba(0,0,0,0.15)",
          zIndex: 1050,
          transition: "all 0.3s ease"
        }}
      >
        <div className="d-md-none" style={{ height: "45px" }}></div>

        <a href={logo} target="_blank" rel="noopener noreferrer"><img src={logo}  alt="" style={{width: "25vh"}}/></a>
        {/* <h4 className="text-center mb-4 fw-bold text-success border-bottom pb-3">BAKISSI</h4> */}

        <div className="mb-3 text-center">
          <span className="badge bg-secondary p-2">Rôle : {userRole.toUpperCase()}</span>
        </div>

        <ul className="nav flex-column gap-1">
          <li className="nav-item">
            <button
              onClick={() => handlePageChange("dashboard")}
              className={`nav-link w-100 text-start text-white btn border-0 py-2 d-flex align-items-center gap-2 ${
                activePage === "dashboard" ? "bg-success fw-bold rounded" : ""
              }`}
            >
              📊 <span>Tableau de bord</span>
            </button>
          </li>

          {/* SECTION 1 : GESTION PHARMACIE */}
          <li className="nav-item mt-2">
            <button
              onClick={() => toggleMenu("officine")}
              className="nav-link w-100 text-start text-white btn border-0 d-flex justify-content-between align-items-center py-2"
              style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "4px" }}
            >
              <span className="fw-bold text-success">🟢 Activité Pharmacie</span>
              <small>{openMenus.officine ? "▲" : "▼"}</small>
            </button>
            
            {openMenus.officine && (
              <ul className="nav flex-column ms-2 my-1 ps-2 border-start border-success gap-1">
                {/* 🟢 COMPTOIR DE VENTE : Accessible pour admin et caissier */}
                {["admin", "caissier"].includes(userRole) && (
                  <li>
                    <button
                      onClick={() => handlePageChange("caisse")}
                      className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-2 ${activePage === "caisse" ? "text-success fw-bold bg-secondary bg-opacity-25" : ""}`}
                    >
                      🛒 Comptoir de Vente (Caisse)
                    </button>
                  </li>
                )}

                {/* CATALOGUE : Accessible pour admin et pharmacien */}
                {["admin", "pharmacien"].includes(userRole) && (
                  <li>
                    <button
                      onClick={() => handlePageChange("produits")}
                      className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-2 ${activePage === "produits" ? "text-success fw-bold bg-secondary bg-opacity-25" : ""}`}
                    >
                      💊 Catalogue Médicaments
                    </button>
                  </li>
                )}
              </ul>
            )}
          </li>

          {/* SECTION 2 : CONFIGURATION & ADMINISTRATION (Strictement réservée à l'admin) */}
          {userRole === "admin" && (
            <li className="nav-item mt-1">
              <button
                onClick={() => toggleMenu("administration")}
                className="nav-link w-100 text-start text-white btn border-0 d-flex justify-content-between align-items-center py-2"
                style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "4px" }}
              >
                <span>⚙️ Paramètres & Sessions</span>
                <small>{openMenus.administration ? "▲" : "▼"}</small>
              </button>
              
              {openMenus.administration && (
                <ul className="nav flex-column ms-2 my-1 ps-2 border-start border-secondary gap-1">
                  <li>
                    <button
                      onClick={() => handlePageChange("abonnement")}
                      className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-1 ${activePage === "abonnement" ? "text-success fw-bold" : ""}`}
                    >
                      • Gestion d'abonnement (Admin)
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handlePageChange("utilisateurs")}
                      className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-1 ${activePage === "utilisateurs" ? "text-success fw-bold" : ""}`}
                    >
                      • Enrôler du Personnel (Admin)
                    </button>
                  </li>
                  {/* <li>
                    <button
                      onClick={() => handlePageChange("structures")}
                      className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-1 ${activePage === "structures" ? "text-success fw-bold" : ""}`}
                    >
                      • Gestion Structures (Admin)
                    </button>
                  </li> */}
                  <li className="nav-item mt-1">
                    <button
                      onClick={() => handlePageChange("login")}
                      className={`nav-link w-100 text-start text-white btn border-0 py-2 d-flex align-items-center gap-2 ${activePage === "login" ? "bg-secondary bg-opacity-25 fw-bold rounded" : ""}`}
                    >
                      🔐 <span>Connexion Session</span>
                    </button>
                  </li>
                </ul>
              )}
            </li>
          )}

          {/* LIEN DE CONNEXION DE BASE (Sorti du menu administration pour être visible par le caissier) */}
          

        </ul>
      </div>

      {/* 4. ZONE D'AFFICHAGE DYNAMIQUE */}
      <div className="p-3 p-md-4 flex-grow-1" style={{ minHeight: "100vh", backgroundColor: "#f4f6f9", width: "100%", overflowX: "hidden" }}>
        <div className="d-md-none" style={{ height: "40px" }}></div>
        {renderContent()}
      </div>
    </div>
  );
}

export default GestionPharmacie;
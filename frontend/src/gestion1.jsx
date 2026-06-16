import React, { useState } from "react";

// --- IMPORTS DES COMPOSANTS PHARMACIE ---
import Dashboard from "./pages/dashboard"; 
import ProduitsEtStock from "./pages/Produits"; 
import Caisse from "./pages/caisse"; 
import LotsStock from "./pages/lotStock"; 

// --- IMPORTS CONFIGURATION & AUTHENTIFICATION ---
import Abonnement from "./pages/abonnement";
import Inscription from "./inscription";
import Login from "./login";
import AuthentificationUnique from "./login1";
import GestionStructures from "./structures";

function GestionPharmacie() {
  const [activePage, setActivePage] = useState("dashboard");
  
  // Par défaut sur false pour ne pas obstruer l'écran au chargement sur mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Rôles disponibles pour tester le filtrage : "admin", "pharmacien", "caisse"
  const [userRole, setUserRole] = useState("admin"); 

  const [openMenus, setOpenMenus] = useState({
    officine: true,
    administration: false,
  });

  const toggleMenu = (menuKey) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }));
  };

  // Gère la navigation et ferme automatiquement le menu tiroir sur écrans tactiles/mobiles
  const handlePageChange = (page) => {
    setActivePage(page);
    setIsSidebarOpen(false); 
  };

  const renderContent = () => {
    switch (activePage) {
      case "dashboard": return <Dashboard />;
      case "caisse": return <Caisse />;
      case "lots": return ["admin", "pharmacien"].includes(userRole) ? <LotsStock /> : <Dashboard />;
      case "produits": return ["admin", "pharmacien"].includes(userRole) ? <ProduitsEtStock /> : <Dashboard />;
      case "abonnement": return ["admin"].includes(userRole) ? <Abonnement /> : <Dashboard />;
      case "utilisateurs": return userRole === "admin" ? <Inscription /> : <Dashboard />;
      case "structures": return userRole === "admin" ? <GestionStructures /> : <Dashboard />;
      case "login": return <Login />;
      case "login1": return <AuthentificationUnique />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="d-flex position-relative" style={{ overflowX: "hidden", minHeight: "100vh" }}>
      
      {/* 1. BOUTON BURGER MOBILES (Fixé en haut à gauche, masqué sur PC via d-md-none) */}
      <button
        className="btn btn-dark d-md-none m-2 no-print"
        style={{ 
          position: "fixed", 
          top: "10px", 
          left: "10px", 
          zIndex: 1100,
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
        }}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-label="Menu"
      >
        {isSidebarOpen ? "✕" : "☰"}
      </button>

      {/* 2. TOILE DE FOND / OVERLAY ABSORBANT (Ferme le menu si on clique à côté de la sidebar sur mobile) */}
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

      {/* 3. SIDEBAR RESPONSIVE */}
      <div
        className={`bg-dark text-white p-3 vh-100 no-print 
          ${isSidebarOpen ? "position-fixed top-0 start-0" : "d-none"} 
          d-md-block sticky-top`}
        style={{ 
          width: "260px", 
          overflowY: "auto", 
          boxShadow: "4px 0 10px rgba(0,0,0,0.15)",
          zIndex: 1050,
          transition: "transform 0.3s ease"
        }}
      >
        {/* Marge de courtoisie pour éviter que le bouton 'Changer/Fermer' ne chevauche le titre BAKISSI sur mobile */}
        <div className="d-md-none" style={{ height: "45px" }}></div>

        <h4 className="text-center mb-4 fw-bold text-success border-bottom pb-3">BAKISSI</h4>

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
                <li>
                  <button
                    onClick={() => handlePageChange("caisse")}
                    className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-2 ${activePage === "caisse" ? "text-success fw-bold bg-secondary bg-opacity-25" : ""}`}
                  >
                    🛒 Comptoir de Vente (Caisse)
                  </button>
                </li>
                
                {["admin", "pharmacien"].includes(userRole) && (
                  <>
                    {/* <li>
                      <button
                        onClick={() => handlePageChange("lots")}
                        className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-2 ${activePage === "lots" ? "text-success fw-bold bg-secondary bg-opacity-25" : ""}`}
                      >
                        📦 Arrivages & Périssables
                      </button>
                    </li> */}
                    <li>
                      <button
                        onClick={() => handlePageChange("produits")}
                        className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-2 ${activePage === "produits" ? "text-success fw-bold bg-secondary bg-opacity-25" : ""}`}
                      >
                        💊 Catalogue Médicaments
                      </button>
                    </li>
                  </>
                )}
              </ul>
            )}
          </li>

          {/* SECTION 2 : CONFIGURATION & ADMINISTRATION */}
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
                {userRole === "admin" && (
                  <>
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
                    <li>
                      <button
                        onClick={() => handlePageChange("structures")}
                        className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-1 ${activePage === "structures" ? "text-success fw-bold" : ""}`}
                      >
                        • Multi-Établissements (Admin)
                      </button>
                    </li>
                  </>
                )}
                <li>
                  <button
                    onClick={() => handlePageChange("login")}
                    className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-1 ${activePage === "login" ? "text-success fw-bold" : ""}`}
                  >
                    • Connexion Session
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handlePageChange("login1")}
                    className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-1 ${activePage === "login1" ? "text-success fw-bold" : ""}`}
                  >
                    • Portail Unique (SSO)
                  </button>
                </li>
              </ul>
            )}
          </li>
        </ul>
      </div>

      {/* 4. CONTENEUR PRINCIPAL DYNAMIQUE */}
      <div 
        className="p-3 p-md-4 flex-grow-1" 
        style={{ 
          minHeight: "100vh", 
          backgroundColor: "#f4f6f9",
          width: "100%",
          overflowX: "hidden" 
        }}
      >
        {/* Espacement de sécurité pour éviter que le contenu applicatif passe sous le bouton Burger sur smartphone */}
        <div className="d-md-none" style={{ height: "40px" }}></div>
        {renderContent()}
      </div>

    </div>
  );
}

export default GestionPharmacie;
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
  const savedUser = sessionStorage.getItem("user");
  const location = useLocation();

  // 1. Si aucun utilisateur n'est connecté -> Retour immédiat à l'écran de connexion
  if (!savedUser) {
    return <Navigate to="/" replace />;
  }

  let user;
  try {
    user = JSON.parse(savedUser);
  } catch (e) {
    console.error("Erreur de parsing de la session utilisateur", e);
    sessionStorage.removeItem("user"); // Nettoyage de la session corrompue
    return <Navigate to="/" replace />;
  }

  // 2. Vérification des droits basés sur le rôle
  if (allowedRoles && !allowedRoles.includes(user?.role?.toLowerCase())) {
    // Si c'est un proprio qui s'est égaré ailleurs
    if (user?.role?.toLowerCase() === "proprio") {
      return <Navigate to="/gestionnaire" replace />;
    }
    
    // Si c'est un utilisateur standard avec un rôle valide mais pas sur la bonne page
    const rolesStandards = ["employe", "caissier", "admin", "pharmacien"];
    if (rolesStandards.includes(user?.role?.toLowerCase()) && location.pathname !== "/gestion") {
      return <Navigate to="/gestion" replace />;
    }

    // Sécurité absolue : Si le rôle est inconnu ou bizarre, on évite la boucle infinie, retour à la case départ
    sessionStorage.removeItem("user");
    return <Navigate to="/" replace />;
  }

  // Si tout est valide, on affiche les composants enfants
  return children;
}
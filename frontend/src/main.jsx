import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import './index.css'
import 'bootstrap/dist/css/bootstrap.min.css';

// Vos imports de composants
import Login from './login.jsx';
import Gestion1 from './gestion_admin.jsx'; // Admin
import Gestion from './gestion.jsx';        // Proprio / Global
// Note : Assurez-vous que ces fichiers existent avec les bons noms
import Gestion2 from './gestion_reception.jsx';      // Réception / Accueil
import Gestion3 from './gestion_medecin.jsx';      // Médecin

// Import du gardien de sécurité
import ProtectedRoute from './ProtectedRoute.jsx';

let router = createBrowserRouter([
  {
    path: "/",
    element: <AuthentificationUnique />, // Page publique de connexion
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute allowedRoles={["Admin"]}>
        <Gestion1 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/reception",
    element: (
      <ProtectedRoute allowedRoles={["Accueil", "Admin"]}>
        <Gestion2 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/medecin",
    element: (
      <ProtectedRoute allowedRoles={["Medecin", "Admin"]}>
        <Gestion3 />
      </ProtectedRoute>
    ),
  },
  {
    path: "/gestion",
    element: (
      <ProtectedRoute allowedRoles={["Proprio", "Admin"]}>
        <Gestion />
      </ProtectedRoute>
    ),
  },
  // Optionnel : Une route "Catch-all" si l'utilisateur tape n'importe quoi
  {
    path: "*",
    element: <Navigate to="/" replace />,
  }
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//     <Gestion />
//   </StrictMode>,
// )

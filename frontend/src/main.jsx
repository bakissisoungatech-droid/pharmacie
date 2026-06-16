import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css';

import AuthentificationUnique from './login1.jsx';
import Login from './login.jsx'; // Assurez-vous d'utiliser le bon composant ici si nécessaire
import Gestion from './gestion.jsx'; 
import Gestion1 from './gestion1.jsx';       

import ProtectedRoute from './ProtectedRoute.jsx';

let router = createBrowserRouter([
  {
    path: "/",
    element: <AuthentificationUnique />, 
  },
  {
    path: "/gestion",
    element: (
      <ProtectedRoute allowedRoles={["employe", "caissier", "admin", "pharmacien"]}>
        <Gestion />
      </ProtectedRoute>
    ),
  },
  {
    path: "/gestion1",
    element: (
      <ProtectedRoute allowedRoles={["proprio"]}>
        <Gestion1 />
      </ProtectedRoute>
    ),
  },
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
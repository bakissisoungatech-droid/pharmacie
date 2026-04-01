import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// import ReactDOM from 'react-dom/client'
// import {
//   createBrowserRouter,
//   RouterProvider,
// } from "react-router-dom";
import './index.css'
import App from './App.jsx'
import PatientsCRUD from './pages/PatientsCRUD.jsx'
import Inscription from './inscription.jsx'
import Connexion from './Connexion.jsx'
import Gestion from './Gestion.jsx'

// let router = createBrowserRouter([
//   {
//     path: "/",
//     element: <PatientsCRUD />,
//     // loader: loadRootData,
//   },
//   {
//     path: "/urgence",
//     element: <Urgence />,
//   },
//   {
//     path: "/service",
//     element: <Service />,
//   },
//   {
//     path: "/apropos",
//     element: <Apropos />,
//   },
//   {
//     path: "/hospitalisation",
//     element: <Hospitalisation />,
//   },
//   {
//     path: "/contact",
//     element: <Contact />,
//   },
// ]);

// ReactDOM.createRoot(document.getElementById('root')).render(
//   <RouterProvider router={router} />
// );

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Gestion />
  </StrictMode>,
)

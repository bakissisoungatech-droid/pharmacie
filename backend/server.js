const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require('dotenv').config();

const app = express();

// 1. Définition des origines autorisées (Frontend Railway + Localhost)
const allowedOrigins = [
  "https://bakissi.up.railway.app",
  "http://localhost:5173",
  "http://localhost:3000"
];

// 2. Configuration CORS unique pour Express
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
}));

// 3. Middlewares de parsing (un seul express.json avec la limite)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 4. Initialisation du Serveur HTTP & Socket.io
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["polling", "websocket"] // Autorise la négociation HTTP avant upgrade WebSocket
});

// 5. Attachement de Socket.io à l'application
require("./socket")(io);
app.set("socketio", io);

// 6. Routes API
app.use("/api/lots", require("./routes/lots"));
app.use("/api/produit", require("./routes/produit"));
app.use("/api/structure", require("./routes/structure"));
app.use("/api/utilisateur", require("./routes/utilisateur"));
app.use("/api/abonnement", require("./routes/abonnement"));
app.use("/api/vente", require("./routes/vente"));
app.use("/api/recherche", require("./routes/recherche"));
app.use("/api/dashboard", require("./routes/dashboard"));

// 7. Lancement du serveur sur le port attribué par Railway
const PORT = process.env.PORT || process.env.PG_PORT_SERVER || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré et à l'écoute sur le port ${PORT}`);
});
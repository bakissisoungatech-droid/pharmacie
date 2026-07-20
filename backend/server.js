const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
require('dotenv').config();

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(cors());
app.use(express.json());


const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});
app.use(cors({
  origin: ["https://bakissi.up.railway.app", "http://localhost:5173"],
  credentials: true
}));

require("./socket")(io);

app.set("socketio", io);

// routes
app.use("/api/lots", require("./routes/lots"));
app.use("/api/produit", require("./routes/produit"));
app.use("/api/structure", require("./routes/structure"));
app.use("/api/utilisateur", require("./routes/utilisateur"));
app.use("/api/abonnement", require("./routes/abonnement"));
app.use("/api/vente", require("./routes/vente"));
app.use("/api/recherche", require("./routes/recherche"));
app.use("/api/dashboard", require("./routes/dashboard"));

server.listen(PG_PORT_SERVER || 3000, () => console.log("Serveur lancé"));

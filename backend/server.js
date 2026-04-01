const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

require("./socket")(io);

// routes
app.use("/api/patient", require("./routes/patient"));
app.use("/api/parameteur", require("./routes/parameteur"));
app.use("/api/consultation", require("./routes/consultation"));
app.use("/api/examen", require("./routes/examens"));
app.use("/api/demande", require("./routes/demande"));
app.use("/api/demande_examen", require("./routes/demande"));
app.use("/api/demande_examen1", require("./routes/demande_examen1"));
app.use("/api/resultats", require("./routes/resultat"));
app.use("/api/utilisateur", require("./routes/utilisateur"));
app.use("/api/abonnement", require("./routes/abonnement"));
// app.use("/api/connexion", require("./routes/auth"));

server.listen(3000, () => console.log("Serveur lancé"));

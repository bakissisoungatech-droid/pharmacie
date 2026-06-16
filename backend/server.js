const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(cors());
app.use(express.json());


const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

require("./socket")(io);

app.set("socketio", io);

// routes
app.use("/api/lots", require("./routes/lots"));
app.use("/api/produit", require("./routes/produit"));
app.use("/api/structure", require("./routes/structure"));
app.use("/api/utilisateur", require("./routes/utilisateur"));
app.use("/api/abonnement", require("./routes/abonnement"));
app.use("/api/vente", require("./routes/vente"));
app.use("/api/dashboard", require("./routes/dashboard"));

server.listen(3000, () => console.log("Serveur lancé"));

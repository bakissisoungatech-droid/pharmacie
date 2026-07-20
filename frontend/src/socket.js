import { io } from "socket.io-client";

// Configuration recommandée pour Railway
const socket = io("https://pharmacie-production-9a16.up.railway.app", {
  transports: ["polling", "websocket"], // Autorise le polling d'abord pour établir le handshake
  secure: true,
  reconnectionAttempts: 5,
  timeout: 20000
});

export default socket;

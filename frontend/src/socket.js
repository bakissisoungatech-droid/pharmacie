import { io } from "socket.io-client";

const socket = io("https://pharmacie-production-9a16.up.railway.app", {
  transports: ["websocket", "polling"],
  withCredentials: true
});

export default socket;
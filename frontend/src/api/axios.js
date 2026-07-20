import axios from "axios";

export default axios.create({
  baseURL: "https://pharmacie-production-9a16.up.railway.app/api",
});

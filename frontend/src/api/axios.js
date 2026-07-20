import axios from "axios";

export default axios.create({
  baseURL: "https://postgres-production-2352.up.railway.app/api",
});

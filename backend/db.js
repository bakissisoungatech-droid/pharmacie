const { Pool } = require("pg");
require('dotenv').config();

// On récupère l'URL complète de la base de données
const connectionString = process.env.PG_DATABASE ;

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // OBLIGATOIRE pour accepter le certificat SSL de Railway
  },
  connectionTimeoutMillis: 5000 // Abandonne au bout de 5 sec si la BD ne répond pas au lieu de bloquer des minutes
});

pool.on("connect", () => {
  console.log("🟢 Connecté à la base de données PostgreSQL");
});

pool.on("error", (err) => {
  console.error("🔴 Erreur inattendue sur le pool PostgreSQL :", err);
});
// const pool = new Pool({
//   user: process.env.PG_USER,
//   host: process.env.PG_HOST,
//   database: process.env.PG_DATABASE,
//   password: process.env.PG_PASSWORD,
//   port: process.env.PG_PORT
// });

module.exports = pool;

// const { Pool } = require("pg");
// require('dotenv').config();




// module.exports = pool;  
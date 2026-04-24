const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: Number(process.env.MYSQL_PORT || 3306)
};

const dbConfigOld = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: 'InventoryIT',
  port: Number(process.env.MYSQL_PORT || 3306)
};

async function crearConexion() {
  return mysql.createConnection(dbConfig);
}

async function crearConexionOld() {
  return mysql.createConnection(dbConfigOld);
}

module.exports = {
  crearConexion,
  crearConexionOld
};
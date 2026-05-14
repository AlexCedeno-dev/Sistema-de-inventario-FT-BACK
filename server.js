const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');
const fs = require("fs");
const archiver = require("archiver");
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(cookieParser());

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',

  // Servidor frontend por IP sin puerto
  'http://192.168.179.6:3005',

  // Por si pruebas frontend con Vite desde otra PC
  'http://192.168.179.6:5173',

  // Variable del .env
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Permite peticiones sin origin: curl, Postman, agente NodeGuard, etc.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log('[CORS BLOQUEADO]', origin);
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
}));


const frontendPath = path.join(__dirname, 'dist');

app.use('/inventory-it', express.static(frontendPath));

app.get('/inventory-it', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/inventory-it/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get(/^\/inventory-it\/.*/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use('/', routes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get("/api/nodeguard/agent-pack", (req, res) => {
  try {
    const packDir = path.join(__dirname, "agent-pack");

    if (!fs.existsSync(packDir)) {
      return res.status(404).json({
        error: "No existe la carpeta agent-pack en el servidor.",
      });
    }

    const fileName = "NodeGuardAgentSERVER_Pack.zip";

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    archive.on("error", (err) => {
      console.error("Error generando ZIP:", err);

      if (!res.headersSent) {
        return res.status(500).json({
          error: "Error generando el paquete del agente.",
        });
      }

      res.end();
    });

    archive.pipe(res);

    // Comprime todo lo que esté dentro de agent-pack
    archive.directory(packDir, false);

    archive.finalize();
  } catch (error) {
    console.error("Error en descarga del agente:", error);
    res.status(500).json({
      error: "Error interno al descargar el paquete del agente.",
    });
  }
});

app.get('/', (req, res) => res.send('Servidor activo'));

const PORT = Number(process.env.PORT || 3006);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo en toda la red (puerto ${PORT})`);
});
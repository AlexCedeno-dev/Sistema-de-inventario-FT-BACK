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

app.set('trust proxy', 1);

function getOrigin(value) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(cookieParser());

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://192.168.179.6',
  'http://192.168.179.6:3005',
  'http://192.168.179.6:5173',
  getOrigin(process.env.FRONTEND_URL),
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

app.get(/^\/inventory-it\/assets\/.*/, (req, res) => {
  res.status(404).send('Asset no encontrado. Revisa que dist/assets este actualizado.');
});

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
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Servidor activo en ${HOST}:${PORT}`);
});

app.get('/api/debug-token', (req, res) => {
  res.json({
    cookies: req.cookies,
    token: req.cookies?.nodeguard_session || null,
    authorization: req.headers.authorization || null
  });
});

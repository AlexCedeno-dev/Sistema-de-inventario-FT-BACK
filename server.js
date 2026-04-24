const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: '*',
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

app.get('/', (req, res) => res.send('Servidor activo'));

const PORT = Number(process.env.PORT || 3006);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo en toda la red (puerto ${PORT})`);
});
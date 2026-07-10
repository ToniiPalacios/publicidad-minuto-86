const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const multer = require('multer');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3010;

const DATA_FILE = path.join(__dirname, 'publicidades.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, 'logo-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imagenes'));
  }
});

function leerPublicidades() {
  try {
    const datos = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return datos.map(pub => ({ activa: true, ...pub }));
  } catch (e) {
    return [];
  }
}

function guardarPublicidades(publicidades) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(publicidades, null, 2));
  io.emit('publicidadesActualizadas', publicidades);
}

function prepararPublicidad(req, existente = {}) {
  return {
    ...existente,
    nombre: req.body.nombre || 'Sin nombre',
    rubro: req.body.rubro || '',
    telefono: req.body.telefono || '',
    direccion: req.body.direccion || '',
    descripcion: req.body.descripcion || '',
    duracion: Number(req.body.duracion) || 10,
    activa: req.body.activa === 'false' ? false : true,
    logo: req.file ? '/uploads/' + req.file.filename : (existente.logo || '')
  };
}

app.get('/', (req, res) => res.redirect('/overlay.html'));
app.get('/api/publicidades', (req, res) => res.json(leerPublicidades()));

app.post('/api/publicidades', upload.single('logo'), (req, res) => {
  const publicidades = leerPublicidades();
  const nueva = prepararPublicidad(req, { id: Date.now(), activa: true });
  publicidades.push(nueva);
  guardarPublicidades(publicidades);
  res.json({ ok: true, publicidad: nueva });
});

app.put('/api/publicidades/:id', upload.single('logo'), (req, res) => {
  const id = Number(req.params.id);
  const publicidades = leerPublicidades();
  const idx = publicidades.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'No encontrada' });
  publicidades[idx] = prepararPublicidad(req, publicidades[idx]);
  guardarPublicidades(publicidades);
  res.json({ ok: true, publicidad: publicidades[idx] });
});

app.patch('/api/publicidades/:id/activa', (req, res) => {
  const id = Number(req.params.id);
  const publicidades = leerPublicidades();
  const pub = publicidades.find(p => p.id === id);
  if (!pub) return res.status(404).json({ ok: false, error: 'No encontrada' });
  pub.activa = !pub.activa;
  guardarPublicidades(publicidades);
  res.json({ ok: true, publicidad: pub });
});

app.delete('/api/publicidades/:id', (req, res) => {
  const id = Number(req.params.id);
  const publicidades = leerPublicidades().filter(p => p.id !== id);
  guardarPublicidades(publicidades);
  res.json({ ok: true });
});

io.on('connection', socket => {
  socket.emit('publicidadesActualizadas', leerPublicidades());
  socket.on('mostrarBanner', () => io.emit('mostrarBanner'));
  socket.on('ocultarBanner', () => io.emit('ocultarBanner'));
  socket.on('siguientePublicidad', () => io.emit('siguientePublicidad'));
  socket.on('anteriorPublicidad', () => io.emit('anteriorPublicidad'));
  socket.on('pausarRotacion', () => io.emit('pausarRotacion'));
  socket.on('reanudarRotacion', () => io.emit('reanudarRotacion'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Publicidad Minuto 86 activo en puerto ' + PORT);
  console.log('Panel Admin: http://localhost:' + PORT + '/admin.html');
  console.log('Overlay OBS: http://localhost:' + PORT + '/overlay.html');
});

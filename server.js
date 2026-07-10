require('dotenv').config();

const express = require('express');
const path = require('path');
const http = require('http');
const multer = require('multer');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3010;
const PUBLIC_DIR = path.join(__dirname, 'public');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'logos-publicidad';

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    'Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en las variables de entorno.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes.'));
    }
  }
});

function normalizarPublicidad(row) {
  return {
    id: Number(row.id),
    nombre: row.nombre || 'Sin nombre',
    rubro: row.rubro || '',
    telefono: row.telefono || '',
    direccion: row.direccion || '',
    descripcion: row.descripcion || '',
    duracion: Number(row.tiempo) || 10,
    activa: row.visible !== false,
    logo: row.logo || ''
  };
}

async function leerPublicidades() {
  const { data, error } = await supabase
    .from('publicidades')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(normalizarPublicidad);
}

function prepararDatos(req) {
  return {
    nombre: (req.body.nombre || 'Sin nombre').trim(),
    rubro: (req.body.rubro || '').trim(),
    telefono: (req.body.telefono || '').trim(),
    direccion: (req.body.direccion || '').trim(),
    descripcion: (req.body.descripcion || '').trim(),
    tiempo: Math.max(1, Number(req.body.duracion) || 10),
    visible: req.body.activa !== 'false'
  };
}

function extensionDesdeArchivo(file) {
  const extensionNombre = path.extname(file.originalname || '').toLowerCase();

  if (
    extensionNombre &&
    /^\.(png|jpe?g|webp|gif|avif)$/i.test(extensionNombre)
  ) {
    return extensionNombre;
  }

  const extensiones = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif'
  };

  return extensiones[file.mimetype] || '.img';
}

async function subirLogo(file) {
  if (!file) {
    return '';
  }

  const extension = extensionDesdeArchivo(file);
  const nombreArchivo =
    `logo-${Date.now()}-${crypto.randomUUID()}${extension}`;

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(nombreArchivo, file.buffer, {
      contentType: file.mimetype,
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(nombreArchivo);

  return data.publicUrl;
}

function obtenerNombreLogo(url) {
  if (!url) {
    return null;
  }

  const marca = `/storage/v1/object/public/${SUPABASE_BUCKET}/`;
  const posicion = url.indexOf(marca);

  if (posicion === -1) {
    return null;
  }

  return decodeURIComponent(url.slice(posicion + marca.length));
}

async function borrarLogo(url) {
  const nombre = obtenerNombreLogo(url);

  if (!nombre) {
    return;
  }

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .remove([nombre]);

  if (error) {
    console.warn('No se pudo borrar el logo anterior:', error.message);
  }
}

async function emitirPublicidades() {
  const publicidades = await leerPublicidades();
  io.emit('publicidadesActualizadas', publicidades);
  return publicidades;
}

app.get('/', (req, res) => {
  res.redirect('/overlay.html');
});

app.get('/health', async (req, res) => {
  try {
    const { error } = await supabase
      .from('publicidades')
      .select('id')
      .limit(1);

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      servicio: 'Publicidad Minuto 86',
      supabase: 'conectado'
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      servicio: 'Publicidad Minuto 86',
      supabase: 'error',
      detalle: error.message
    });
  }
});

app.get('/api/publicidades', async (req, res) => {
  try {
    const publicidades = await leerPublicidades();
    res.json(publicidades);
  } catch (error) {
    console.error('Error al leer publicidades:', error);
    res.status(500).json({
      ok: false,
      error: 'No se pudieron cargar las publicidades.'
    });
  }
});

app.post(
  '/api/publicidades',
  upload.single('logo'),
  async (req, res) => {
    try {
      const datos = prepararDatos(req);

      if (req.file) {
        datos.logo = await subirLogo(req.file);
      }

      const { data, error } = await supabase
        .from('publicidades')
        .insert(datos)
        .select()
        .single();

      if (error) {
        throw error;
      }

      await emitirPublicidades();

      res.json({
        ok: true,
        publicidad: normalizarPublicidad(data)
      });
    } catch (error) {
      console.error('Error al crear publicidad:', error);
      res.status(500).json({
        ok: false,
        error: error.message || 'No se pudo guardar la publicidad.'
      });
    }
  }
);

app.put(
  '/api/publicidades/:id',
  upload.single('logo'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id)) {
        return res.status(400).json({
          ok: false,
          error: 'ID inválido.'
        });
      }

      const { data: existente, error: errorExistente } = await supabase
        .from('publicidades')
        .select('*')
        .eq('id', id)
        .single();

      if (errorExistente || !existente) {
        return res.status(404).json({
          ok: false,
          error: 'Publicidad no encontrada.'
        });
      }

      const datos = prepararDatos(req);
      let logoAnterior = null;

      if (req.file) {
        datos.logo = await subirLogo(req.file);
        logoAnterior = existente.logo;
      }

      const { data, error } = await supabase
        .from('publicidades')
        .update(datos)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (logoAnterior) {
        await borrarLogo(logoAnterior);
      }

      await emitirPublicidades();

      res.json({
        ok: true,
        publicidad: normalizarPublicidad(data)
      });
    } catch (error) {
      console.error('Error al editar publicidad:', error);
      res.status(500).json({
        ok: false,
        error: error.message || 'No se pudo editar la publicidad.'
      });
    }
  }
);

app.patch('/api/publicidades/:id/activa', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        ok: false,
        error: 'ID inválido.'
      });
    }

    const { data: existente, error: errorExistente } = await supabase
      .from('publicidades')
      .select('visible')
      .eq('id', id)
      .single();

    if (errorExistente || !existente) {
      return res.status(404).json({
        ok: false,
        error: 'Publicidad no encontrada.'
      });
    }

    const { data, error } = await supabase
      .from('publicidades')
      .update({
        visible: !existente.visible
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    await emitirPublicidades();

    res.json({
      ok: true,
      publicidad: normalizarPublicidad(data)
    });
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    res.status(500).json({
      ok: false,
      error: 'No se pudo cambiar el estado.'
    });
  }
});

app.delete('/api/publicidades/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        ok: false,
        error: 'ID inválido.'
      });
    }

    const { data: existente, error: errorExistente } = await supabase
      .from('publicidades')
      .select('logo')
      .eq('id', id)
      .single();

    if (errorExistente || !existente) {
      return res.status(404).json({
        ok: false,
        error: 'Publicidad no encontrada.'
      });
    }

    const { error } = await supabase
      .from('publicidades')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    if (existente.logo) {
      await borrarLogo(existente.logo);
    }

    await emitirPublicidades();

    res.json({
      ok: true
    });
  } catch (error) {
    console.error('Error al eliminar publicidad:', error);
    res.status(500).json({
      ok: false,
      error: 'No se pudo eliminar la publicidad.'
    });
  }
});

io.on('connection', async socket => {
  try {
    socket.emit(
      'publicidadesActualizadas',
      await leerPublicidades()
    );
  } catch (error) {
    console.error('Error al sincronizar al conectar:', error);
  }

  socket.on('mostrarBanner', () => {
    io.emit('mostrarBanner');
  });

  socket.on('ocultarBanner', () => {
    io.emit('ocultarBanner');
  });

  socket.on('siguientePublicidad', () => {
    io.emit('siguientePublicidad');
  });

  socket.on('anteriorPublicidad', () => {
    io.emit('anteriorPublicidad');
  });

  socket.on('pausarRotacion', () => {
    io.emit('pausarRotacion');
  });

  socket.on('reanudarRotacion', () => {
    io.emit('reanudarRotacion');
  });
});

app.use((error, req, res, next) => {
  if (
    error instanceof multer.MulterError &&
    error.code === 'LIMIT_FILE_SIZE'
  ) {
    return res.status(400).json({
      ok: false,
      error: 'El logo supera el máximo de 5 MB.'
    });
  }

  if (error) {
    console.error(error);

    return res.status(400).json({
      ok: false,
      error: error.message || 'Error al procesar la solicitud.'
    });
  }

  next();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    'Publicidad Minuto 86 activo en puerto ' + PORT
  );
  console.log(
    'Panel Admin: http://localhost:' + PORT + '/admin.html'
  );
  console.log(
    'Overlay OBS: http://localhost:' + PORT + '/overlay.html'
  );
  console.log(
    'Datos: Supabase | Logos: ' + SUPABASE_BUCKET
  );
});
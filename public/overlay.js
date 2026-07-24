const socket = io();
let publicidades = [];
let indice = 0;
let timer = null;
let pausado = false;

function obtenerNombre(pub = {}) {
  const valor = pub.nombre ?? pub.nombre_comercio ?? pub.comercio ?? pub.titulo ?? pub.title;
  const nombre = valor === null || valor === undefined ? '' : String(valor).trim();
  return nombre || 'SIN NOMBRE';
}

function publicidadesActivas(lista) {
  return lista.filter(pub => pub.activa !== false);
}

function ajustarTexto(nombre, descripcion) {
  const titulo = document.getElementById('titulo');
  const detalle = document.getElementById('descripcion');

  titulo.classList.remove('nombre-medio', 'nombre-largo');
  detalle.classList.remove('descripcion-larga');

  if (nombre.length > 30) titulo.classList.add('nombre-largo');
  else if (nombre.length > 22) titulo.classList.add('nombre-medio');

  if (descripcion.length > 76) detalle.classList.add('descripcion-larga');
}

function mostrarNombre(nombre) {
  const titulo = document.getElementById('titulo');
  if (titulo) titulo.textContent = nombre || 'SIN NOMBRE';
}

function actualizarContacto(idCard, idDato, valor) {
  const card = document.getElementById(idCard);
  const dato = document.getElementById(idDato);
  const texto = valor === null || valor === undefined ? '' : String(valor).trim();

  dato.textContent = texto;
  card.classList.toggle('sin-dato', !texto);
}

async function cargarPublicidades() {
  try {
    const res = await fetch('/api/publicidades', { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudieron cargar las publicidades');
    const todas = await res.json();
    publicidades = publicidadesActivas(Array.isArray(todas) ? todas : []);
    if (!publicidades.length) return mostrarVacio();
    if (indice >= publicidades.length) indice = 0;
    mostrarActual();
    iniciarRotacion();
  } catch (error) {
    console.error(error);
    mostrarError();
  }
}

function mostrarError() {
  if (timer) clearTimeout(timer);
  const nombre = 'PUBLICIDAD MINUTO 86';
  const descripcion = 'No se pudieron actualizar las publicidades';
  mostrarNombre(nombre);
  document.getElementById('rubro').textContent = 'SIN CONEXIÓN';
  document.getElementById('descripcion').textContent = descripcion;
  ajustarTexto(nombre, descripcion);
  actualizarContacto('telefonoCard', 'telefono', '');
  actualizarContacto('direccionCard', 'direccion', '');
  document.getElementById('logoBox').textContent = 'LOGO';
}

function mostrarVacio() {
  if (timer) clearTimeout(timer);
  const nombre = 'PUBLICIDAD MINUTO 86';
  const descripcion = 'No hay publicidades activas';
  mostrarNombre(nombre);
  document.getElementById('rubro').textContent = 'ESPACIO PUBLICITARIO';
  document.getElementById('descripcion').textContent = descripcion;
  ajustarTexto(nombre, descripcion);
  actualizarContacto('telefonoCard', 'telefono', '');
  actualizarContacto('direccionCard', 'direccion', '');
  document.getElementById('logoBox').textContent = 'LOGO';
}

function mostrarActual() {
  if (!publicidades.length) return mostrarVacio();
  const pub = publicidades[indice];
  const banner = document.getElementById('banner');
  const nombre = obtenerNombre(pub);
  const descripcion = pub.descripcion ? String(pub.descripcion).trim() : '';

  banner.classList.remove('cambio');
  void banner.offsetWidth;
  banner.classList.add('cambio');

  mostrarNombre(nombre);
  document.getElementById('rubro').textContent = pub.rubro || 'PUBLICIDAD';
  document.getElementById('descripcion').textContent = descripcion;
  actualizarContacto('telefonoCard', 'telefono', pub.telefono);
  actualizarContacto('direccionCard', 'direccion', pub.direccion);
  ajustarTexto(nombre, descripcion);

  const logoBox = document.getElementById('logoBox');
  if (pub.logo) {
    const img = document.createElement('img');
    img.src = `${pub.logo}${pub.logo.includes('?') ? '&' : '?'}v=${Date.now()}`;
    img.alt = `Logo de ${nombre}`;
    img.onerror = () => { logoBox.textContent = 'LOGO'; };
    logoBox.replaceChildren(img);
  } else {
    logoBox.textContent = 'LOGO';
  }
}

function iniciarRotacion() {
  if (timer) clearTimeout(timer);
  if (pausado || !publicidades.length) return;
  const duracion = (Number(publicidades[indice].duracion) || 10) * 1000;
  timer = setTimeout(siguiente, duracion);
}

function siguiente() {
  if (!publicidades.length) return;
  indice = (indice + 1) % publicidades.length;
  mostrarActual();
  iniciarRotacion();
}

function anterior() {
  if (!publicidades.length) return;
  indice = (indice - 1 + publicidades.length) % publicidades.length;
  mostrarActual();
  iniciarRotacion();
}

socket.on('publicidadesActualizadas', pubs => {
  publicidades = publicidadesActivas(Array.isArray(pubs) ? pubs : []);
  if (!publicidades.length) return mostrarVacio();
  if (indice >= publicidades.length) indice = 0;
  mostrarActual();
  iniciarRotacion();
});

socket.on('mostrarBanner', () => document.getElementById('banner').classList.remove('oculto'));
socket.on('ocultarBanner', () => document.getElementById('banner').classList.add('oculto'));
socket.on('siguientePublicidad', siguiente);
socket.on('anteriorPublicidad', anterior);
socket.on('pausarRotacion', () => { pausado = true; if (timer) clearTimeout(timer); });
socket.on('reanudarRotacion', () => { pausado = false; iniciarRotacion(); });

cargarPublicidades();

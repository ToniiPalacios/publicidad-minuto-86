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

let ultimoNombreMostrado = 'PUBLICIDAD MINUTO 86';

function dibujarNombreMovil(texto) {
  const canvas = document.getElementById('tituloMovilCanvas');
  if (!canvas) return;

  const contenedor = canvas.parentElement;
  const anchoCss = Math.max(260, Math.round(contenedor.getBoundingClientRect().width || window.innerWidth - 48));
  const altoCss = 92;
  const escala = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(anchoCss * escala);
  canvas.height = Math.round(altoCss * escala);
  canvas.style.width = anchoCss + 'px';
  canvas.style.height = altoCss + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.clearRect(0, 0, anchoCss, altoCss);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const limpio = String(texto || 'SIN NOMBRE').trim().toUpperCase();
  let tamano = 36;
  const anchoMaximo = anchoCss - 16;
  do {
    ctx.font = `900 ${tamano}px Arial, sans-serif`;
    if (ctx.measureText(limpio).width <= anchoMaximo) break;
    tamano -= 1;
  } while (tamano > 18);

  ctx.shadowColor = 'rgba(0,0,0,.65)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText(limpio, anchoCss / 2, altoCss / 2);
}

function mostrarNombre(nombre) {
  const texto = nombre || 'SIN NOMBRE';
  ultimoNombreMostrado = texto;
  const titulo = document.getElementById('titulo');
  if (titulo) titulo.textContent = texto;
  dibujarNombreMovil(texto);
}

window.addEventListener('resize', () => dibujarNombreMovil(ultimoNombreMostrado));
window.addEventListener('orientationchange', () => {
  setTimeout(() => dibujarNombreMovil(ultimoNombreMostrado), 150);
});

function publicidadesActivas(lista) {
  return lista.filter(pub => pub.activa !== false);
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
  mostrarNombre('PUBLICIDAD MINUTO 86');
  document.getElementById('rubro').textContent = 'SIN CONEXIÓN';
  document.getElementById('descripcion').textContent = 'No se pudieron actualizar las publicidades';
  document.getElementById('telefono').textContent = '';
  document.getElementById('direccion').textContent = '';
  document.getElementById('logoBox').textContent = 'LOGO';
}

function mostrarVacio() {
  if (timer) clearTimeout(timer);
  mostrarNombre('PUBLICIDAD MINUTO 86');
  document.getElementById('rubro').textContent = 'ESPACIO PUBLICITARIO';
  document.getElementById('descripcion').textContent = 'No hay publicidades activas';
  document.getElementById('telefono').textContent = '';
  document.getElementById('direccion').textContent = '';
  document.getElementById('logoBox').textContent = 'LOGO';
}

function mostrarActual() {
  if (!publicidades.length) return mostrarVacio();
  const pub = publicidades[indice];
  const banner = document.getElementById('banner');

  banner.classList.remove('cambio');
  void banner.offsetWidth;
  banner.classList.add('cambio');

  mostrarNombre(obtenerNombre(pub));
  document.getElementById('rubro').textContent = pub.rubro || 'PUBLICIDAD';
  document.getElementById('descripcion').textContent = pub.descripcion || '';
  document.getElementById('telefono').textContent = pub.telefono ? 'TEL: ' + pub.telefono : '';
  document.getElementById('direccion').textContent = pub.direccion ? 'DIR: ' + pub.direccion : '';

  const logoBox = document.getElementById('logoBox');
  logoBox.innerHTML = pub.logo ? `<img src="${pub.logo}?v=${Date.now()}" alt="Logo">` : 'LOGO';
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

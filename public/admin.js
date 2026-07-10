const socket = io();
let publicidadesActuales = [];
const logoInput = document.getElementById('logo');

socket.on('connect', () => {
  document.getElementById('estadoConexion').textContent = 'Conectado';
});

socket.on('disconnect', () => {
  document.getElementById('estadoConexion').textContent = 'Desconectado';
});

logoInput.addEventListener('change', () => {
  const file = logoInput.files[0];
  const preview = document.getElementById('previewLogo');
  if (!file) {
    preview.textContent = 'SIN LOGO';
    return;
  }
  preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="preview">`;
});

async function cargarPublicidades() {
  const res = await fetch('/api/publicidades');
  publicidadesActuales = await res.json();
  dibujarLista();
}

function dibujarLista() {
  const lista = document.getElementById('lista');
  lista.innerHTML = '';

  if (publicidadesActuales.length === 0) {
    lista.innerHTML = '<p>No hay publicidades cargadas todavía.</p>';
    return;
  }

  publicidadesActuales.forEach(pub => {
    const activa = pub.activa !== false;
    const div = document.createElement('div');
    div.className = 'item ' + (activa ? '' : 'inactiva');
    div.innerHTML = `
      <div class="item-logo">${pub.logo ? `<img src="${pub.logo}?v=${Date.now()}" alt="logo">` : 'LOGO'}</div>
      <div class="item-info">
        <strong>${pub.nombre}</strong>
        <span class="badge ${activa ? 'ok' : 'off'}">${activa ? 'ACTIVA' : 'INACTIVA'}</span><br>
        <span class="muted">Rubro: ${pub.rubro || '-'}</span><br>
        <span class="muted">Tel: ${pub.telefono || '-'}</span><br>
        <span class="muted">Dirección: ${pub.direccion || '-'}</span><br>
        ${pub.descripcion || ''}<br>
        <b>Duración:</b> ${pub.duracion || 10} segundos
      </div>
      <div>
        <button onclick="editarPublicidad(${pub.id})">Editar</button>
        <button class="${activa ? 'btn-inactiva' : 'btn-activa'}" onclick="cambiarEstado(${pub.id})">${activa ? 'Desactivar' : 'Activar'}</button>
        <button class="btn-eliminar" onclick="eliminarPublicidad(${pub.id})">Eliminar</button>
      </div>
    `;
    lista.appendChild(div);
  });
}

async function guardarPublicidad() {
  const id = document.getElementById('editId').value;
  const formData = new FormData();

  formData.append('nombre', document.getElementById('nombre').value);
  formData.append('rubro', document.getElementById('rubro').value);
  formData.append('telefono', document.getElementById('telefono').value);
  formData.append('direccion', document.getElementById('direccion').value);
  formData.append('descripcion', document.getElementById('descripcion').value);
  formData.append('duracion', document.getElementById('duracion').value || '10');
  formData.append('activa', document.getElementById('activa').value);

  const file = logoInput.files[0];
  if (file) formData.append('logo', file);

  const url = id ? '/api/publicidades/' + id : '/api/publicidades';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, { method, body: formData });

  if (!res.ok) {
    alert('Error al guardar publicidad');
    return;
  }

  limpiarFormulario();
  await cargarPublicidades();
}

function editarPublicidad(id) {
  const pub = publicidadesActuales.find(p => p.id === id);
  if (!pub) return;

  document.getElementById('formTitulo').textContent = 'Editar publicidad';
  document.getElementById('editId').value = pub.id;
  document.getElementById('nombre').value = pub.nombre || '';
  document.getElementById('rubro').value = pub.rubro || '';
  document.getElementById('telefono').value = pub.telefono || '';
  document.getElementById('direccion').value = pub.direccion || '';
  document.getElementById('descripcion').value = pub.descripcion || '';
  document.getElementById('duracion').value = pub.duracion || 10;
  document.getElementById('activa').value = pub.activa === false ? 'false' : 'true';
  logoInput.value = '';
  document.getElementById('previewLogo').innerHTML = pub.logo ? `<img src="${pub.logo}?v=${Date.now()}" alt="logo">` : 'SIN LOGO';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limpiarFormulario() {
  document.getElementById('formTitulo').textContent = 'Agregar publicidad';
  document.getElementById('editId').value = '';
  document.getElementById('nombre').value = '';
  document.getElementById('rubro').value = '';
  document.getElementById('telefono').value = '';
  document.getElementById('direccion').value = '';
  document.getElementById('descripcion').value = '';
  document.getElementById('duracion').value = '10';
  document.getElementById('activa').value = 'true';
  logoInput.value = '';
  document.getElementById('previewLogo').textContent = 'SIN LOGO';
}

async function cambiarEstado(id) {
  await fetch('/api/publicidades/' + id + '/activa', { method: 'PATCH' });
  await cargarPublicidades();
}

async function eliminarPublicidad(id) {
  if (!confirm('¿Eliminar esta publicidad?')) return;
  await fetch('/api/publicidades/' + id, { method: 'DELETE' });
  await cargarPublicidades();
}

function mostrarBanner(){ socket.emit('mostrarBanner'); }
function ocultarBanner(){ socket.emit('ocultarBanner'); }
function siguientePublicidad(){ socket.emit('siguientePublicidad'); }
function anteriorPublicidad(){ socket.emit('anteriorPublicidad'); }
function pausarRotacion(){ socket.emit('pausarRotacion'); }
function reanudarRotacion(){ socket.emit('reanudarRotacion'); }

socket.on('publicidadesActualizadas', pubs => {
  publicidadesActuales = pubs;
  dibujarLista();
});

cargarPublicidades();

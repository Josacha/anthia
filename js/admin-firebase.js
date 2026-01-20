import { db } from './firebase.js';
import { collection, getDocs, query, orderBy, addDoc, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ====== FUNCIONES GENERALES ======
async function eliminarDocumento(collectionName, id) {
  if (confirm("¿Seguro que deseas eliminar este registro?")) {
    await deleteDoc(doc(db, collectionName, id));
    cargarTodas();
  }
}

async function editarDocumento(collectionName, id, campo, valor) {
  const nuevoValor = prompt(`Editar ${campo}:`, valor);
  if (nuevoValor !== null) {
    await updateDoc(doc(db, collectionName, id), { [campo]: nuevoValor });
    cargarTodas();
  }
}

// ====== AGENDA ======
export async function cargarAgenda() {
  const tabla = document.getElementById('tablaAgenda');
  if (!tabla) return;
  tabla.innerHTML = '';
  const q = query(collection(db, 'citas'), orderBy('fecha'));
  const snapshot = await getDocs(q);
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.nombre} ${data.apellido1}</td>
      <td>${data.servicio}</td>
      <td>${data.fecha}</td>
      <td>${data.hora}</td>
      <td>${data.estado || 'Pendiente'}</td>
      <td>
        <button onclick="editarDocumento('citas','${docSnap.id}','estado','${data.estado || 'Pendiente'}')" class="btn-secondary">Editar</button>
        <button onclick="eliminarDocumento('citas','${docSnap.id}')" class="btn-secondary">Eliminar</button>
      </td>
    `;
    tabla.appendChild(tr);
  });
}

// ====== CONTACTOS ======
export async function cargarContactos() {
  const tabla = document.getElementById('tablaContactos');
  if (!tabla) return;
  tabla.innerHTML = '';
  const q = query(collection(db, 'clientes'), orderBy('nombre'));
  const snapshot = await getDocs(q);
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.nombre} ${data.apellido1}</td>
      <td>${data.correo}</td>
      <td>${data.telefono}</td>
      <td>${(data.historial || []).join(', ')}</td>
      <td>
        <button onclick="editarDocumento('clientes','${docSnap.id}','telefono','${data.telefono}')" class="btn-secondary">Editar</button>
        <button onclick="eliminarDocumento('clientes','${docSnap.id}')" class="btn-secondary">Eliminar</button>
      </td>
    `;
    tabla.appendChild(tr);
  });
}

// ====== SERVICIOS ======
export async function cargarServicios() {
  const tabla = document.getElementById('tablaServicios');
  if (!tabla) return;
  tabla.innerHTML = '';
  const q = query(collection(db, 'servicios'), orderBy('nombre'));
  const snapshot = await getDocs(q);
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.nombre}</td>
      <td>${data.duracion} min</td>
      <td>$${data.precio}</td>
      <td>${data.simultaneo ? 'Sí' : 'No'}</td>
      <td>
        <button onclick="editarDocumento('servicios','${docSnap.id}','precio','${data.precio}')" class="btn-secondary">Editar</button>
        <button onclick="eliminarDocumento('servicios','${docSnap.id}')" class="btn-secondary">Eliminar</button>
      </td>
    `;
    tabla.appendChild(tr);
  });

  // Formulario nuevo servicio
  const formNuevoServicio = document.getElementById('formNuevoServicio');
  if (formNuevoServicio) {
    formNuevoServicio.addEventListener('submit', async e => {
      e.preventDefault();
      const nombre = document.getElementById('nuevoServicioNombre').value.trim();
      const duracion = parseInt(document.getElementById('nuevoServicioDuracion').value);
      const precio = parseFloat(document.getElementById('nuevoServicioPrecio').value);
      const simultaneo = document.getElementById('nuevoServicioSimultaneo').checked;
      await addDoc(collection(db, 'servicios'), { nombre, duracion, precio, simultaneo });
      formNuevoServicio.reset();
      cargarServicios();
    });
  }
}

// ====== INVENTARIO ======
export async function cargarInventario() {
  const tabla = document.getElementById('tablaInventario');
  if (!tabla) return;
  tabla.innerHTML = '';
  const q = query(collection(db, 'inventario'), orderBy('nombre'));
  const snapshot = await getDocs(q);
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.nombre}</td>
      <td>${data.cantidad}</td>
      <td>${data.alerta ? 'Sí' : 'No'}</td>
      <td>
        <button onclick="editarDocumento('inventario','${docSnap.id}','cantidad','${data.cantidad}')" class="btn-secondary">Editar</button>
        <button onclick="eliminarDocumento('inventario','${docSnap.id}')" class="btn-secondary">Eliminar</button>
      </td>
    `;
    tabla.appendChild(tr);
  });
}

// ====== NUEVO CLIENTE ======
const formNuevoCliente = document.getElementById('formNuevoCliente');
if (formNuevoCliente) {
  formNuevoCliente.addEventListener('submit', async e => {
    e.preventDefault();
    const nombre = document.getElementById('nuevoClienteNombre').value.trim();
    const apellido1 = document.getElementById('nuevoClienteApellido1').value.trim();
    const apellido2 = document.getElementById('nuevoClienteApellido2').value.trim();
    const correo = document.getElementById('nuevoClienteCorreo').value.trim();
    const telefono = document.getElementById('nuevoClienteTelefono').value.trim();
    await addDoc(collection(db, 'clientes'), { nombre, apellido1, apellido2, correo, telefono, historial: [] });
    formNuevoCliente.reset();
    cargarContactos();
  });
}

// ====== CARGAR TODO ======
function cargarTodas() {
  cargarAgenda();
  cargarContactos();
  cargarServicios();
  cargarInventario();
}

document.addEventListener('DOMContentLoaded', cargarTodas);

// Exponer globales para los onclick de editar/eliminar
window.eliminarDocumento = eliminarDocumento;
window.editarDocumento = editarDocumento;

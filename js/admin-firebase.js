// admin-firebase.js
import { db } from './firebase.js';
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ======== Funciones de borrado y edición ========
async function eliminarDocumento(collectionName, id) {
  if (confirm("¿Seguro que deseas eliminar este registro?")) {
    await deleteDoc(doc(db, collectionName, id));
    cargarTodas();
  }
}

async function editarDocumento(collectionName, id, campo, valor) {
  const nuevoValor = prompt(`Editar ${campo}:`, valor);
  if (nuevoValor !== null) {
    const ref = doc(db, collectionName, id);
    await updateDoc(ref, { [campo]: nuevoValor });
    cargarTodas();
  }
}

// ======== Agenda ========
export async function cargarAgenda() {
  const tabla = document.getElementById('tablaAgenda');
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

// ======== Contactos ========
export async function cargarContactos() {
  const tabla = document.getElementById('tablaContactos');
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

// ======== Servicios ========
export async function cargarServicios() {
  const tabla = document.getElementById('tablaServicios');
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
}

// ======== Inventario ========
export async function cargarInventario() {
  const tabla = document.getElementById('tablaInventario');
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

// ======== Cargar todo ========
function cargarTodas() {
  cargarAgenda();
  cargarContactos();
  cargarServicios();
  cargarInventario();
}

document.addEventListener('DOMContentLoaded', cargarTodas);

// Exponer funciones globales para onclick
window.eliminarDocumento = eliminarDocumento;
window.editarDocumento = editarDocumento;

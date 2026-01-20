// admin-firebase.js
import { db } from './firebase.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// === Agenda ===
export async function cargarAgenda() {
  const tabla = document.getElementById('tablaAgenda');
  tabla.innerHTML = '';
  const q = query(collection(db, 'citas'), orderBy('fecha'));
  const snapshot = await getDocs(q);
  snapshot.forEach(doc => {
    const data = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.nombre} ${data.apellido1}</td>
      <td>${data.servicio}</td>
      <td>${data.fecha}</td>
      <td>${data.hora}</td>
      <td>${data.estado || 'Pendiente'}</td>
    `;
    tabla.appendChild(tr);
  });
}

// === Contactos ===
export async function cargarContactos() {
  const tabla = document.getElementById('tablaContactos');
  tabla.innerHTML = '';
  const q = query(collection(db, 'clientes'), orderBy('nombre'));
  const snapshot = await getDocs(q);
  snapshot.forEach(doc => {
    const data = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.nombre} ${data.apellido1}</td>
      <td>${data.correo}</td>
      <td>${data.telefono}</td>
      <td>${(data.historial || []).join(', ')}</td>
    `;
    tabla.appendChild(tr);
  });
}

// === Servicios ===
export async function cargarServicios() {
  const tabla = document.getElementById('tablaServicios');
  tabla.innerHTML = '';
  const q = query(collection(db, 'servicios'), orderBy('nombre'));
  const snapshot = await getDocs(q);
  snapshot.forEach(doc => {
    const data = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.nombre}</td>
      <td>${data.duracion} min</td>
      <td>$${data.precio}</td>
      <td>${data.simultaneo ? 'Sí' : 'No'}</td>
    `;
    tabla.appendChild(tr);
  });
}

// === Inventario ===
export async function cargarInventario() {
  const tabla = document.getElementById('tablaInventario');
  tabla.innerHTML = '';
  const q = query(collection(db, 'inventario'), orderBy('nombre'));
  const snapshot = await getDocs(q);
  snapshot.forEach(doc => {
    const data = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.nombre}</td>
      <td>${data.cantidad}</td>
      <td>${data.alerta ? 'Sí' : 'No'}</td>
    `;
    tabla.appendChild(tr);
  });
}

// === Inicialización ===
document.addEventListener('DOMContentLoaded', () => {
  cargarAgenda();
  cargarContactos();
  cargarServicios();
  cargarInventario();
});


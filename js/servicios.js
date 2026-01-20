import { db } from './firebase.js';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tablaServicios = document.getElementById('tablaServicios').getElementsByTagName('tbody')[0];

// Referencia a la colección
const serviciosRef = collection(db, 'servicios');

// Cargar servicios
export async function cargarServicios() {
  tablaServicios.innerHTML = '';
  const snapshot = await getDocs(serviciosRef);

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${data.nombre}</td>
      <td>${data.duracion} min</td>
      <td>$${data.precio}</td>
      <td>${data.simultaneo ? 'Sí' : 'No'}</td>
      <td>
        <button class="btn-edit" data-id="${docSnap.id}">Editar</button>
        <button class="btn-delete" data-id="${docSnap.id}">Borrar</button>
      </td>
    `;
    tablaServicios.appendChild(tr);
  });

  // Agregar eventos a botones
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => editarServicio(btn.dataset.id));
  });
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => eliminarServicio(btn.dataset.id));
  });
}

// Agregar servicio
export async function agregarServicio(servicio) {
  await addDoc(serviciosRef, servicio);
  cargarServicios();
}

// Editar servicio
export async function editarServicio(id) {
  const docRef = doc(db, 'servicios', id);
  const docSnap = await getDocs(docRef);

  // Mostrar prompt para editar (puedes cambiar por un modal más moderno)
  const nombre = prompt('Nombre del servicio', '');
  const duracion = prompt('Duración (min)', '');
  const precio = prompt('Precio', '');
  const simultaneo = confirm('Permitir citas simultáneas?');

  await updateDoc(docRef, { nombre, duracion: parseInt(duracion), precio: parseFloat(precio), simultaneo });
  cargarServicios();
}

// Borrar servicio
export async function eliminarServicio(id) {
  if (confirm('¿Seguro que desea borrar este servicio?')) {
    await deleteDoc(doc(db, 'servicios', id));
    cargarServicios();
  }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
  cargarServicios();

  // Formulario para agregar nuevo servicio
  const formNuevoServicio = document.createElement('form');
  formNuevoServicio.innerHTML = `
    <input type="text" id="nuevoNombre" placeholder="Nombre del servicio" required>
    <input type="number" id="nuevaDuracion" placeholder="Duración (min)" required>
    <input type="number" id="nuevoPrecio" placeholder="Precio" required>
    <label><input type="checkbox" id="nuevoSimultaneo"> Permitir simultáneo</label>
    <button type="submit" class="btn-primary">Agregar Servicio</button>
  `;
  tablaServicios.parentElement.insertBefore(formNuevoServicio, tablaServicios);

  formNuevoServicio.addEventListener('submit', async (e) => {
    e.preventDefault();
    const servicio = {
      nombre: document.getElementById('nuevoNombre').value,
      duracion: parseInt(document.getElementById('nuevaDuracion').value),
      precio: parseFloat(document.getElementById('nuevoPrecio').value),
      simultaneo: document.getElementById('nuevoSimultaneo').checked
    };
    await agregarServicio(servicio);
    formNuevoServicio.reset();
  });
});


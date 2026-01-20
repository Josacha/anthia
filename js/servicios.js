import { db } from './firebase.js';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tablaServicios = document.querySelector('#tablaServicios tbody');
const formAgregar = document.getElementById('formAgregarServicio');

const serviciosRef = collection(db, 'servicios');

// Cargar servicios en la tabla
export async function cargarServicios() {
  tablaServicios.innerHTML = '';
  const snapshot = await getDocs(serviciosRef);

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${data.nombre}</td>
      <td>${data.duracion} min</td>
      <td>₡${data.precio}</td>
      <td>${data.simultaneo ? 'Sí' : 'No'}</td>
      <td>
        <button class="btn-edit" data-id="${docSnap.id}">Editar</button>
        <button class="btn-delete" data-id="${docSnap.id}">Borrar</button>
      </td>
    `;

    tablaServicios.appendChild(tr);
  });

  // Eventos editar
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => editarServicio(btn.dataset.id));
  });

  // Eventos borrar
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => eliminarServicio(btn.dataset.id));
  });
}

// Agregar servicio desde formulario
formAgregar.addEventListener('submit', async e => {
  e.preventDefault();

  const servicio = {
    nombre: document.getElementById('nuevoNombre').value,
    duracion: parseInt(document.getElementById('nuevaDuracion').value),
    precio: parseFloat(document.getElementById('nuevoPrecio').value),
    simultaneo: document.getElementById('nuevoSimultaneo').checked
  };

  await addDoc(serviciosRef, servicio);

  formAgregar.reset();
  cargarServicios();
});

// Editar servicio
async function editarServicio(id) {
  const docRef = doc(db, 'servicios', id);
  const docSnap = await getDocs(docRef);

  const data = (await doc(db, 'servicios', id).get()).data();

  const nombre = prompt('Nombre del servicio', data.nombre);
  if (!nombre) return;
  const duracion = prompt('Duración (min)', data.duracion);
  if (!duracion) return;
  const precio = prompt('Precio (₡)', data.precio);
  if (!precio) return;
  const simultaneo = confirm('Permitir citas simultáneas?');

  await updateDoc(docRef, {
    nombre,
    duracion: parseInt(duracion),
    precio: parseFloat(precio),
    simultaneo
  });

  cargarServicios();
}

// Eliminar servicio
async function eliminarServicio(id) {
  if (confirm('¿Seguro que desea borrar este servicio?')) {
    await deleteDoc(doc(db, 'servicios', id));
    cargarServicios();
  }
}

// Inicialización al cargar tab
document.addEventListener('DOMContentLoaded', () => {
  cargarServicios();
});

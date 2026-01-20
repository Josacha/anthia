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
const formContainer = document.createElement('div');
formContainer.id = 'form-servicio-container';

// Referencia a la colección
const serviciosRef = collection(db, 'servicios');

// Función para cargar todos los servicios
export async function cargarServicios() {
  tablaServicios.innerHTML = ''; // Limpiar tabla
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

  // Eventos de edición
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => editarServicio(btn.dataset.id));
  });

  // Eventos de borrado
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => eliminarServicio(btn.dataset.id));
  });
}

// Agregar nuevo servicio
async function agregarServicio(servicio) {
  await addDoc(serviciosRef, servicio);
  cargarServicios();
}

// Editar servicio
async function editarServicio(id) {
  const docRef = doc(db, 'servicios', id);
  const docSnap = await getDocs(docRef);

  const data = (await doc(db, 'servicios', id).get()).data(); // Tomamos los datos actuales

  const nombre = prompt('Nombre del servicio', data.nombre);
  if (!nombre) return;
  const duracion = prompt('Duración (min)', data.duracion);
  if (!duracion) return;
  const precio = prompt('Precio', data.precio);
  if (!precio) return;
  const simultaneo = confirm('Permitir citas simultáneas?');

  await updateDoc(docRef, { nombre, duracion: parseInt(duracion), precio: parseFloat(precio), simultaneo });
  cargarServicios();
}

// Eliminar servicio
async function eliminarServicio(id) {
  if (confirm('¿Seguro que desea borrar este servicio?')) {
    await deleteDoc(doc(db, 'servicios', id));
    cargarServicios();
  }
}

// Crear formulario para agregar servicios
function crearFormularioAgregar() {
  formContainer.innerHTML = `
    <h3>Agregar nuevo servicio</h3>
    <form id="formAgregarServicio">
      <input type="text" id="nuevoNombre" placeholder="Nombre del servicio" required>
      <input type="number" id="nuevaDuracion" placeholder="Duración (min)" required>
      <input type="number" id="nuevoPrecio" placeholder="Precio" required>
      <label><input type="checkbox" id="nuevoSimultaneo"> Permitir simultáneo</label>
      <button type="submit" class="btn-primary">Agregar Servicio</button>
    </form>
  `;
  document.querySelector('#tab-servicios').prepend(formContainer);

  const form = document.getElementById('formAgregarServicio');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const servicio = {
      nombre: document.getElementById('nuevoNombre').value,
      duracion: parseInt(document.getElementById('nuevaDuracion').value),
      precio: parseFloat(document.getElementById('nuevoPrecio').value),
      simultaneo: document.getElementById('nuevoSimultaneo').checked
    };
    await agregarServicio(servicio);
    form.reset();
  });
}

// Inicializar todo al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  crearFormularioAgregar();
  cargarServicios();
});

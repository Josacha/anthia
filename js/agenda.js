import { db } from './firebase.js';
import { 
  collection, getDocs, query, where, doc, deleteDoc, setDoc, getDoc, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Elementos del DOM
const fechaInput = document.getElementById('fechaAgenda');
const tablaAgenda = document.getElementById('tablaAgenda').querySelector('tbody');
const btnBloquearDia = document.getElementById('btnBloquearDia');

// ================================
// FUNCIONES AUXILIARES
// ================================

// Obtener nombre de cliente por ID
async function obtenerNombreCliente(clienteId) {
  const docSnap = await getDoc(doc(db, 'clientes', clienteId));
  return docSnap.exists() ? docSnap.data().nombre : clienteId;
}

// Obtener nombre de servicio por ID
async function obtenerNombreServicio(servicioId) {
  const docSnap = await getDoc(doc(db, 'servicios', servicioId));
  return docSnap.exists() ? docSnap.data().nombre : servicioId;
}

// ================================
// CARGAR AGENDA
// ================================
async function cargarAgenda() {
  const fecha = fechaInput.value;
  if (!fecha) return;

  tablaAgenda.innerHTML = '';

  const citasRef = collection(db, 'citas');
  const q = query(citasRef, where('fecha', '==', fecha));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    tablaAgenda.innerHTML = '<tr><td colspan="5">No hay citas para esta fecha</td></tr>';
    return;
  }

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    // Obtener nombres de cliente y servicio
    const clienteNombre = await obtenerNombreCliente(data.clienteId);
    const servicioNombre = await obtenerNombreServicio(data.servicioId);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.hora}</td>
      <td>${clienteNombre}</td>
      <td>${servicioNombre}</td>
      <td>${data.simultaneo ? 'Sí' : 'No'}</td>
      <td>
        <button class="btn-delete" data-id="${docSnap.id}">Cancelar</button>
      </td>
    `;
    tablaAgenda.appendChild(tr);
  }

  // Botones de eliminar citas
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('¿Desea cancelar esta cita?')) {
        await deleteDoc(doc(db, 'citas', btn.dataset.id));
        cargarAgenda(); // recarga la tabla
      }
    });
  });
}

// ================================
// BLOQUEAR DÍA COMPLETO
// ================================
btnBloquearDia.addEventListener('click', async () => {
  const fecha = fechaInput.value;
  if (!fecha) return alert('Seleccione una fecha primero');

  const bloqueosRef = doc(db, 'bloqueos', fecha);
  await setDoc(bloqueosRef, { completo: true, creado: Timestamp.now() });

  alert('Día bloqueado correctamente');
  cargarAgenda(); // Opcional: recarga la agenda para indicar bloqueo
});

// ================================
// EVENTO AL CAMBIAR FECHA
// ================================
fechaInput.addEventListener('change', cargarAgenda);

// ================================
// INICIALIZACIÓN
// ================================
document.addEventListener('DOMContentLoaded', () => {
  const hoy = new Date().toISOString().split('T')[0];
  fechaInput.value = hoy;
  cargarAgenda();
});

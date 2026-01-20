import { db } from './firebase.js';
import { collection, getDocs, query, where, doc, deleteDoc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Elementos del DOM
const fechaInput = document.getElementById('fechaAgenda');
const tablaAgenda = document.getElementById('tablaAgenda').querySelector('tbody');
const btnBloquearDia = document.getElementById('btnBloquearDia');

// ================================
// CARGAR AGENDA
// ================================
async function cargarAgenda() {
  const fecha = fechaInput.value;
  if (!fecha) return;

  tablaAgenda.innerHTML = '';

  // Consultar citas del día seleccionado
  const citasRef = collection(db, 'citas');
  const q = query(citasRef, where('fecha', '==', fecha));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    tablaAgenda.innerHTML = '<tr><td colspan="5">No hay citas para esta fecha</td></tr>';
    return;
  }

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${data.hora}</td>
      <td>${data.clienteId}</td>
      <td>${data.servicioId}</td>
      <td>${data.simultaneo ? 'Sí' : 'No'}</td>
      <td>
        <button class="btn-delete" data-id="${docSnap.id}">Cancelar</button>
      </td>
    `;
    tablaAgenda.appendChild(tr);
  });

  // Evento para eliminar citas
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('¿Desea cancelar esta cita?')) {
        await deleteDoc(doc(db, 'citas', btn.dataset.id));
        cargarAgenda();
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
});

// ================================
// EVENTO AL CAMBIAR FECHA
// ================================
fechaInput.addEventListener('change', cargarAgenda);

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  const hoy = new Date().toISOString().split('T')[0];
  fechaInput.value = hoy;
  cargarAgenda();
});


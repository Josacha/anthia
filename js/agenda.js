import { db } from "./firebase.js";
import { collection, query, where, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tabla = document.getElementById("tablaAgenda").querySelector("tbody");
const fechaInput = document.getElementById("fechaAgenda");

// Horas de atención
const HORAS = [
  "08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00","18:00"
];

// Colores para marcar estado
const COLOR_CITA = "#d1e7dd";       // Verde claro para citas confirmadas
const COLOR_BLOQUEADO = "#f8d7da";  // Rojo claro para bloqueos
const COLOR_LIBRE = "#fff";         // Blanco para libre

// Función para cargar agenda
async function cargarAgenda(fechaSeleccionada) {
  tabla.innerHTML = "";

  // Obtener citas del día
  const citasRef = collection(db, "citas");
  const qCitas = query(citasRef, where("fecha", "==", fechaSeleccionada));
  const snapshotCitas = await getDocs(qCitas);
  const citas = snapshotCitas.docs.map(d => ({ id: d.id, ...d.data() }));

  // Obtener bloqueos del día
  const bloqueosRef = collection(db, "bloqueos");
  const qBloqueos = query(bloqueosRef, where("fecha", "==", fechaSeleccionada));
  const snapshotBloqueos = await getDocs(qBloqueos);
  const bloqueos = snapshotBloqueos.docs.map(d => ({ id: d.id, ...d.data() }));

  HORAS.forEach(hora => {
    const citaHora = citas.find(c => c.hora === hora);
    const bloqueado = bloqueos.find(b => b.hora === hora);

    const fila = document.createElement("tr");

    // Definir color de fondo
    let color = COLOR_LIBRE;
    if (citaHora) color = COLOR_CITA;
    if (bloqueado) color = COLOR_BLOQUEADO;

    fila.style.backgroundColor = color;

    fila.innerHTML = `
      <td>${hora}</td>
      <td>${citaHora ? citaHora.clienteId : "-"}</td>
      <td>${citaHora ? citaHora.servicio : "-"}</td>
      <td>${citaHora ? (citaHora.simultaneo ? "Sí" : "No") : "-"}</td>
      <td>
        ${citaHora ? `<button class="btn-secondary btnEliminar" data-id="${citaHora.id}">Eliminar cita</button>` : ""}
      </td>
    `;

    tabla.appendChild(fila);
  });

  // Botones eliminar
  document.querySelectorAll(".btnEliminar").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (confirm("¿Desea eliminar esta cita?")) {
        await deleteDoc(doc(db, "citas", id));
        cargarAgenda(fechaSeleccionada);
      }
    });
  });
}

// ================================
// Mostrar agenda automáticamente con la fecha de hoy
// ================================
function obtenerFechaHoy() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Inicializar agenda al cargar la página
document.addEventListener("DOMContentLoaded", () => {
  const hoy = obtenerFechaHoy();
  fechaInput.value = hoy;
  cargarAgenda(hoy);
});

// Cambiar fecha manualmente
fechaInput.addEventListener("change", () => {
  if (fechaInput.value) cargarAgenda(fechaInput.value);
});

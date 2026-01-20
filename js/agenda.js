 // js/agenda.js
import { db } from "./firebase.js";
import { collection, query, where, getDocs, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const fechaInput = document.getElementById("fechaAgenda");
const tabla = document.getElementById("tablaAgenda").querySelector("tbody");

// Horas de atención
const HORAS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

// Obtener fecha actual en formato yyyy-mm-dd
function fechaActual() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Función para cargar agenda de un día
async function cargarAgenda(fechaSeleccionada) {
  tabla.innerHTML = "";

  // Obtener citas
  const citasRef = collection(db, "citas");
  const qCitas = query(citasRef, where("fecha", "==", fechaSeleccionada));
  const snapshotCitas = await getDocs(qCitas);
  const citas = snapshotCitas.docs.map(d => ({ id: d.id, ...d.data() }));

  // Obtener bloqueos
  const bloqueosRef = collection(db, "bloqueos");
  const qBloqueos = query(bloqueosRef, where("fecha", "==", fechaSeleccionada));
  const snapshotBloqueos = await getDocs(qBloqueos);
  const bloqueos = snapshotBloqueos.docs.map(d => ({ id: d.id, ...d.data() }));

  HORAS.forEach(hora => {
    const citaHora = citas.find(c => c.hora === hora);
    const bloqueado = bloqueos.find(b => b.hora === hora);

    const fila = document.createElement("tr");

    // Colores según estado
    let colorFila = "";
    if (citaHora) colorFila = "#d1f0d1";      // Verde
    else if (bloqueado) colorFila = "#f0d1d1"; // Rojo

    fila.style.backgroundColor = colorFila;

    fila.innerHTML = `
      <td>${hora}</td>
      <td>${citaHora ? citaHora.clienteId : "-"}</td>
      <td>${citaHora ? citaHora.servicioId : "-"}</td>
      <td>${citaHora ? (citaHora.simultaneo ? "Sí" : "No") : "-"}</td>
      <td>
        ${citaHora ? `<button class="btn-secondary btnEliminar" data-id="${citaHora.id}">Eliminar</button>` : ""}
        ${bloqueado ? `<span style="font-weight:bold;">Bloqueado</span>` : ""}
      </td>
    `;

    tabla.appendChild(fila);
  });

  // Eventos eliminar cita
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

// =======================
// CARGAR AGENDA AL INICIO CON FECHA ACTUAL
// =======================
function cargarAgendaHoy() {
  const hoy = fechaActual();
  fechaInput.value = hoy;
  cargarAgenda(hoy);
}

// =======================
// EVENTO AL CAMBIAR FECHA
// =======================
fechaInput.addEventListener("change", () => {
  if (fechaInput.value) cargarAgenda(fechaInput.value);
});

// =======================
// EXPORTAR FUNCIÓN PARA UI-TABS
// =======================
export { cargarAgendaHoy };

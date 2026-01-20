import { db } from "./firebase.js";
import { collection, query, where, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const fechaInput = document.getElementById("fechaAgenda");
const tabla = document.getElementById("tablaAgenda").querySelector("tbody");

// Horas de atención
const HORAS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

// Función para cargar la agenda
async function cargarAgenda(fechaSeleccionada) {
  tabla.innerHTML = "";

  // Obtener citas
  const citasRef = collection(db, "citas");
  const qCitas = query(citasRef, where("fecha", "==", fechaSeleccionada));
  const snapshotCitas = await getDocs(qCitas);
  const citas = snapshotCitas.docs.map(d => ({ id: d.id, ...d.data() }));

  HORAS.forEach(hora => {
    const citaHora = citas.find(c => c.hora === hora);
    const fila = document.createElement("tr");

    fila.innerHTML = `
      <td>${hora}</td>
      <td>${citaHora ? citaHora.clienteId : "-"}</td>
      <td>${citaHora ? citaHora.servicioId : "-"}</td>
      <td>${citaHora ? (citaHora.simultaneo ? "Sí" : "No") : "-"}</td>
      <td>
        ${citaHora ? `<button class="btn-secondary btnEliminar" data-id="${citaHora.id}">Eliminar cita</button>` : ""}
      </td>
    `;
    tabla.appendChild(fila);
  });

  // Eventos eliminar cita
  document.querySelectorAll(".btnEliminar").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await deleteDoc(doc(db, "citas", id));
      cargarAgenda(fechaSeleccionada); // recargar
    });
  });
}

// ==========================
// Mostrar la agenda del día de hoy al entrar
// ==========================
function getFechaHoy() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Colocar fecha de hoy en el input y cargar agenda
const fechaHoy = getFechaHoy();
fechaInput.value = fechaHoy;
cargarAgenda(fechaHoy);

// Cambiar agenda al seleccionar otra fecha
fechaInput.addEventListener("change", () => {
  if (fechaInput.value) cargarAgenda(fechaInput.value);
});

import { db } from "./firebase.js";
import { collection, query, where, getDocs, Timestamp, deleteDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const fechaInput = document.getElementById("fechaAgenda");
const tabla = document.getElementById("tablaAgenda").querySelector("tbody");
const btnBloquearDia = document.getElementById("btnBloquearDia");

const HORAS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

// Función para cargar la agenda de un día
async function cargarAgenda(fecha) {
  tabla.innerHTML = "";

  // Obtener citas del día seleccionado
  const citasRef = collection(db, "citas");
  const q = query(citasRef, where("fecha", "==", fecha));
  const snapshot = await getDocs(q);
  const citas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  HORAS.forEach(hora => {
    const fila = document.createElement("tr");

    const citaHora = citas.find(c => c.hora === hora);

    fila.innerHTML = `
      <td>${hora}</td>
      <td>${citaHora ? citaHora.clienteId : ""}</td>
      <td>${citaHora ? citaHora.servicio : ""}</td>
      <td>${citaHora ? (citaHora.simultaneo ? "Sí" : "No") : ""}</td>
      <td>
        ${citaHora ? `<button class="btn-secondary btnEliminar" data-id="${citaHora.id}">Eliminar</button>` : ""}
      </td>
    `;

    tabla.appendChild(fila);
  });

  // Eventos de eliminar
  document.querySelectorAll(".btnEliminar").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await deleteDoc(doc(db, "citas", id));
      cargarAgenda(fecha); // recargar agenda
    });
  });
}

// Bloquear día completo
btnBloquearDia.addEventListener("click", async () => {
  const fecha = fechaInput.value;
  if (!fecha) return alert("Seleccione una fecha primero");
  for (let hora of HORAS) {
    await setDoc(doc(db, "bloqueos", `${fecha}_${hora}`), { bloqueado: true });
  }
  alert("Día bloqueado");
  cargarAgenda(fecha);
});

// Cargar agenda al seleccionar fecha
fechaInput.addEventListener("change", () => {
  if (fechaInput.value) cargarAgenda(fechaInput.value);
});

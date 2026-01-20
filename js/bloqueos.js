// js/bloqueos.js
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  query,
  where,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let fechaInput;
let btnBloquearDiaCompleto;
let tabla;

// Horas del día
const HORAS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

// ============================
// Cargar bloqueos
// ============================
async function cargarBloqueos(fechaSeleccionada) {
  if (!tabla) return;

  tabla.innerHTML = "";

  const bloqueosRef = collection(db, "bloqueos");
  const q = query(bloqueosRef, where("fecha", "==", fechaSeleccionada));
  const snapshot = await getDocs(q);
  const bloqueos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  HORAS.forEach(hora => {
    const bloqueoHora = bloqueos.find(b => b.hora === hora);
    const fila = document.createElement("tr");

    fila.innerHTML = `
      <td>${fechaSeleccionada}</td>
      <td>${hora}</td>
      <td>${bloqueoHora ? "Sí" : "No"}</td>
      <td>
        ${
          bloqueoHora
            ? `<button class="btn-secondary btnEliminar" data-id="${bloqueoHora.id}">Eliminar</button>`
            : ""
        }
      </td>
    `;

    tabla.appendChild(fila);
  });

  document.querySelectorAll(".btnEliminar").forEach(btn => {
    btn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "bloqueos", btn.dataset.id));
      cargarBloqueos(fechaSeleccionada);
    });
  });
}

// ============================
// INIT BLOQUEOS (OBLIGATORIO)
// ============================
function initBloqueos() {
  fechaInput = document.getElementById("fechaBloqueo");
  btnBloquearDiaCompleto = document.getElementById("btnBloquearDiaCompleto");
  tabla = document
    .getElementById("tablaBloqueos")
    ?.querySelector("tbody");

  if (!fechaInput || !btnBloquearDiaCompleto || !tabla) {
    console.warn("Bloqueos: HTML no cargado aún");
    return;
  }

  btnBloquearDiaCompleto.addEventListener("click", async () => {
    const fecha = fechaInput.value;
    if (!fecha) {
      alert("Seleccione una fecha primero");
      return;
    }

    for (let hora of HORAS) {
      const bloqueoId = `${fecha}_${hora}`;
      await setDoc(doc(db, "bloqueos", bloqueoId), {
        fecha,
        hora,
        bloqueado: true,
        creado: Timestamp.now()
      });
    }

    alert("Día bloqueado correctamente");
    cargarBloqueos(fecha);
  });

  fechaInput.addEventListener("change", () => {
    if (fechaInput.value) {
      cargarBloqueos(fechaInput.value);
    }
  });
}

// 👇 ESTO ES LO QUE ui-tabs.js NECESITA
export { initBloqueos };

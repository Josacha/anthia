// js/bloqueos.js
import { db } from "./firebase.js";
import { collection, getDocs, setDoc, doc, deleteDoc, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Elementos del DOM
const fechaInput = document.getElementById("fechaBloqueo");
const btnBloquearDiaCompleto = document.getElementById("btnBloquearDiaCompleto");
const tabla = document.getElementById("tablaBloqueos").querySelector("tbody");

// Horas del día
const HORAS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

// Función para cargar bloqueos en la tabla
async function cargarBloqueos(fechaSeleccionada) {
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
        ${bloqueoHora ? `<button class="btn-secondary btnEliminar" data-id="${bloqueoHora.id}">Eliminar</button>` : ""}
      </td>
    `;

    tabla.appendChild(fila);
  });

  // Eventos de eliminar
  document.querySelectorAll(".btnEliminar").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await deleteDoc(doc(db, "bloqueos", id));
      cargarBloqueos(fechaSeleccionada);
    });
  });
}

// Función para bloquear día completo
btnBloquearDiaCompleto.addEventListener("click", async () => {
  const fecha = fechaInput.value;
  if (!fecha) return alert("Seleccione una fecha primero");

  for (let hora of HORAS) {
    const bloqueoId = `${fecha}_${hora}`;
    await setDoc(doc(db, "bloqueos", bloqueoId), {
      fecha: fecha,
      hora: hora,
      bloqueado: true,
      creado: Timestamp.now()
    });
  }

  alert("Día bloqueado correctamente");
  cargarBloqueos(fecha);
});

// Cargar bloqueos al seleccionar fecha
fechaInput.addEventListener("change", () => {
  if (fechaInput.value) cargarBloqueos(fechaInput.value);
});

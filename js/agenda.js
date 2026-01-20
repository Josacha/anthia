import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");

const HORAS = [
  "08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00","18:00"
];

function hoyISO() {
  return new Date().toISOString().split("T")[0];
}

async function cargarAgenda(fecha) {
  tbody.innerHTML = "";

  const q = query(
    collection(db, "citas"),
    where("fecha", "==", fecha)
  );

  const snap = await getDocs(q);
  const citas = snap.docs.map(d => d.data());

  HORAS.forEach(hora => {
    const cita = citas.find(c => c.hora === hora);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${hora}</td>
      <td>${cita ? cita.clienteNombre : "-"}</td>
      <td>${cita ? cita.servicioNombre : "-"}</td>
      <td class="${cita ? "ocupado" : "libre"}">
        ${cita ? "Ocupado" : "Disponible"}
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/* CARGA AUTOMÁTICA */
document.addEventListener("DOMContentLoaded", () => {
  const hoy = hoyISO();
  fechaInput.value = hoy;
  cargarAgenda(hoy);
});

/* CAMBIO DE FECHA */
fechaInput.addEventListener("change", () => {
  cargarAgenda(fechaInput.value);
});

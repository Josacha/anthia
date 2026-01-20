import { db } from "./firebase.js";
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");

const modal = document.getElementById("modalCita");
const clienteInput = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");
const btnGuardar = document.getElementById("btnGuardar");
const btnCancelar = document.getElementById("btnCancelar");

let horaSeleccionada = null;
let citaEditId = null;

const HORAS = [
  "08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00","18:00"
];

function hoyISO() {
  return new Date().toISOString().split("T")[0];
}

/* SERVICIOS */
async function cargarServicios() {
  servicioSelect.innerHTML = "";
  const snap = await getDocs(collection(db, "servicios"));
  snap.forEach(d => {
    const s = d.data();
    servicioSelect.innerHTML += `
      <option value="${d.id}" data-simultaneo="${s.simultaneo}">
        ${s.nombre}
      </option>`;
  });
}

/* AGENDA */
async function cargarAgenda(fecha) {
  tbody.innerHTML = "";

  const q = query(collection(db, "citas"), where("fecha", "==", fecha));
  const snap = await getDocs(q);
  const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

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

    tr.addEventListener("click", () => abrirModal(hora, cita));
    tbody.appendChild(tr);
  });
}

/* MODAL */
function abrirModal(hora, cita) {
  horaSeleccionada = hora;
  citaEditId = cita ? cita.id : null;

  clienteInput.value = cita ? cita.clienteNombre : "";
  modal.classList.add("active");
}

btnCancelar.onclick = () => modal.classList.remove("active");

/* GUARDAR */
btnGuardar.onclick = async () => {
  const servicioOption = servicioSelect.selectedOptions[0];
  const simultaneo = servicioOption.dataset.simultaneo === "true";

  const q = query(
    collection(db, "citas"),
    where("fecha", "==", fechaInput.value),
    where("hora", "==", horaSeleccionada)
  );

  const snap = await getDocs(q);

  if (!simultaneo && !snap.empty && !citaEditId) {
    alert("Este servicio no permite citas simultáneas");
    return;
  }

  const data = {
    fecha: fechaInput.value,
    hora: horaSeleccionada,
    clienteNombre: clienteInput.value,
    servicioId: servicioSelect.value,
    servicioNombre: servicioOption.text,
    simultaneo
  };

  if (citaEditId) {
    await updateDoc(doc(db, "citas", citaEditId), data);
  } else {
    await addDoc(collection(db, "citas"), data);
  }

  modal.classList.remove("active");
  cargarAgenda(fechaInput.value);
};

/* INIT */
document.addEventListener("DOMContentLoaded", async () => {
  fechaInput.value = hoyISO();
  await cargarServicios();
  cargarAgenda(fechaInput.value);
});

fechaInput.addEventListener("change", () => {
  cargarAgenda(fechaInput.value);
});

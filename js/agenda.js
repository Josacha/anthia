import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");
const btnNueva = document.getElementById("btnNuevaCita");
const btnCancelar = document.getElementById("cancelarCita");
const btnGuardar = document.getElementById("guardarCita");

const horaInput = document.getElementById("horaCita");
const clienteInput = document.getElementById("clienteCita");
const servicioSelect = document.getElementById("servicioCita");
const simultaneoInput = document.getElementById("simultaneoCita");
const wrapSimultaneo = document.getElementById("wrapSimultaneo");

let serviciosCache = [];

// HORAS
const HORAS = [
  "08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00","18:00"
];

function hoyISO() {
  return new Date().toISOString().split("T")[0];
}

// =========================
// CARGAR SERVICIOS
// =========================
async function cargarServicios() {
  servicioSelect.innerHTML = `<option value="">Seleccione servicio</option>`;
  const snap = await getDocs(collection(db, "servicios"));

  serviciosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  serviciosCache.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.nombre;
    servicioSelect.appendChild(opt);
  });
}

servicioSelect.addEventListener("change", () => {
  const servicio = serviciosCache.find(s => s.id === servicioSelect.value);

  if (servicio && servicio.simultaneo) {
    wrapSimultaneo.style.display = "block";
  } else {
    wrapSimultaneo.style.display = "none";
    simultaneoInput.checked = false;
  }
});

// =========================
// CARGAR AGENDA
// =========================
async function cargarAgenda(fecha) {
  tbody.innerHTML = "";

  const q = query(
    collection(db, "citas"),
    where("fecha", "==", fecha)
  );

  const snap = await getDocs(q);
  const citas = snap.docs.map(d => d.data());

  HORAS.forEach(hora => {
    const citasHora = citas.filter(c => c.hora === hora);

    const tr = document.createElement("tr");

    if (citasHora.length === 0) {
      tr.innerHTML = `
        <td>${hora}</td>
        <td>-</td>
        <td>-</td>
        <td class="libre">Disponible</td>
      `;
    } else {
      tr.innerHTML = `
        <td>${hora}</td>
        <td>${citasHora.map(c => c.clienteNombre).join("<br>")}</td>
        <td>${citasHora.map(c => c.servicioNombre).join("<br>")}</td>
        <td class="ocupado">Ocupado</td>
      `;
    }

    tbody.appendChild(tr);
  });
}

// =========================
// EVENTOS
// =========================
btnNueva.addEventListener("click", () => {
  modal.classList.add("active");
  cargarServicios();
});

btnCancelar.addEventListener("click", () => {
  modal.classList.remove("active");
});

btnGuardar.addEventListener("click", async () => {
  const servicio = serviciosCache.find(s => s.id === servicioSelect.value);

  if (!horaInput.value || !clienteInput.value || !servicio) {
    alert("Complete todos los campos");
    return;
  }

  await addDoc(collection(db, "citas"), {
    fecha: fechaInput.value,
    hora: horaInput.value,
    clienteNombre: clienteInput.value,
    servicioId: servicio.id,
    servicioNombre: servicio.nombre,
    simultaneo: servicio.simultaneo ? simultaneoInput.checked : false
  });

  modal.classList.remove("active");
  horaInput.value = "";
  clienteInput.value = "";
  servicioSelect.value = "";
  simultaneoInput.checked = false;

  cargarAgenda(fechaInput.value);
});

// INIT
document.addEventListener("DOMContentLoaded", () => {
  const hoy = hoyISO();
  fechaInput.value = hoy;
  cargarAgenda(hoy);
});

fechaInput.addEventListener("change", () => {
  cargarAgenda(fechaInput.value);
});

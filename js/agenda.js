import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, query, where, updateDoc, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");

const modal = document.getElementById("modalCita");
const btnNuevaCita = document.getElementById("btnNuevaCita");
const guardarCita = document.getElementById("guardarCita");
const cancelarModal = document.getElementById("cancelarModal");

const clienteNombre = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");
const simultaneoCheck = document.getElementById("simultaneo");

const HORAS = [
  "08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00","18:00"
];

let horaSeleccionada = null;

// FECHA HOY
function hoyISO() {
  return new Date().toISOString().split("T")[0];
}

// CARGAR SERVICIOS
async function cargarServicios() {
  servicioSelect.innerHTML = "";
  const snap = await getDocs(collection(db, "servicios"));
  snap.forEach(d => {
    const s = d.data();
    const opt = document.createElement("option");
    opt.value = s.nombre;
    opt.dataset.simultaneo = s.simultaneo;
    opt.textContent = s.nombre;
    servicioSelect.appendChild(opt);
  });
}

// AGENDA
async function cargarAgenda(fecha) {
  tbody.innerHTML = "";

  const q = query(collection(db, "citas"), where("fecha", "==", fecha));
  const snap = await getDocs(q);
  const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  HORAS.forEach(hora => {
    const cita = citas.find(c => c.hora === hora);

    const tr = document.createElement("tr");
    tr.dataset.hora = hora;

    if (cita) {
      tr.draggable = true;
      tr.dataset.id = cita.id;
    }

    tr.innerHTML = `
      <td>${hora}</td>
      <td>${cita?.clienteNombre || "-"}</td>
      <td>${cita?.servicioNombre || "-"}</td>
      <td class="${cita ? "ocupado" : "libre"}">
        ${cita ? "Ocupado" : "Disponible"}
      </td>
    `;

    tr.addEventListener("click", () => {
      if (!cita) {
        horaSeleccionada = hora;
        modal.classList.add("active");
      }
    });

    tr.addEventListener("dragstart", e => {
      e.dataTransfer.setData("id", tr.dataset.id);
    });

    tr.addEventListener("dragover", e => e.preventDefault());

    tr.addEventListener("drop", async e => {
      const id = e.dataTransfer.getData("id");
      await updateDoc(doc(db, "citas", id), { hora });
      cargarAgenda(fechaInput.value);
    });

    tbody.appendChild(tr);
  });
}

// NUEVA CITA
guardarCita.onclick = async () => {
  const servicio = servicioSelect.selectedOptions[0];
  const permite = servicio.dataset.simultaneo === "true";

  await addDoc(collection(db, "citas"), {
    fecha: fechaInput.value,
    hora: horaSeleccionada,
    clienteNombre: clienteNombre.value,
    servicioNombre: servicio.value,
    simultaneo: permite
  });

  modal.classList.remove("active");
  clienteNombre.value = "";
  cargarAgenda(fechaInput.value);
};

cancelarModal.onclick = () => modal.classList.remove("active");
btnNuevaCita.onclick = () => modal.classList.add("active");

// INIT
document.addEventListener("DOMContentLoaded", async () => {
  fechaInput.value = hoyISO();
  await cargarServicios();
  cargarAgenda(fechaInput.value);
});

fechaInput.addEventListener("change", () => {
  cargarAgenda(fechaInput.value);
});

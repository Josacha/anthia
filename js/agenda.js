import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, query, where,
  updateDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===============================
   ELEMENTOS
================================ */
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");

const modal = document.getElementById("modalCita");
const btnNuevaCita = document.getElementById("btnNuevaCita");
const guardarCita = document.getElementById("guardarCita");
const cancelarModal = document.getElementById("cancelarModal");

const clienteNombre = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");
const simultaneoCheck = document.getElementById("simultaneo");

let editandoId = null;
let horaSeleccionada = null;

/* ===============================
   HORAS
================================ */
const HORAS = [
  "08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00","18:00"
];

/* ===============================
   UTILIDADES
================================ */
function hoyISO() {
  return new Date().toISOString().split("T")[0];
}

function sumarMinutos(hora, minutos) {
  const [h, m] = hora.split(":").map(Number);
  const d = new Date(0,0,0,h,m + minutos);
  return d.toTimeString().slice(0,5);
}

/* ===============================
   SERVICIOS
================================ */
async function cargarServicios() {
  servicioSelect.innerHTML = "";
  const snap = await getDocs(collection(db, "servicios"));

  snap.forEach(d => {
    const s = d.data();
    const opt = document.createElement("option");
    opt.value = s.nombre;
    opt.dataset.duracion = s.duracion; // ⏱ minutos
    opt.dataset.simultaneo = s.simultaneo;
    opt.textContent = `${s.nombre} (${s.duracion} min)`;
    servicioSelect.appendChild(opt);
  });
}

/* ===============================
   AGENDA
================================ */
async function cargarAgenda(fecha) {
  tbody.innerHTML = "";

  const q = query(collection(db, "citas"), where("fecha", "==", fecha));
  const snap = await getDocs(q);
  const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  HORAS.forEach(hora => {

    const cita = citas.find(c =>
      c.hora === hora ||
      (c.hora < hora && c.horaFin > hora)
    );

    const tr = document.createElement("tr");

    if (cita) {
      tr.classList.add("ocupado");
      tr.draggable = true;
      tr.dataset.id = cita.id;
    }

    tr.innerHTML = `
      <td>${hora}</td>
      <td>${cita ? cita.clienteNombre : "-"}</td>
      <td>${cita ? cita.servicios.map(s => s.nombre).join(", ") : "-"}</td>
      <td class="${cita ? "ocupado" : "libre"}">
        ${cita ? "Ocupado" : "Disponible"}
      </td>
    `;

    /* CLICK */
    tr.onclick = () => {
      if (!cita) {
        horaSeleccionada = hora;
        editandoId = null;
        modal.classList.add("active");
      } else {
        editarCita(cita);
      }
    };

    /* DRAG */
    tr.addEventListener("dragstart", e => {
      e.dataTransfer.setData("id", tr.dataset.id);
    });

    tr.addEventListener("dragover", e => e.preventDefault());

    tr.addEventListener("drop", async e => {
      const id = e.dataTransfer.getData("id");
      await updateDoc(doc(db, "citas", id), {
        hora,
        horaFin: sumarMinutos(hora, cita.duracionTotal)
      });
      cargarAgenda(fechaInput.value);
    });

    tbody.appendChild(tr);
  });
}

/* ===============================
   EDITAR / ELIMINAR
================================ */
function editarCita(cita) {
  modal.classList.add("active");
  clienteNombre.value = cita.clienteNombre;
  horaSeleccionada = cita.hora;
  editandoId = cita.id;
}

async function eliminarCita(id) {
  if (confirm("¿Eliminar esta cita?")) {
    await deleteDoc(doc(db, "citas", id));
    cargarAgenda(fechaInput.value);
  }
}

/* ===============================
   GUARDAR
================================ */
guardarCita.onclick = async () => {
  const servicios = [...servicioSelect.selectedOptions].map(opt => ({
    nombre: opt.value,
    duracion: Number(opt.dataset.duracion)
  }));

  const duracionTotal = servicios.reduce((a,b) => a + b.duracion, 0);
  const horaFin = sumarMinutos(horaSeleccionada, duracionTotal);

  const data = {
    fecha: fechaInput.value,
    hora: horaSeleccionada,
    horaFin,
    clienteNombre: clienteNombre.value,
    servicios,
    duracionTotal
  };

  if (editandoId) {
    await updateDoc(doc(db, "citas", editandoId), data);
  } else {
    await addDoc(collection(db, "citas"), data);
  }

  modal.classList.remove("active");
  clienteNombre.value = "";
  editandoId = null;
  cargarAgenda(fechaInput.value);
};

cancelarModal.onclick = () => modal.classList.remove("active");
btnNuevaCita.onclick = () => {
  editandoId = null;
  clienteNombre.value = "";
  modal.classList.add("active");
};

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  fechaInput.value = hoyISO();
  await cargarServicios();
  cargarAgenda(fechaInput.value);
});

fechaInput.addEventListener("change", () => {
  cargarAgenda(fechaInput.value);
});

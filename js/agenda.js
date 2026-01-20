import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  doc
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

const btnDia = document.getElementById("btnDia");
const btnSemana = document.getElementById("btnSemana");

const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

let horaSeleccionada = null;
let editCitaId = null;
let vistaSemana = false;

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
    opt.dataset.duracion = s.duracion || 1; // duración en horas
    opt.textContent = s.nombre;
    servicioSelect.appendChild(opt);
  });
}

// CARGAR AGENDA
async function cargarAgenda(fecha) {
  tbody.innerHTML = "";
  const q = query(collection(db, "citas"), where("fecha", "==", fecha));
  const snap = await getDocs(q);
  const citas = snap?.docs?.map(d => ({ id: d.id, ...d.data() })) || [];

  HORAS.forEach(hora => {
    const cita = citas.find(c => c.hora === hora);
    const tr = document.createElement("tr");
    tr.dataset.hora = hora;

    if (cita) {
      tr.draggable = true;
      tr.dataset.id = cita.id;
    }

    // calcular duración si tiene varios servicios
    const duracion = cita?.servicios?.reduce((sum, s) => sum + (s.duracion || 1), 0) || (cita ? 1 : 0);

    tr.innerHTML = `
      <td>${hora}</td>
      <td>${cita?.clienteNombre || "-"}</td>
      <td>${cita ? (cita.servicios?.map(s => s.nombre).join(", ") || cita.servicioNombre) : "-"}</td>
      <td class="${cita ? "ocupado" : "libre"}">
        ${cita ? "Ocupado" : "Disponible"}
      </td>
      <td class="acciones">
        ${cita ? '<button class="accion-btn editar">Editar</button><button class="accion-btn eliminar">Eliminar</button>' : ''}
      </td>
    `;

    // CLICK en fila para nueva cita
    tr.addEventListener("click", () => {
      if (!cita) {
        horaSeleccionada = hora;
        editCitaId = null;
        modal.classList.add("active");
      }
    });

    // BOTONES DE ACCIÓN
    tr.querySelectorAll(".accion-btn.editar").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        editCitaId = cita.id;
        horaSeleccionada = hora;
        clienteNombre.value = cita.clienteNombre;
        simultaneoCheck.checked = cita.simultaneo || false;
        // cargar servicios existentes
        cargarServicios().then(() => {
          if(cita.servicios) {
            Array.from(servicioSelect.options).forEach(opt => {
              opt.selected = cita.servicios.some(s => s.nombre === opt.value);
            });
          }
        });
        modal.classList.add("active");
      });
    });

    tr.querySelectorAll(".accion-btn.eliminar").forEach(btn => {
      btn.addEventListener("click", async e => {
        e.stopPropagation();
        if(confirm("¿Eliminar esta cita?")) {
          await deleteDoc(doc(db, "citas", cita.id));
          cargarAgenda(fechaInput.value);
        }
      });
    });

    tbody.appendChild(tr);
  });
}

// GUARDAR / EDITAR CITA
guardarCita.onclick = async () => {
  const selectedServices = Array.from(servicioSelect.selectedOptions).map(opt => ({
    nombre: opt.value,
    duracion: parseInt(opt.dataset.duracion),
    simultaneo: opt.dataset.simultaneo === "true"
  }));

  const nuevaCita = {
    fecha: fechaInput.value,
    hora: horaSeleccionada,
    clienteNombre: clienteNombre.value,
    servicios: selectedServices,
    simultaneo: selectedServices.some(s => s.simultaneo)
  };

  if(editCitaId) {
    await updateDoc(doc(db, "citas", editCitaId), nuevaCita);
  } else {
    await addDoc(collection(db, "citas"), nuevaCita);
  }

  modal.classList.remove("active");
  clienteNombre.value = "";
  cargarAgenda(fechaInput.value);
};

// CANCELAR MODAL
cancelarModal.onclick = () => modal.classList.remove("active");
btnNuevaCita.onclick = () => {
  editCitaId = null;
  modal.classList.add("active");
};

// VISTA DIA / SEMANA
btnDia.onclick = () => {
  vistaSemana = false;
  btnDia.classList.add("active");
  btnSemana.classList.remove("active");
  cargarAgenda(fechaInput.value);
};

btnSemana.onclick = () => {
  vistaSemana = true;
  btnSemana.classList.add("active");
  btnDia.classList.remove("active");
  cargarAgenda(fechaInput.value);
};

// INIT
document.addEventListener("DOMContentLoaded", async () => {
  fechaInput.value = hoyISO();
  await cargarServicios();
  cargarAgenda(fechaInput.value);
});

fechaInput.addEventListener("change", () => cargarAgenda(fechaInput.value));

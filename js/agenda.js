import { db } from "./firebase.js";
import { collection, addDoc, getDocs, query, where, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");

const modal = document.getElementById("modalCita");
const btnNuevaCita = document.getElementById("btnNuevaCita");
const guardarCita = document.getElementById("guardarCita");
const cancelarModal = document.getElementById("cancelarModal");

const clienteNombre = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");
const btnAgregarServicio = document.getElementById("btnAgregarServicio");
const listaServicios = document.getElementById("listaServicios");
const tiempoTotalSpan = document.getElementById("tiempoTotal");

const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
let horaSeleccionada = null;
let carrito = [];

// FECHA HOY
function hoyISO() { return new Date().toISOString().split("T")[0]; }

// CARGAR SERVICIOS
async function cargarServicios() {
  servicioSelect.innerHTML = "";
  const snap = await getDocs(collection(db, "servicios"));
  snap.forEach(d => {
    const s = d.data();
    const opt = document.createElement("option");
    opt.value = s.nombre;
    opt.dataset.duracion = s.duracion || 30; // duracion en minutos
    opt.textContent = `${s.nombre} (${s.duracion || 30} min)`;
    servicioSelect.appendChild(opt);
  });
}

// ACTUALIZAR HERO
function actualizarHero(fecha) {
  const d = new Date(fecha);
  const dias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  document.getElementById("numeroDia").textContent = d.getDate();
  document.getElementById("mes").textContent = meses[d.getMonth()];
  document.getElementById("diaSemana").textContent = dias[d.getDay()];
}

// CARGAR AGENDA
async function cargarAgenda(fecha) {
  tbody.innerHTML = "";
  const q = query(collection(db, "citas"), where("fecha", "==", fecha));
  const snap = await getDocs(q);
  const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  HORAS.forEach(hora => {
    const cita = citas.find(c => c.hora === hora);
    const tr = document.createElement("tr");
    tr.dataset.hora = hora;

    tr.innerHTML = `
      <td>${hora}</td>
      <td>${cita?.clienteNombre || "-"}</td>
      <td>${cita ? cita.servicios.map(s=>s.nombre).join(", ") : "-"}</td>
      <td>${cita ? (cita.servicios.reduce((acc,s)=>acc+s.duracion,0)) : "-"}</td>
      <td class="${cita ? "ocupado" : "libre"}">${cita ? "Ocupado" : "Disponible"}</td>
      <td>
        ${cita ? `<button class="editar" data-id="${cita.id}">✏️</button>
                   <button class="eliminar" data-id="${cita.id}">🗑️</button>` : ""}
      </td>
    `;

    if (!cita) tr.addEventListener("click", () => { horaSeleccionada = hora; modal.classList.add("active"); });

    tbody.appendChild(tr);
  });

  // EDITAR / ELIMINAR
  document.querySelectorAll(".editar").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const c = citas.find(c=>c.id===id);
      horaSeleccionada = c.hora;
      clienteNombre.value = c.clienteNombre;
      carrito = c.servicios;
      actualizarCarrito();
      modal.classList.add("active");
      guardarCita.onclick = async () => {
        await updateDoc(doc(db,"citas",id), { clienteNombre: clienteNombre.value, servicios: carrito });
        modal.classList.remove("active");
        cargarAgenda(fechaInput.value);
      };
    });
  });

  document.querySelectorAll(".eliminar").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if(confirm("Eliminar cita?")){
        await deleteDoc(doc(db,"citas",btn.dataset.id));
        cargarAgenda(fechaInput.value);
      }
    });
  });
}

// CARRITO
btnAgregarServicio.onclick = () => {
  const opt = servicioSelect.selectedOptions[0];
  carrito.push({ nombre: opt.value, duracion: parseInt(opt.dataset.duracion) });
  actualizarCarrito();
};

function actualizarCarrito() {
  listaServicios.innerHTML = "";
  let total = 0;
  carrito.forEach((s,i)=>{
    total += s.duracion;
    const li = document.createElement("li");
    li.innerHTML = `${s.nombre} - ${s.duracion} min <span class="remove" data-index="${i}">x</span>`;
    listaServicios.appendChild(li);
  });
  tiempoTotalSpan.textContent = total;
  document.querySelectorAll(".remove").forEach(r=>r.addEventListener("click", e=>{
    carrito.splice(e.target.dataset.index,1);
    actualizarCarrito();
  }));
}

// NUEVA CITA
guardarCita.onclick = async () => {
  if(!horaSeleccionada) return;
  await addDoc(collection(db,"citas"), {
    fecha: fechaInput.value,
    hora: horaSeleccionada,
    clienteNombre: clienteNombre.value,
    servicios: carrito
  });
  modal.classList.remove("active");
  clienteNombre.value="";
  carrito=[];
  actualizarCarrito();
  cargarAgenda(fechaInput.value);
};

// CANCELAR
cancelarModal.onclick = () => { modal.classList.remove("active"); carrito=[]; actualizarCarrito(); };
btnNuevaCita.onclick = () => { horaSeleccionada=null; modal.classList.add("active"); };

// INIT
document.addEventListener("DOMContentLoaded", async () => {
  fechaInput.value = hoyISO();
  await cargarServicios();
  actualizarHero(fechaInput.value);
  cargarAgenda(fechaInput.value);
});

fechaInput.addEventListener("change", ()=>{
  cargarAgenda(fechaInput.value);
  actualizarHero(fechaInput.value);
});

// agenda.js
import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");
const btnNuevaCita = document.getElementById("btnNuevaCita");
const guardarCita = document.getElementById("guardarCita");
const cancelarModal = document.getElementById("cancelarModal");
const clienteNombre = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");
const simultaneoCheck = document.getElementById("simultaneo");

// Carrito
let carrito = [];
let horaSeleccionada = null;

// Horas
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

// Servicio Map
let serviciosMap = {};

// Función para cargar servicios
async function cargarServicios() {
  const snap = await getDocs(collection(db,"servicios"));
  servicioSelect.innerHTML = "";
  snap.forEach(d => {
    const s = d.data();
    serviciosMap[d.id] = s; // mapa id -> datos
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.dataset.simultaneo = s.simultaneo || false;
    opt.dataset.duracion = s.duracion || 60;
    opt.textContent = `${s.nombre} (${s.duracion || 60} min)`;
    servicioSelect.appendChild(opt);
  });
}

// Convertir hora a minutos
function horaAMinutos(h) {
  const [hh, mm] = h.split(":").map(Number);
  return hh*60 + mm;
}

// Actualizar carrito modal
function actualizarCarrito() {
  const existente = document.getElementById("carritoServicios");
  if (existente) existente.remove();

  const div = document.createElement("div");
  div.id = "carritoServicios";
  div.style.marginTop = "10px";

  div.innerHTML = carrito.map((s,i)=>`
    <div style="display:flex;justify-content:space-between;margin-bottom:5px">
      <span>${s.nombre} (${s.duracion} min)</span>
      <button type="button" data-index="${i}">❌</button>
    </div>
  `).join("");

  modal.querySelector(".acciones").before(div);

  div.querySelectorAll("button").forEach(b=>{
    b.addEventListener("click", ()=>{
      carrito.splice(b.dataset.index,1);
      actualizarCarrito();
    });
  });

  const total = carrito.reduce((acc,s)=>acc + (s.duracion || 0),0);
  let totalDiv = document.getElementById("totalDuracion");
  if(!totalDiv){
    totalDiv = document.createElement("div");
    totalDiv.id = "totalDuracion";
    totalDiv.style.marginTop = "10px";
    modal.querySelector(".acciones").before(totalDiv);
  }
  totalDiv.textContent = `Duración total: ${total} min`;
}

// Añadir servicio al carrito
servicioSelect.addEventListener("change", ()=>{
  const opt = servicioSelect.selectedOptions[0];
  if(opt){
    const s = serviciosMap[opt.value];
    carrito.push({ 
      id: opt.value,
      nombre: s.nombre, 
      duracion: s.duracion, 
      simultaneo: s.simultaneo || false
    });
    actualizarCarrito();
  }
});

// Cargar agenda
async function cargarAgenda(fecha) {
  tbody.innerHTML = "";
  const snap = await getDocs(query(collection(db,"citas"), where("fecha","==",fecha)));
  const citas = snap.docs.map(d=>({ id:d.id, ...d.data() }));

  HORAS.forEach(hora=>{
    let ocupado = false;
    let cita = null;

    citas.forEach(c=>{
      const inicio = horaAMinutos(c.hora);
      const fin = inicio + (c.duracion || 60);
      const horaMin = horaAMinutos(hora);

      if(horaMin >= inicio && horaMin < fin){
        ocupado = true;
        cita = {
          ...c,
          nombreServicio: serviciosMap[c.servicioId]?.nombre || "Servicio"
        };
      }
    });

    const tr = document.createElement("tr");
    tr.dataset.hora = hora;

    if(cita && hora === cita.hora){
      tr.draggable = true;
      tr.dataset.id = cita.id;
    }

    tr.innerHTML = `
      <td>${hora}</td>
      <td>${cita?.clienteId || "-"}</td>
      <td>${cita?.nombreServicio || "-"}</td>
      <td>${ocupado ? "Ocupado" : "Disponible"}</td>
      <td>
        ${cita && hora === cita.hora ? `
          <button class="editar" data-id="${cita.id}">✏️</button>
          <button class="eliminar" data-id="${cita.id}">🗑️</button>
        ` : ""}
      </td>
    `;

    if(!ocupado){
      tr.addEventListener("click", ()=>{
        horaSeleccionada = hora;
        modal.classList.add("active");
        carrito = [];
        actualizarCarrito();
      });
    }

    tbody.appendChild(tr);
  });

  // Editar y eliminar
  document.querySelectorAll(".editar").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.id;
      const c = citas.find(c=>c.id===id);
      horaSeleccionada = c.hora;
      clienteNombre.value = c.clienteId;
      carrito = [{id:c.servicioId, nombre:serviciosMap[c.servicioId]?.nombre, duracion:c.duracion, simultaneo:c.simultaneo}];
      actualizarCarrito();
      modal.classList.add("active");

      guardarCita.onclick = async ()=>{
        await updateDoc(doc(db,"citas",id),{
          clienteId: clienteNombre.value,
          servicioId: carrito[0]?.id,
          duracion: carrito[0]?.duracion,
          simultaneo: simultaneoCheck.checked
        });
        modal.classList.remove("active");
        cargarAgenda(fechaInput.value);
      };
    });
  });

  document.querySelectorAll(".eliminar").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if(confirm("¿Eliminar esta cita?")){
        await deleteDoc(doc(db,"citas",btn.dataset.id));
        cargarAgenda(fechaInput.value);
      }
    });
  });
}

// Guardar nueva cita
guardarCita.onclick = async ()=>{
  if(!horaSeleccionada) return alert("Selecciona una hora");
  const inicio = horaAMinutos(horaSeleccionada);
  const duracionTotal = carrito.reduce((acc,s)=>acc+s.duracion,0);

  // Validar solapamiento exacto
  const snap = await getDocs(query(collection(db,"citas"), where("fecha","==",fechaInput.value)));
  const citas = snap.docs.map(d=>d.data());
  for(const c of citas){
    const cInicio = horaAMinutos(c.hora);
    const cFin = cInicio + c.duracion;
    if(!(inicio+duracionTotal <= cInicio || inicio >= cFin)){
      if(!simultaneoCheck.checked && !c.simultaneo){
        return alert(`No se puede agendar: se solapa con ${c.clienteId} a las ${c.hora}`);
      }
    }
  }

  await addDoc(collection(db,"citas"),{
    fecha: fechaInput.value,
    hora: horaSeleccionada,
    clienteId: clienteNombre.value,
    servicioId: carrito[0]?.id,
    duracion: carrito[0]?.duracion,
    simultaneo: simultaneoCheck.checked
  });

  modal.classList.remove("active");
  clienteNombre.value = "";
  carrito = [];
  actualizarCarrito();
  cargarAgenda(fechaInput.value);
};

// Modal
cancelarModal.onclick = ()=> modal.classList.remove("active");
btnNuevaCita.onclick = ()=>{
  horaSeleccionada = null;
  clienteNombre.value = "";
  carrito = [];
  actualizarCarrito();
  modal.classList.add("active");
};

// INIT
document.addEventListener("DOMContentLoaded", async ()=>{
  fechaInput.value = new Date().toISOString().split("T")[0];
  await cargarServicios();
  cargarAgenda(fechaInput.value);
});

// Actualizar en tiempo real
onSnapshot(collection(db,"citas"), ()=> cargarAgenda(fechaInput.value));

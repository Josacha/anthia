import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, query, where, updateDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ELEMENTOS DEL DOM
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");
const btnNuevaCita = document.getElementById("btnNuevaCita");
const guardarCita = document.getElementById("guardarCita");
const cancelarModal = document.getElementById("cancelarModal");
const clienteNombre = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");
const simultaneoCheck = document.getElementById("simultaneo");

// VARIABLES
let carrito = [];
let horaSeleccionada = null;
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
const MAX_CITAS_SIMULTANEAS = 2;

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
    opt.dataset.simultaneo = s.simultaneo || false;
    opt.dataset.duracion = s.duracion || 60; // minutos
    opt.textContent = `${s.nombre} (${s.duracion || 60} min)`;
    servicioSelect.appendChild(opt);
  });
}

// ACTUALIZAR CARRITO
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

// AÑADIR SERVICIO
servicioSelect.addEventListener("change", ()=>{
  const opt = servicioSelect.selectedOptions[0];
  if(opt){
    carrito.push({ 
      nombre: opt.value, 
      duracion: parseInt(opt.dataset.duracion), 
      simultaneo: opt.dataset.simultaneo === "true" 
    });
    actualizarCarrito();
  }
});

// CARGAR AGENDA
async function cargarAgenda(fecha) {
  tbody.innerHTML = "";
  const q = query(collection(db,"citas"), where("fecha","==",fecha));
  const snap = await getDocs(q);
  const citas = snap.docs.map(d=>({ id: d.id, ...d.data() }));

  // Crear mapa de bloques ocupados
  const bloquesOcupados = {};
  HORAS.forEach(h=> bloquesOcupados[h]=[]);

  citas.forEach(c=>{
    const serviciosCita = Array.isArray(c.servicios) ? c.servicios : [];
    let duracionMin = serviciosCita.reduce((acc,s)=>acc + (s.duracion || 0),0);
    let bloques = Math.ceil(duracionMin / 60) || 1;
    let inicioIndex = HORAS.indexOf(c.hora);
    const simultaneo = serviciosCita.some(s=>s.simultaneo);

    for(let i=0;i<bloques;i++){
      let h = HORAS[inicioIndex+i];
      if(h){
        bloquesOcupados[h].push({ id:c.id, cliente:c.clienteNombre, simultaneo });
      }
    }
  });

  HORAS.forEach(hora=>{
    const tr = document.createElement("tr");
    tr.dataset.hora = hora;
    const citasHora = bloquesOcupados[hora] || [];
    let ocupado = false;
    let cita = null;

    // Comprobar restricciones de simultaneidad
    if(citasHora.length >= MAX_CITAS_SIMULTANEAS && !citasHora.some(c=>c.simultaneo)) ocupado = true;
    if(citasHora.length > 0) cita = citas.find(c=>c.id===citasHora[0].id);

    tr.innerHTML = `
      <td>${hora}</td>
      <td>${cita?.clienteNombre || "-"}</td>
      <td>${cita ? (Array.isArray(cita.servicios) ? cita.servicios.map(s=>s.nombre).join(", ") : "-") : "-"}</td>
      <td>${ocupado ? "Ocupado" : "Disponible"}</td>
      <td>
        ${cita ? `
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

    // Drag & Drop
    tr.addEventListener("dragstart", e=>{
      if(cita){
        e.dataTransfer.setData("id", cita.id);
      }
    });
    tr.addEventListener("dragover", e=> e.preventDefault());
    tr.addEventListener("drop", async e=>{
      const id = e.dataTransfer.getData("id");
      await updateDoc(doc(db,"citas",id),{hora});
      cargarAgenda(fechaInput.value);
    });

    tbody.appendChild(tr);
  });

  // EDITAR
  document.querySelectorAll(".editar").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.id;
      const c = citas.find(c=>c.id===id);
      horaSeleccionada = c.hora;
      clienteNombre.value = c.clienteNombre;
      carrito = Array.isArray(c.servicios) ? c.servicios.slice() : [];
      actualizarCarrito();
      modal.classList.add("active");

      guardarCita.onclick = async ()=>{
        await updateDoc(doc(db,"citas",id),{
          clienteNombre: clienteNombre.value,
          servicios: carrito
        });
        modal.classList.remove("active");
        cargarAgenda(fechaInput.value);
      };
    });
  });

  // ELIMINAR
  document.querySelectorAll(".eliminar").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      if(confirm("¿Eliminar esta cita?")){
        await deleteDoc(doc(db,"citas",btn.dataset.id));
        cargarAgenda(fechaInput.value);
      }
    });
  });
}

// NUEVA CITA
guardarCita.onclick = async ()=>{
  if(!horaSeleccionada) return alert("Selecciona una hora");
  await addDoc(collection(db,"citas"),{
    fecha: fechaInput.value,
    hora: horaSeleccionada,
    clienteNombre: clienteNombre.value,
    servicios: carrito.length ? carrito : [],
    simultaneo: simultaneoCheck.checked
  });
  modal.classList.remove("active");
  clienteNombre.value = "";
  carrito = [];
  actualizarCarrito();
  cargarAgenda(fechaInput.value);
};

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
  fechaInput.value = hoyISO();
  await cargarServicios();
  cargarAgenda(fechaInput.value);
});

fechaInput.addEventListener("change", ()=> cargarAgenda(fechaInput.value));

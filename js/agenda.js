import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  onSnapshot,
  doc
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

// Carrito
let carrito = [];
let horaSeleccionada = null;

// Horas
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

// Mapas
let serviciosMap = {};
let clientesMap = {};

// --------------------
// Utilidades
// --------------------
function horaAMinutos(h) {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}

// Actualiza el carrito en el modal
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

// --------------------
// Cargar servicios
// --------------------
async function cargarServicios() {
  const snap = await getDocs(collection(db,"servicios"));
  servicioSelect.innerHTML = "";
  snap.forEach(d => {
    const s = d.data();
    serviciosMap[d.id] = s;
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.dataset.simultaneo = s.simultaneo || false;
    opt.dataset.duracion = s.duracion || 60;
    opt.textContent = `${s.nombre} (${s.duracion || 60} min)`;
    servicioSelect.appendChild(opt);
  });
}

// --------------------
// Cargar clientes
// --------------------
async function cargarClientes() {
  const snap = await getDocs(collection(db,"clientes"));
  snap.forEach(d => {
    clientesMap[d.id] = d.data();
  });
}

// --------------------
// Selección de servicio al carrito
// --------------------
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

// --------------------
// Cargar agenda para un día
// --------------------
async function cargarAgenda(fecha) {
  tbody.innerHTML = "";

  const snap = await getDocs(query(collection(db,"citas"), where("fecha","==",fecha)));
  const citas = snap.docs.map(d=>({ id:d.id, ...d.data() }));

  HORAS.forEach(hora=>{
    const citasHora = citas.filter(c=>{
      const inicio = horaAMinutos(c.hora);
      const fin = inicio + c.duracion;
      const horaMin = horaAMinutos(hora);
      return horaMin >= inicio && horaMin < fin;
    });

    if(citasHora.length === 0){
      const tr = document.createElement("tr");
      tr.dataset.hora = hora;
      tr.innerHTML = `
        <td>${hora}</td>
        <td>-</td>
        <td>-</td>
        <td>Disponible</td>
        <td></td>
      `;
      tr.addEventListener("click", ()=>{
        horaSeleccionada = hora;
        carrito = [];
        actualizarCarrito();
        modal.classList.add("active");
      });
      tbody.appendChild(tr);
    } else {
      citasHora.forEach(c=>{
        const tr = document.createElement("tr");
        tr.dataset.hora = hora;
        tr.dataset.id = c.id;
        tr.innerHTML = `
          <td>${hora}</td>
          <td>${clientesMap[c.clienteId]?.nombre || c.clienteId}</td>
          <td>${serviciosMap[c.servicioId]?.nombre || c.servicioId}</td>
          <td>Ocupado</td>
          <td>
            <button class="editar" data-id="${c.id}">✏️</button>
            <button class="eliminar" data-id="${c.id}">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  });

  // Editar y eliminar
  document.querySelectorAll(".editar").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.id;
      const c = citas.find(c=>c.id===id);
      horaSeleccionada = c.hora;
      const cliente = clientesMap[c.clienteId];
      clienteNombre.value = cliente ? `${cliente.nombre} ${cliente.apellido1 || ''} ${cliente.apellido2 || ''}` : c.clienteId;
      carrito = [{id:c.servicioId, nombre:serviciosMap[c.servicioId]?.nombre, duracion:c.duracion, simultaneo:c.simultaneo}];
      actualizarCarrito();
      modal.classList.add("active");

      guardarCita.onclick = async ()=>{
        await updateDoc(doc(db,"citas",id),{
          clienteId: c.clienteId,
          servicioId: carrito[0]?.id,
          duracion: carrito[0]?.duracion,
          simultaneo: carrito[0]?.simultaneo
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

// --------------------
// Guardar nueva cita
// --------------------
guardarCita.onclick = async ()=>{
  if(!horaSeleccionada) return alert("Selecciona una hora");
  if(carrito.length === 0) return alert("Agrega un servicio");

  const inicio = horaAMinutos(horaSeleccionada);
  const duracionTotal = carrito.reduce((acc,s)=>acc+s.duracion,0);

  // Traer todas las citas del día
  const snap = await getDocs(query(collection(db,"citas"), where("fecha","==",fechaInput.value)));
  const citas = snap.docs.map(d=>({ id:d.id, ...d.data() }));

  // Reglas de simultaneidad y máximo 2 citas
  for(const s of carrito){
    let overlapping = citas.filter(c=>{
      const cInicio = horaAMinutos(c.hora);
      const cFin = cInicio + c.duracion;
      return !(inicio + s.duracion <= cInicio || inicio >= cFin);
    });

    if(overlapping.length > 0){
      // Si hay alguna cita que NO sea simultánea, no se puede agregar
      if(overlapping.some(c=>!c.simultaneo)){
        return alert(`No se puede agendar "${s.nombre}": hay una cita no simultánea en ese horario`);
      }
      // Máximo 2 citas aunque sean simultáneas
      if(overlapping.length >= 2){
        return alert(`No se puede agendar "${s.nombre}": ya hay 2 citas en este período`);
      }
    }
  }

  // Guardar todas las citas del carrito
  for(const s of carrito){
    await addDoc(collection(db,"citas"),{
      fecha: fechaInput.value,
      hora: horaSeleccionada,
      clienteId: clienteNombre.value,
      servicioId: s.id,
      duracion: s.duracion,
      simultaneo: s.simultaneo
    });
  }

  modal.classList.remove("active");
  clienteNombre.value = "";
  carrito = [];
  actualizarCarrito();
  cargarAgenda(fechaInput.value);
};

// --------------------
// Modal y botones
// --------------------
cancelarModal.onclick = ()=> modal.classList.remove("active");
btnNuevaCita.onclick = ()=>{
  horaSeleccionada = null;
  clienteNombre.value = "";
  carrito = [];
  actualizarCarrito();
  modal.classList.add("active");
};

// --------------------
// INIT
// --------------------
document.addEventListener("DOMContentLoaded", async ()=>{
  fechaInput.value = new Date().toISOString().split("T")[0];
  await cargarServicios();
  await cargarClientes();
  cargarAgenda(fechaInput.value);
});

// Actualizar en tiempo real
onSnapshot(collection(db,"citas"), ()=> cargarAgenda(fechaInput.value));

// --------------------
// Cambiar fecha
// --------------------
fechaInput.addEventListener("change", ()=> cargarAgenda(fechaInput.value));

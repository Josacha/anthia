// agenda.js
import { db } from "./firebase.js";
import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ----------------------
// ELEMENTOS DEL DOM
// ----------------------
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");

const modal = document.getElementById("modalCita");
const btnNuevaCita = document.getElementById("btnNuevaCita");
const guardarCita = document.getElementById("guardarCita");
const cancelarModal = document.getElementById("cancelarModal");

const clienteNombre = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");
const simultaneoCheck = document.getElementById("simultaneo");

// ----------------------
// CARRITO DE SERVICIOS
// ----------------------
let carrito = [];
let horaSeleccionada = null;

// ----------------------
// HORAS
// ----------------------
const HORAS = [
  "08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00","18:00"
];

// ----------------------
// FECHA HOY
// ----------------------
function hoyISO() {
  return new Date().toISOString().split("T")[0];
}

// ----------------------
// CARGAR SERVICIOS
// ----------------------
async function cargarServicios() {
  servicioSelect.innerHTML = "";
  const snap = await getDocs(collection(db,"servicios"));
  snap.forEach(d=>{
    const s=d.data();
    const opt=document.createElement("option");
    opt.value=s.nombre;
    opt.dataset.simultaneo=s.simultaneo || false;
    opt.dataset.duracion=s.duracion || 60;
    opt.textContent=`${s.nombre} (${s.duracion || 60} min)`;
    servicioSelect.appendChild(opt);
  });
}

// ----------------------
// ACTUALIZAR CARRITO EN MODAL
// ----------------------
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

// ----------------------
// AÑADIR SERVICIO AL CARRITO
// ----------------------
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

// ----------------------
// CARGAR AGENDA
// ----------------------
async function cargarAgenda(fecha) {
  tbody.innerHTML = "";

  const q = query(collection(db,"citas"), where("fecha","==",fecha));
  const snap = await getDocs(q);
  const citas = snap.docs.map(d=>({ id:d.id, ...d.data() }));

  // Convertir citas a minutos para comparación exacta
  function horaAMinutos(h) {
    const [hh, mm] = h.split(":").map(Number);
    return hh*60 + mm;
  }

  HORAS.forEach(hora=>{
    let ocupado = false;
    let cita = null;

    citas.forEach(c=>{
      const serviciosCita = Array.isArray(c.servicios) ? c.servicios : [];
      const duracionTotal = serviciosCita.reduce((acc,s)=>acc + (s.duracion || 0),0);

      const inicioMin = horaAMinutos(c.hora);
      const horaMin = horaAMinutos(hora);
      if(horaMin >= inicioMin && horaMin < inicioMin + duracionTotal){
        ocupado = true;
        cita = c;
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
      <td>${cita?.clienteNombre || "-"}</td>
      <td>${cita ? (Array.isArray(cita.servicios) ? cita.servicios.map(s=>s.nombre).join(", ") : "-") : "-"}</td>
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

    // Drag & Drop
    tr.addEventListener("dragstart", e=>{
      if(cita && hora === cita.hora){
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

// ----------------------
// NUEVA CITA
// ----------------------
guardarCita.onclick = async ()=>{
  if(!horaSeleccionada) return alert("Selecciona una hora");

  // Verificar simultaneidad exacta por minutos
  const snap = await getDocs(query(collection(db,"citas"), where("fecha","==",fechaInput.value)));
  const citas = snap.docs.map(d=>({ id:d.id, ...d.data() }));

  function horaAMinutos(h) {
    const [hh, mm] = h.split(":").map(Number);
    return hh*60 + mm;
  }
  const inicioMin = horaAMinutos(horaSeleccionada);
  const duracionTotal = carrito.reduce((acc,s)=>acc + s.duracion,0);

  for(const c of citas){
    const cInicio = horaAMinutos(c.hora);
    const cDuracion = c.servicios?.reduce((acc,s)=>acc+s.duracion,0) || 0;
    const cFin = cInicio + cDuracion;

    const solapa = !(inicioMin + duracionTotal <= cInicio || inicioMin >= cFin);

    if(solapa && !simultaneoCheck.checked && !c.simultaneo){
      return alert(`No se puede agendar: se solapa con ${c.clienteNombre} a las ${c.hora}`);
    }
  }

  await addDoc(collection(db,"citas"),{
    fecha: fechaInput.value,
    hora: horaSeleccionada,
    clienteNombre: clienteNombre.value,
    servicios: carrito,
    simultaneo: simultaneoCheck.checked
  });

  modal.classList.remove("active");
  clienteNombre.value = "";
  carrito = [];
  actualizarCarrito();
  cargarAgenda(fechaInput.value);
};

// ----------------------
// CANCELAR MODAL
// ----------------------
cancelarModal.onclick = ()=> modal.classList.remove("active");
btnNuevaCita.onclick = ()=>{
  horaSeleccionada = null;
  clienteNombre.value = "";
  carrito = [];
  actualizarCarrito();
  modal.classList.add("active");
};

// ----------------------
// INIT
// ----------------------
document.addEventListener("DOMContentLoaded", async ()=>{
  fechaInput.value = hoyISO();
  await cargarServicios();
  cargarAgenda(fechaInput.value);
});

fechaInput.addEventListener("change", ()=> cargarAgenda(fechaInput.value));

// ----------------------
// OPCIONAL: actualizar agenda en tiempo real
// ----------------------
onSnapshot(collection(db,"citas"), snapshot => {
  cargarAgenda(fechaInput.value);
});

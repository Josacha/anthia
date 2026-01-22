import { db } from "./firebase.js";
import { collection, addDoc, setDoc, doc, getDocs, query, where, Timestamp, onSnapshot } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM
const formReserva = document.getElementById("formReserva");
const servicioSelect = document.getElementById("servicio");
const serviciosGrid = document.getElementById("serviciosGrid");
const carritoDiv = document.getElementById("carritoServicios");
const fechaInput = document.getElementById("fecha");
const horaSelect = document.getElementById("hora");
const recomendadosDiv = document.getElementById("horariosRecomendados");

const correoInput = document.getElementById("correo");
const telefonoInput = document.getElementById("telefono");
const nombreInput = document.getElementById("nombre");
const apellido1Input = document.getElementById("apellido1");
const apellido2Input = document.getElementById("apellido2");

const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

let carrito = [];
let duracionTotal = 0;

const horaAMinutos = h => {
  const [hh,mm] = h.split(":").map(Number);
  return hh*60+mm;
};

// SERVICIOS
async function cargarServicios(){
  servicioSelect.innerHTML = "";
  serviciosGrid.innerHTML = "";

  const snap = await getDocs(collection(db,"servicios"));

  snap.forEach(d=>{
    const s = d.data();

    const opt = document.createElement("option");
    opt.value = d.id;
    opt.dataset.duracion = s.duracion;
    opt.dataset.simultaneo = s.simultaneo;
    opt.textContent = s.nombre;
    servicioSelect.appendChild(opt);

    const card = document.createElement("div");
    card.className="servicio-card";
    card.innerHTML = `
      <h4>${s.nombre}</h4>
      <div class="meta">⏱ ${s.duracion} min</div>
      <div class="meta">₡${s.precio}</div>
    `;

    card.onclick = ()=>{
      servicioSelect.value = d.id;
      servicioSelect.dispatchEvent(new Event("change"));
      card.classList.add("active");
    };

    serviciosGrid.appendChild(card);
  });
}

// CARRITO
servicioSelect.addEventListener("change",()=>{
  const s = servicioSelect.selectedOptions[0];
  if(!s || carrito.some(c=>c.id===s.value)) return;

  const duracion = +s.dataset.duracion;
  carrito.push({id:s.value,nombre:s.textContent,duracion,simultaneo:s.dataset.simultaneo==="true"});
  duracionTotal+=duracion;

  renderCarrito();
  cargarHoras();
});

function renderCarrito(){
  carritoDiv.innerHTML="<h3>Servicios seleccionados</h3>";
  carrito.forEach((s,i)=>{
    const d=document.createElement("div");
    d.innerHTML=`${s.nombre} <button>✖</button>`;
    d.querySelector("button").onclick=()=>{
      duracionTotal-=s.duracion;
      carrito.splice(i,1);
      renderCarrito();
      cargarHoras();
    };
    carritoDiv.appendChild(d);
  });

  if(carrito.length)
    carritoDiv.innerHTML+=`<p>⏱ Duración total: <strong>${duracionTotal} min</strong></p>`;
}

// HORAS + RECOMENDADOS
async function cargarHoras(){
  horaSelect.innerHTML="<option value=''>Seleccione hora</option>";
  recomendadosDiv.innerHTML="";

  if(!fechaInput.value || !carrito.length) return;

  const citas = (await getDocs(collection(db,"citas")))
    .docs.map(d=>d.data());

  HORAS.forEach(h=>{
    const ini = horaAMinutos(h);
    const fin = ini+duracionTotal;

    const solapadas = citas.filter(c=>c.fecha===fechaInput.value &&
      !(fin<=horaAMinutos(c.hora)||ini>=horaAMinutos(c.hora)+c.duracion));

    if(solapadas.length<2){
      const o=document.createElement("option");
      o.value=o.textContent=h;
      horaSelect.appendChild(o);
    }
  });

  const rec=[...horaSelect.options].slice(1,4).map(o=>o.value);
  if(rec.length)
    recomendadosDiv.innerHTML=`⭐ Horarios recomendados: ${rec.join(" • ")}`;
}

fechaInput.onchange=cargarHoras;

// GUARDAR
formReserva.onsubmit=async e=>{
  e.preventDefault();
  if(!horaSelect.value||!carrito.length) return;

  const clienteId=(correoInput.value||telefonoInput.value).replace(/[.#$[\]]/g,"_");

  await setDoc(doc(db,"clientes",clienteId),{
    nombre:nombreInput.value,
    apellido1:apellido1Input.value,
    apellido2:apellido2Input.value,
    correo:correoInput.value,
    telefono:telefonoInput.value,
    actualizado:Timestamp.now()
  },{merge:true});

  for(const s of carrito){
    await addDoc(collection(db,"citas"),{
      clienteId,
      servicioId:s.id,
      fecha:fechaInput.value,
      hora:horaSelect.value,
      duracion:s.duracion,
      simultaneo:s.simultaneo,
      creado:Timestamp.now()
    });
  }

  alert("Cita reservada con éxito");
  formReserva.reset();
  carrito=[];
  duracionTotal=0;
  carritoDiv.innerHTML="";
  horaSelect.innerHTML="<option>Seleccione hora</option>";
};

document.addEventListener("DOMContentLoaded", cargarServicios);
onSnapshot(collection(db,"citas"), cargarHoras);

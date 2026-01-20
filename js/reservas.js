import { db } from "./firebase.js";
import { collection, getDocs, query, where, addDoc, doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const formReserva = document.getElementById("formReserva");
const correoInput = document.getElementById("correo");
const telefonoInput = document.getElementById("telefono");
const nombreInput = document.getElementById("nombre");
const apellido1Input = document.getElementById("apellido1");
const apellido2Input = document.getElementById("apellido2");
const servicioSelect = document.getElementById("servicio");
const fechaInput = document.getElementById("fecha");
const horaSelect = document.getElementById("hora");
const carritoDiv = document.getElementById("carritoServicios");

const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

let carrito = [];
let duracionTotal = 0;

// =======================
// Helpers para horas
// =======================
function horaAMinutos(horaStr) {
  const [h,m] = horaStr.split(":").map(Number);
  return h*60 + m;
}

function minutosAHora(minutos) {
  const h = Math.floor(minutos/60);
  const m = minutos % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

// =======================
// Autocompletar cliente
// =======================
async function autocompletarCliente(valor) {
  const clientesRef = collection(db, "clientes");
  let q = query(clientesRef, where("correo","==",valor));
  let snapshot = await getDocs(q);

  if(snapshot.empty){
    q = query(clientesRef, where("telefono","==",valor));
    snapshot = await getDocs(q);
  }

  if(!snapshot.empty){
    const cliente = snapshot.docs[0].data();
    nombreInput.value = cliente.nombre || "";
    apellido1Input.value = cliente.apellido1 || "";
    apellido2Input.value = cliente.apellido2 || "";
    correoInput.value = cliente.correo || "";
    telefonoInput.value = cliente.telefono || "";
  } else {
    nombreInput.value = "";
    apellido1Input.value = "";
    apellido2Input.value = "";
  }
}

correoInput.addEventListener("blur", ()=>autocompletarCliente(correoInput.value));
telefonoInput.addEventListener("blur", ()=>autocompletarCliente(telefonoInput.value));

// =======================
// Cargar servicios
// =======================
async function cargarServicios(){
  servicioSelect.innerHTML = '<option value="">Seleccione un servicio</option>';
  const snapshot = await getDocs(collection(db,"servicios"));
  snapshot.forEach(docSnap=>{
    const data = docSnap.data();
    const option = document.createElement("option");
    option.value = docSnap.id;
    option.dataset.duracion = data.duracion || 60; // duracion en minutos
    option.textContent = `${data.nombre} - ₡${data.precio} (${data.duracion} min)`;
    servicioSelect.appendChild(option);
  });
}

document.addEventListener("DOMContentLoaded", cargarServicios);

// =======================
// Carrito de servicios
// =======================
servicioSelect.addEventListener("change", ()=>{
  const selected = servicioSelect.selectedOptions[0];
  if(!selected || selected.value==="") return;
  if(carrito.some(s=>s.id===selected.value)) return;

  const duracion = parseInt(selected.dataset.duracion);
  carrito.push({ id: selected.value, nombre: selected.textContent, duracion });
  duracionTotal += duracion;

  renderCarrito();
  cargarHorasDisponibles();
});

function renderCarrito(){
  carritoDiv.innerHTML = `<h3>Carrito de servicios</h3>`;
  carrito.forEach((s,i)=>{
    const div = document.createElement("div");
    div.innerHTML = `<span>${s.nombre}</span> <button data-index="${i}">Eliminar</button>`;
    carritoDiv.appendChild(div);

    div.querySelector("button").addEventListener("click", ()=>{
      duracionTotal -= s.duracion;
      carrito.splice(i,1);
      renderCarrito();
      cargarHorasDisponibles();
    });
  });

  if(carrito.length>0){
    const total = document.createElement("p");
    total.textContent = `Duración total: ${duracionTotal} min`;
    carritoDiv.appendChild(total);
  }
}

// =======================
// Cargar horas disponibles según duración
// =======================
async function cargarHorasDisponibles(){
  horaSelect.innerHTML = '<option value="">Seleccione hora</option>';
  const fecha = fechaInput.value;
  if(!fecha || carrito.length===0) return;

  // Citas existentes
  const citasSnap = await getDocs(query(collection(db,"citas"), where("fecha","==",fecha)));
  const citas = citasSnap.docs.map(d=>({
    inicio: horaAMinutos(d.data().hora),
    duracion: d.data().duracion || 60 // min
  }));

  // Bloqueos existentes
  const bloqueosSnap = await getDocs(query(collection(db,"bloqueos"), where("fecha","==",fecha)));
  const bloqueos = bloqueosSnap.docs.map(d=>({
    inicio: horaAMinutos(d.data().hora),
    duracion: d.data().duracion || 60
  }));

  const duracionTotalMin = duracionTotal;

  HORAS.forEach(hora=>{
    const inicio = horaAMinutos(hora);
    const fin = inicio + duracionTotalMin;
    let disponible = true;

    for(let c of [...citas,...bloqueos]){
      const cFin = c.inicio + c.duracion;
      if(!(fin <= c.inicio || inicio >= cFin)){
        disponible = false;
        break;
      }
    }

    if(disponible){
      const option = document.createElement("option");
      option.value = hora;
      option.textContent = hora;
      horaSelect.appendChild(option);
    }
  });
}

fechaInput.addEventListener("change", cargarHorasDisponibles);

// =======================
// Guardar reserva
// =======================
formReserva.addEventListener("submit", async (e)=>{
  e.preventDefault();
  try{
    const clienteId = correoInput.value || telefonoInput.value;
    const clienteRef = doc(db,"clientes",clienteId);

    await setDoc(clienteRef,{
      nombre: nombreInput.value,
      apellido1: apellido1Input.value,
      apellido2: apellido2Input.value,
      correo: correoInput.value,
      telefono: telefonoInput.value,
      actualizado: Timestamp.now()
    }, { merge: true });

    // Guardar cada servicio
    let horaInicio = horaSelect.value;
    let horaMin = horaAMinutos(horaInicio);

    for(let s of carrito){
      await addDoc(collection(db,"citas"),{
        clienteId,
        servicioId: s.id,
        fecha: fechaInput.value,
        hora: minutosAHora(horaMin),
        duracion: s.duracion,
        creado: Timestamp.now()
      });
      horaMin += s.duracion;
    }

    alert("¡Cita reservada con éxito!");
    formReserva.reset();
    carrito = [];
    duracionTotal = 0;
    carritoDiv.innerHTML = "";
    horaSelect.innerHTML = '<option value="">Seleccione hora</option>';
  } catch(err){
    console.error(err);
    alert("Hubo un error al guardar la cita");
  }
});

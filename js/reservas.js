import { db } from "./firebase.js";
import { collection, addDoc, doc, setDoc, getDocs, query, where, Timestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// FORMULARIO
const formReserva = document.getElementById("formReserva");
const correoInput = document.getElementById("correo");
const telefonoInput = document.getElementById("telefono");
const nombreInput = document.getElementById("nombre");
const apellido1Input = document.getElementById("apellido1");
const apellido2Input = document.getElementById("apellido2");
const servicioSelect = document.getElementById("servicio");
const fechaInput = document.getElementById("fecha");
const horaSelect = document.getElementById("hora");

// Carrito
let carrito = [];
const heroFormulario = document.querySelector(".hero-formulario");

// ================================
// AUTOCOMPLETAR CLIENTE
// ================================
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

correoInput.addEventListener("blur", ()=> autocompletarCliente(correoInput.value));
telefonoInput.addEventListener("blur", ()=> autocompletarCliente(telefonoInput.value));

// ================================
// CARGAR SERVICIOS
// ================================
async function cargarServicios() {
  servicioSelect.innerHTML = '<option value="">Seleccione un servicio</option>';
  const serviciosRef = collection(db,"servicios");
  const snapshot = await getDocs(serviciosRef);
  snapshot.forEach(docSnap=>{
    const s = docSnap.data();
    const opt = document.createElement("option");
    opt.value = docSnap.id;
    opt.textContent = `${s.nombre} - ₡${s.precio} (${s.duracion || 60} min)`;
    opt.dataset.nombre = s.nombre;
    opt.dataset.duracion = s.duracion || 60;
    opt.dataset.precio = s.precio || 0;
    opt.dataset.simultaneo = s.simultaneo || false;
    servicioSelect.appendChild(opt);
  });
}

document.addEventListener("DOMContentLoaded", cargarServicios);

// ================================
// CARRITO VISUAL
// ================================
function renderCarrito() {
  let carritoContainer = document.getElementById("carritoServicios");
  if(!carritoContainer){
    carritoContainer = document.createElement("div");
    carritoContainer.id = "carritoServicios";
    carritoContainer.style.margin = "20px 0";
    carritoContainer.style.padding = "15px";
    carritoContainer.style.border = "1px solid #ddd";
    carritoContainer.style.borderRadius = "12px";
    heroFormulario.insertBefore(carritoContainer, formReserva.querySelector("hr"));
  }

  carritoContainer.innerHTML = "<h3>Servicios seleccionados</h3>";
  let totalMinutos = 0;
  let totalPrecio = 0;

  carrito.forEach((item, index)=>{
    totalMinutos += item.duracion;
    totalPrecio += item.precio;
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.marginBottom = "5px";
    div.innerHTML = `
      <span>${item.nombre} (${item.duracion} min) - ₡${item.precio}</span>
      <button type="button" data-index="${index}">❌</button>
    `;
    carritoContainer.appendChild(div);

    div.querySelector("button").addEventListener("click", ()=>{
      carrito.splice(index,1);
      renderCarrito();
    });
  });

  const resumen = document.createElement("p");
  resumen.style.fontWeight = "600";
  resumen.textContent = `Tiempo total: ${totalMinutos} min | Total ₡${totalPrecio}`;
  carritoContainer.appendChild(resumen);
}

// ================================
// AÑADIR SERVICIO AL CARRITO
// ================================
servicioSelect.addEventListener("change", ()=>{
  const selected = servicioSelect.selectedOptions[0];
  if(selected && selected.value){
    carrito.push({
      id: selected.value,
      nombre: selected.dataset.nombre,
      duracion: parseInt(selected.dataset.duracion),
      precio: parseInt(selected.dataset.precio),
      simultaneo: selected.dataset.simultaneo === "true"
    });
    renderCarrito();
    servicioSelect.value = "";
  }
});

// ================================
// CREAR RESERVA Y AGENDA
// ================================
formReserva.addEventListener("submit", async e=>{
  e.preventDefault();
  if(!fechaInput.value || !horaSelect.value || carrito.length===0) return alert("Complete todos los campos y agregue al menos un servicio");

  try{
    const clienteId = correoInput.value || telefonoInput.value;
    const clienteRef = doc(db,"clientes",clienteId);

    // Guardar o actualizar cliente
    await setDoc(clienteRef,{
      nombre: nombreInput.value,
      apellido1: apellido1Input.value,
      apellido2: apellido2Input.value,
      correo: correoInput.value,
      telefono: telefonoInput.value,
      actualizado: Timestamp.now()
    }, { merge:true });

    // Crear cita completa
    const nuevaCita = {
      clienteNombre: nombreInput.value,
      fecha: fechaInput.value,
      hora: horaSelect.value,
      servicios: carrito,
      simultaneo: carrito.every(s=>s.simultaneo),
      publico: true,
      creado: Timestamp.now()
    };

    await addDoc(collection(db,"citas"), nuevaCita);

    alert("¡Cita reservada y añadida a la agenda!");
    formReserva.reset();
    carrito = [];
    renderCarrito();
    horaSelect.innerHTML = '<option value="">Seleccione una hora</option>';

  } catch(error){
    console.error("Error al crear reserva:", error);
    alert("Hubo un error al guardar la cita. Intente nuevamente.");
  }
});

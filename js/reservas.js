import { db } from "./firebase.js";
import { collection, getDocs, query, where, addDoc, doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ----------------------
// ELEMENTOS DEL DOM
// ----------------------
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

// ----------------------
// HORAS DISPONIBLES
// ----------------------
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

let carrito = [];
let duracionTotal = 0;

// ----------------------
// AUTOCOMPLETAR CLIENTE
// ----------------------
async function autocompletarCliente(valor) {
  if (!valor) return;

  const clientesRef = collection(db, "clientes");

  let q = query(clientesRef, where("correo", "==", valor));
  let snapshot = await getDocs(q);

  if (snapshot.empty) {
    q = query(clientesRef, where("telefono", "==", valor));
    snapshot = await getDocs(q);
  }

  if (!snapshot.empty) {
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

correoInput.addEventListener("blur", () => autocompletarCliente(correoInput.value));
telefonoInput.addEventListener("blur", () => autocompletarCliente(telefonoInput.value));

// ----------------------
// CARGAR SERVICIOS
// ----------------------
async function cargarServicios() {
  servicioSelect.innerHTML = '<option value="">Seleccione un servicio</option>';
  const serviciosRef = collection(db, "servicios");
  const snapshot = await getDocs(serviciosRef);

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const option = document.createElement("option");
    option.value = docSnap.id;
    option.dataset.duracion = data.duracion || 1; // duración en horas
    option.textContent = `${data.nombre} - ₡${data.precio} (${data.duracion}h)`;
    servicioSelect.appendChild(option);
  });
}

document.addEventListener("DOMContentLoaded", cargarServicios);

// ----------------------
// CARRITO DE SERVICIOS
// ----------------------
servicioSelect.addEventListener("change", () => {
  const selected = servicioSelect.selectedOptions[0];
  if (!selected || selected.value === "") return;
  if (carrito.some(s => s.id === selected.value)) return;

  const duracion = parseInt(selected.dataset.duracion);
  carrito.push({ id: selected.value, nombre: selected.textContent, duracion });
  duracionTotal += duracion;

  renderCarrito();
  cargarHorasDisponibles();
});

function renderCarrito() {
  carritoDiv.innerHTML = `<h3>Carrito de servicios</h3>`;
  carrito.forEach((s, i) => {
    const div = document.createElement("div");
    div.innerHTML = `<span>${s.nombre}</span> <button data-index="${i}">Eliminar</button>`;
    carritoDiv.appendChild(div);

    div.querySelector("button").addEventListener("click", () => {
      duracionTotal -= s.duracion;
      carrito.splice(i, 1);
      renderCarrito();
      cargarHorasDisponibles();
    });
  });

  if (carrito.length > 0) {
    const total = document.createElement("p");
    total.textContent = `Duración total: ${duracionTotal}h`;
    carritoDiv.appendChild(total);
  }
}

// ----------------------
// HORAS DISPONIBLES
// ----------------------
async function cargarHorasDisponibles() {
  horaSelect.innerHTML = '<option value="">Seleccione hora</option>';
  const fecha = fechaInput.value;
  if (!fecha || carrito.length === 0) return;

  const citasRef = collection(db, "citas");
  const qCitas = query(citasRef, where("fecha", "==", fecha));
  const snapshotCitas = await getDocs(qCitas);
  const citas = snapshotCitas.docs.map(d => ({ hora: d.data().hora, duracion: d.data().duracion || 1 }));

  const bloqueosRef = collection(db, "bloqueos");
  const qBloqueos = query(bloqueosRef, where("fecha", "==", fecha));
  const snapshotBloqueos = await getDocs(qBloqueos);
  const bloqueos = snapshotBloqueos.docs.map(d => ({ hora: d.data().hora, duracion: d.data().duracion || 1 }));

  HORAS.forEach((hora, index) => {
    let disponible = true;
    for (let i = 0; i < duracionTotal; i++) {
      const idx = index + i;
      if (idx >= HORAS.length) { disponible = false; break; }
      const horaCheck = HORAS[idx];
      if (citas.some(c => c.hora === horaCheck) || bloqueos.some(b => b.hora === horaCheck)) {
        disponible = false;
        break;
      }
    }

    if (disponible) {
      const option = document.createElement("option");
      option.value = hora;
      option.textContent = hora;
      horaSelect.appendChild(option);
    }
  });
}

fechaInput.addEventListener("change", cargarHorasDisponibles);

// ----------------------
// GUARDAR RESERVA
// ----------------------
formReserva.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!correoInput.value && !telefonoInput.value) {
    return alert("Debe ingresar al menos un correo o un teléfono");
  }

  try {
    // Usar correo si existe, sino telefono como ID
    const clienteId = correoInput.value || telefonoInput.value;
    const clienteRef = doc(db, "clientes", clienteId);

    await setDoc(clienteRef, {
      nombre: nombreInput.value,
      apellido1: apellido1Input.value,
      apellido2: apellido2Input.value,
      correo: correoInput.value,
      telefono: telefonoInput.value,
      actualizado: Timestamp.now()
    }, { merge: true });

    // Guardar citas
    let horaInicio = horaSelect.value;
    if (!horaInicio) return alert("Debe seleccionar una hora");

    let horaIndex = HORAS.indexOf(horaInicio);

    for (let s of carrito) {
      await addDoc(collection(db, "citas"), {
        clienteId,
        servicioId: s.id,
        fecha: fechaInput.value,
        hora: HORAS[horaIndex],
        duracion: s.duracion,
        creado: Timestamp.now()
      });
      horaIndex += s.duracion;
    }

    alert("¡Cita reservada con éxito!");
    formReserva.reset();
    carrito = [];
    duracionTotal = 0;
    carritoDiv.innerHTML = "";
    horaSelect.innerHTML = '<option value="">Seleccione hora</option>';

  } catch (error) {
    console.error(error);
    alert("Hubo un error al guardar la cita");
  }
});

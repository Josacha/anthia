import { db } from "./firebase.js";
import { collection, getDocs, query, where, addDoc, doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =======================
// ELEMENTOS DEL DOM
// =======================
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

// HORAS DE RESERVA (intervalos de 30 min para mayor precisión)
const HORAS = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30","18:00"
];

let carrito = [];
let duracionTotal = 0; // en minutos

// =======================
// AUTOCOMPLETAR CLIENTE
// =======================
async function autocompletarCliente(valor) {
  if (!valor) return; // si no hay valor, no hace nada
  const clientesRef = collection(db, "clientes");
  
  // buscar por correo
  let q = query(clientesRef, where("correo", "==", valor));
  let snapshot = await getDocs(q);

  // si no encuentra, buscar por teléfono
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

// =======================
// CARGAR SERVICIOS
// =======================
async function cargarServicios() {
  servicioSelect.innerHTML = '<option value="">Seleccione un servicio</option>';
  const serviciosRef = collection(db, "servicios");
  const snapshot = await getDocs(serviciosRef);

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const option = document.createElement("option");
    option.value = docSnap.id;
    option.dataset.duracion = data.duracion || 60; // duración en minutos
    option.textContent = `${data.nombre} - ₡${data.precio} (${data.duracion} min)`;
    servicioSelect.appendChild(option);
  });
}

document.addEventListener("DOMContentLoaded", cargarServicios);

// =======================
// CARRITO DE SERVICIOS
// =======================
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
    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.marginBottom = "5px";
    div.innerHTML = `<span>${s.nombre} (${s.duracion} min)</span> <button data-index="${i}">Eliminar</button>`;
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
    total.textContent = `Duración total: ${duracionTotal} min`;
    carritoDiv.appendChild(total);
  }
}

// =======================
// CARGAR HORAS DISPONIBLES
// =======================
async function cargarHorasDisponibles() {
  horaSelect.innerHTML = '<option value="">Seleccione hora</option>';
  const fecha = fechaInput.value;
  if (!fecha || carrito.length === 0) return;

  // Traer citas existentes
  const citasRef = collection(db, "citas");
  const qCitas = query(citasRef, where("fecha", "==", fecha));
  const snapshotCitas = await getDocs(qCitas);
  const citas = snapshotCitas.docs.map(d => {
    return { hora: d.data().hora, duracion: d.data().duracion || 60 };
  });

  // Traer bloqueos existentes
  const bloqueosRef = collection(db, "bloqueos");
  const qBloqueos = query(bloqueosRef, where("fecha", "==", fecha));
  const snapshotBloqueos = await getDocs(qBloqueos);
  const bloqueos = snapshotBloqueos.docs.map(d => {
    return { hora: d.data().hora, duracion: d.data().duracion || 60 };
  });

  HORAS.forEach((hora, index) => {
    let disponible = true;

    // calcular rango de tiempo requerido por la cita en minutos
    let minutosNecesarios = duracionTotal;
    let i = index;

    while (minutosNecesarios > 0 && i < HORAS.length) {
      const horaCheck = HORAS[i];

      if (citas.some(c => c.hora === horaCheck) || bloqueos.some(b => b.hora === horaCheck)) {
        disponible = false;
        break;
      }

      // cada bloque HORAS representa 30 min
      minutosNecesarios -= 30;
      i++;
    }

    if (disponible && minutosNecesarios <= 0) {
      const option = document.createElement("option");
      option.value = hora;
      option.textContent = hora;
      horaSelect.appendChild(option);
    }
  });
}

fechaInput.addEventListener("change", cargarHorasDisponibles);

// =======================
// GUARDAR RESERVA
// =======================
formReserva.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!horaSelect.value) return alert("Selecciona una hora disponible");

  try {
    const clienteId = correoInput.value || telefonoInput.value || Timestamp.now().toMillis().toString();
    const clienteRef = doc(db, "clientes", clienteId);

    await setDoc(clienteRef, {
      nombre: nombreInput.value,
      apellido1: apellido1Input.value,
      apellido2: apellido2Input.value,
      correo: correoInput.value,
      telefono: telefonoInput.value,
      actualizado: Timestamp.now()
    }, { merge: true });

    // Guardar cada servicio en citas
    let horaIndex = HORAS.indexOf(horaSelect.value);
    let minutosRestantes = 0;

    for (let s of carrito) {
      await addDoc(collection(db, "citas"), {
        clienteId,
        servicioId: s.id,
        fecha: fechaInput.value,
        hora: HORAS[horaIndex],
        duracion: s.duracion,
        creado: Timestamp.now()
      });

      // avanzar bloques de 30 min
      minutosRestantes = s.duracion;
      while (minutosRestantes > 0) {
        horaIndex++;
        minutosRestantes -= 30;
      }
    }

    alert("¡Cita reservada con éxito!");
    formReserva.reset();
    carrito = [];
    duracionTotal = 0;
    carritoDiv.innerHTML = "";
    horaSelect.innerHTML = '<option value="">Seleccione hora</option>';

  } catch (error) {
    console.error(error);
    alert("Hubo un error al guardar la cita. Revisa permisos de Firestore");
  }
});

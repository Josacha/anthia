import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  setDoc,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =====================
// DOM
// =====================
const formReserva = document.getElementById("formReserva");
const correoInput = document.getElementById("correo");
const telefonoInput = document.getElementById("telefono");
const nombreInput = document.getElementById("nombre");
const apellido1Input = document.getElementById("apellido1");
const apellido2Input = document.getElementById("apellido2");
const servicioSelect = document.getElementById("servicio");
const fechaInput = document.getElementById("fecha"); // INPUT REAL (OCULTO)
const horaSelect = document.getElementById("hora");
const carritoDiv = document.getElementById("carritoServicios");
const calendarioDiv = document.getElementById("calendarioSemanal");


// =====================
// HORAS DISPONIBLES
// =====================
const HORA_APERTURA = "08:00";
const HORA_CIERRE = "18:00";
const INTERVALO_MINUTOS = 15;


let carrito = [];
let duracionTotal = 0;

// =====================
// UTILIDADES
// =====================
function horaAMinutos(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function fechaISO(date) {
  return date.toISOString().split("T")[0];
}


// =====================
// bloques
// =====================

function generarBloquesHorarios() {
  const bloques = [];

  let inicio = horaAMinutos(HORA_APERTURA);
  const fin = horaAMinutos(HORA_CIERRE);

  while (inicio + duracionTotal <= fin) {
    const h = Math.floor(inicio / 60).toString().padStart(2, "0");
    const m = (inicio % 60).toString().padStart(2, "0");
    bloques.push(`${h}:${m}`);
    inicio += INTERVALO_MINUTOS;
  }

  return bloques;
}


// =====================
// AUTOCOMPLETAR CLIENTE
// =====================
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
  }
}

correoInput.addEventListener("blur", () => autocompletarCliente(correoInput.value));
telefonoInput.addEventListener("blur", () => autocompletarCliente(telefonoInput.value));

// =====================
// CARGAR SERVICIOS
// =====================
async function cargarServicios() {
  servicioSelect.innerHTML = '<option value="">Seleccione un servicio</option>';

  const snapshot = await getDocs(collection(db, "servicios"));
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const option = document.createElement("option");
    option.value = docSnap.id;
    option.dataset.duracion = data.duracion || 60;
    option.textContent = `${data.nombre} - ₡${data.precio} (${data.duracion} min)`;
    servicioSelect.appendChild(option);
  });
}

document.addEventListener("DOMContentLoaded", cargarServicios);

// =====================
// CARRITO DE SERVICIOS
// =====================
servicioSelect.addEventListener("change", () => {
  const selected = servicioSelect.selectedOptions[0];
  if (!selected || !selected.value) return;
  if (carrito.some(s => s.id === selected.value)) return;

  const duracion = parseInt(selected.dataset.duracion);

  carrito.push({
    id: selected.value,
    nombre: selected.textContent,
    duracion
  });

  duracionTotal += duracion;
  renderCarrito();
  cargarHorasDisponibles();
});

function renderCarrito() {
  carritoDiv.innerHTML = "<h3>Servicios seleccionados</h3>";

  carrito.forEach((s, i) => {
    const div = document.createElement("div");
    div.innerHTML = `
      <span>${s.nombre}</span>
      <button>Eliminar</button>
    `;
    div.querySelector("button").onclick = () => {
      duracionTotal -= s.duracion;
      carrito.splice(i, 1);
      renderCarrito();
      cargarHorasDisponibles();
    };
    carritoDiv.appendChild(div);
  });

  if (carrito.length) {
    const p = document.createElement("p");
    p.textContent = `Duración total: ${duracionTotal} min`;
    carritoDiv.appendChild(p);
  }
}

// =====================
// HORAS DISPONIBLES
// =====================
// =====================
// HORAS DISPONIBLES (CORREGIDO CON SIMULTANEIDAD)
// =====================
async function cargarHorasDisponibles() {
  horaSelect.innerHTML = '<option value="">Seleccione hora</option>';
  if (!fechaInput.value || carrito.length === 0) return;

  const snapshot = await getDocs(collection(db, "citas"));
  const citas = snapshot.docs.map(d => d.data());

  const bloques = generarBloquesHorarios();

  const nuevoPermiteSimultaneo = carrito.every(
    s => s.permiteSimultaneidad !== false
  );

  for (const hora of bloques) {
    const inicio = horaAMinutos(hora);
    const fin = inicio + duracionTotal;

    const citasEnRango = citas.filter(c => {
      if (c.fecha !== fechaInput.value) return false;
      const ci = horaAMinutos(c.hora);
      const cf = ci + c.duracion;
      return !(fin <= ci || inicio >= cf);
    });

    let disponible = true;

    // 1️⃣ Si existe UNA NO simultánea → nadie entra
    if (citasEnRango.some(c => c.permiteSimultaneidad === false)) {
      disponible = false;
    }

    // 2️⃣ Si el nuevo NO permite simultaneidad
    //    el campo debe estar TOTALMENTE vacío
    if (disponible && !nuevoPermiteSimultaneo && citasEnRango.length > 0) {
      disponible = false;
    }

    // 3️⃣ Si el nuevo SÍ permite simultaneidad
    if (disponible && nuevoPermiteSimultaneo) {
      // máximo 2
      if (citasEnRango.length >= 2) {
        disponible = false;
      }

      // todas las existentes deben permitir simultaneidad
      if (
        citasEnRango.some(c => c.permiteSimultaneidad === false)
      ) {
        disponible = false;
      }
    }

    if (disponible) {
      const opt = document.createElement("option");
      opt.value = hora;
      opt.textContent = hora;
      horaSelect.appendChild(opt);
    }
  }
}


// =====================
// GUARDAR CITA
// =====================
formReserva.addEventListener("submit", async e => {
  e.preventDefault();

  if (!fechaInput.value || !horaSelect.value || carrito.length === 0)
    return alert("Seleccione fecha, hora y servicios");

  const clienteId = (correoInput.value || telefonoInput.value || Date.now())
    .replace(/[.#$[\]]/g, "_");

  await setDoc(
    doc(db, "clientes", clienteId),
    {
      nombre: nombreInput.value,
      apellido1: apellido1Input.value,
      apellido2: apellido2Input.value,
      correo: correoInput.value,
      telefono: telefonoInput.value,
      actualizado: Timestamp.now()
    },
    { merge: true }
  );

  for (const s of carrito) {
    await addDoc(collection(db, "citas"), {
      clienteId,
      servicioId: s.id,
      fecha: fechaInput.value,
      hora: horaSelect.value,
      duracion: s.duracion,
      creado: Timestamp.now()
    });
  }

  alert("¡Cita reservada!");
  formReserva.reset();
  carrito = [];
  duracionTotal = 0;
  carritoDiv.innerHTML = "";
  horaSelect.innerHTML = '<option value="">Seleccione hora</option>';
});

// =====================
// CALENDARIO SEMANAL (LO ÚNICO NUEVO)
// =====================
function generarCalendarioSemanal() {
  if (!calendarioDiv) return;
  calendarioDiv.innerHTML = "";

  const hoy = new Date();
  hoy.setHours(0,0,0,0);

  let cursor = new Date(hoy);
  let mostrados = 0;

  while (mostrados < 7) {
    const fecha = new Date(cursor);
    const esDomingo = fecha.getDay() === 0;

    if (fecha >= hoy) {
      const div = document.createElement("div");
      div.className = "dia-cal";
      if (esDomingo) div.classList.add("bloqueado");

      div.innerHTML = `
        <div class="nombre">${fecha.toLocaleDateString("es-CR",{weekday:"short"})}</div>
        <div class="numero">${fecha.getDate()}</div>
      `;

      if (!esDomingo) {
        div.onclick = () => {
          document.querySelectorAll(".dia-cal")
            .forEach(d => d.classList.remove("activo"));

          div.classList.add("activo");
          fechaInput.value = fechaISO(fecha);
          cargarHorasDisponibles();
        };
      }

      calendarioDiv.appendChild(div);
      mostrados++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
}

document.addEventListener("DOMContentLoaded", generarCalendarioSemanal);

async function renderServiciosCards() {
  const contenedor = document.getElementById("serviciosCards");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  const snapshot = await getDocs(collection(db, "servicios"));

  snapshot.forEach(docSnap => {
    const s = docSnap.data();

    const card = document.createElement("div");
    card.className = "servicio-card";
    card.innerHTML = `
      <strong>${s.nombre}</strong>
      <div>${s.duracion} min</div>
      <div>₡${s.precio}</div>
    `;

    card.onclick = () => {
      servicioSelect.value = docSnap.id;
      servicioSelect.dispatchEvent(new Event("change"));

      document.querySelectorAll(".servicio-card")
        .forEach(c => c.classList.remove("activo"));

      card.classList.add("activo");
    };

    contenedor.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", renderServiciosCards);


// =====================
// ACTUALIZAR HORAS EN TIEMPO REAL
// =====================
onSnapshot(collection(db, "citas"), () => cargarHorasDisponibles());

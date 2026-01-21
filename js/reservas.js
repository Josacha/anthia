import { db } from "./firebase.js";
import { collection, getDocs, query, where, addDoc, doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ELEMENTOS DEL DOM
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

// HORAS DISPONIBLES
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
    option.dataset.simultaneo = data.simultaneo || false;
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
  const simultaneo = selected.dataset.simultaneo === "true";

  carrito.push({ id: selected.value, nombre: selected.textContent, duracion, simultaneo });
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
// HORAS DISPONIBLES SEGÚN AGENDA
// ----------------------
async function cargarHorasDisponibles() {
  horaSelect.innerHTML = '<option value="">Seleccione hora</option>';
  const fecha = fechaInput.value;
  if (!fecha || carrito.length === 0) return;

  // Citas existentes
  const citasRef = collection(db, "citas");
  const qCitas = query(citasRef, where("fecha", "==", fecha));
  const snapshotCitas = await getDocs(qCitas);
  const citas = snapshotCitas.docs.map(d => d.data());

  HORAS.forEach((hora, index) => {
    let disponible = true;

    for (let i = 0; i < duracionTotal; i++) {
      const idx = index + i;
      if (idx >= HORAS.length) { disponible = false; break; }
      const horaCheck = HORAS[idx];

      // Revisar conflicto con citas existentes
      for (const cita of citas) {
        const horaCitaIndex = HORAS.indexOf(cita.hora);
        const duracionCita = cita.servicios.reduce((acc,s)=>acc+s.duracion,0);
        const bloquesCita = [];
        for (let j=0;j<duracionCita;j++) bloquesCita.push(HORAS[horaCitaIndex+j]);

        // Si hay conflicto y ninguno de los servicios nuevos permite simultaneidad
        if (bloquesCita.includes(horaCheck) && !carrito.some(s=>s.simultaneo)) {
          disponible = false;
          break;
        }
      }

      if (!disponible) break;
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

  if (!fechaInput.value || !horaSelect.value || carrito.length === 0) {
    return alert("Seleccione fecha, hora y servicio(s).");
  }

  try {
    // Crear ID válido para cliente
    const clienteId = (correoInput.value || telefonoInput.value || "cliente_" + Date.now())
                        .replace(/[.#$[\]]/g,'_');
    const clienteRef = doc(db, "clientes", clienteId);

    await setDoc(clienteRef, {
      nombre: nombreInput.value,
      apellido1: apellido1Input.value,
      apellido2: apellido2Input.value,
      correo: correoInput.value,
      telefono: telefonoInput.value,
      actualizado: Timestamp.now()
    }, { merge: true });

    // Guardar cada servicio
    let horaIndex = HORAS.indexOf(horaSelect.value);
    for (const s of carrito) {
      await addDoc(collection(db, "citas"), {
        clienteId,
        servicioId: s.id,
        fecha: fechaInput.value,
        hora: HORAS[horaIndex],
        duracion: s.duracion,
        simultaneo: s.simultaneo,
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
    alert("Hubo un error al guardar la cita. Ver consola.");
  }
});

import { db } from "./firebase.js";
import { collection, addDoc, doc, setDoc, getDocs, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const formReserva = document.getElementById("formReserva");
const correoInput = document.getElementById("correo");
const telefonoInput = document.getElementById("telefono");
const nombreInput = document.getElementById("nombre");
const apellido1Input = document.getElementById("apellido1");
const apellido2Input = document.getElementById("apellido2");
const servicioSelect = document.getElementById("servicio");
const fechaInput = document.getElementById("fecha");
const horaSelect = document.getElementById("hora");

// Horas estándar del día
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

// ================================
// AUTOCOMPLETAR CLIENTE
// ================================
async function autocompletarCliente(valor) {
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

// ================================
// CARGAR SERVICIOS DESDE FIRESTORE
// ================================
async function cargarServicios() {
  servicioSelect.innerHTML = '<option value="">Seleccione un servicio</option>';
  const serviciosRef = collection(db, "servicios");
  const snapshot = await getDocs(serviciosRef);

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const option = document.createElement("option");
    option.value = docSnap.id;
    option.textContent = `${data.nombre} - ₡${data.precio}`;
    servicioSelect.appendChild(option);
  });
}

document.addEventListener("DOMContentLoaded", cargarServicios);

// ================================
// CARGAR HORAS DISPONIBLES
// ================================
async function cargarHorasDisponibles() {
  horaSelect.innerHTML = '<option value="">Seleccione hora</option>';
  const fecha = fechaInput.value;
  if (!fecha) return;

  // Obtener citas y bloqueos de la fecha
  const citasRef = collection(db, "citas");
  const qCitas = query(citasRef, where("fecha", "==", fecha));
  const snapshotCitas = await getDocs(qCitas);

  const citas = snapshotCitas.docs.map(d => d.data());

  const bloqueosRef = collection(db, "bloqueos");
  const qBloqueos = query(bloqueosRef, where("fecha", "==", fecha));
  const snapshotBloqueos = await getDocs(qBloqueos);
  const bloqueos = snapshotBloqueos.docs.map(d => d.data());

  HORAS.forEach(hora => {
    const ocupada = citas.some(c => c.hora === hora) || bloqueos.some(b => b.hora === hora);
    if (!ocupada) {
      const option = document.createElement("option");
      option.value = hora;
      option.textContent = hora;
      horaSelect.appendChild(option);
    }
  });
}

fechaInput.addEventListener("change", cargarHorasDisponibles);

// ================================
// CREAR RESERVA
// ================================
formReserva.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
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

    await addDoc(collection(db, "citas"), {
      servicioId: servicioSelect.value,
      fecha: fechaInput.value,
      hora: horaSelect.value,
      clienteId,
      creado: Timestamp.now()
    });

    alert("¡Cita reservada con éxito!");
    formReserva.reset();
    horaSelect.innerHTML = '<option value="">Seleccione hora</option>';

    window.location.href = "confirmar.html";

  } catch (error) {
    console.error("Error al crear la reserva:", error);
    alert("Hubo un error al guardar la cita. Intente nuevamente.");
  }
});

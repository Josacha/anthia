import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =====================
// ELEMENTOS DEL DOM
// =====================
const form = document.getElementById("formReserva");
const servicioSelect = document.getElementById("servicio");
const fechaInput = document.getElementById("fecha");
const horaSelect = document.getElementById("hora");

const correoInput = document.getElementById("correo");
const telefonoInput = document.getElementById("telefono");
const nombreInput = document.getElementById("nombre");
const apellido1Input = document.getElementById("apellido1");
const apellido2Input = document.getElementById("apellido2");

// =====================
// CARGAR SERVICIOS DESDE FIRESTORE
// =====================
async function cargarServicios() {
  const serviciosCol = collection(db, "servicios");
  const snapshot = await getDocs(serviciosCol);
  snapshot.forEach(doc => {
    const data = doc.data();
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = `${data.nombre} (${data.duracion} min)`;
    servicioSelect.appendChild(option);
  });
}
cargarServicios();

// =====================
// AUTOCOMPLETADO CLIENTE
// =====================
async function autocompletarCliente() {
  const correo = correoInput.value.trim();
  const telefono = telefonoInput.value.trim();

  let clienteData = null;

  if (correo) {
    const q = query(collection(db, "clientes"), where("correo", "==", correo));
    const snap = await getDocs(q);
    if (!snap.empty) clienteData = snap.docs[0].data();
  }

  if (!clienteData && telefono) {
    const q2 = query(collection(db, "clientes"), where("telefono", "==", telefono));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) clienteData = snap2.docs[0].data();
  }

  if (clienteData) {
    nombreInput.value = clienteData.nombre;
    apellido1Input.value = clienteData.apellido1;
    apellido2Input.value = clienteData.apellido2 || "";
    correoInput.value = clienteData.correo;
    telefonoInput.value = clienteData.telefono;
  }
}

correoInput.addEventListener("input", autocompletarCliente);
telefonoInput.addEventListener("input", autocompletarCliente);

// =====================
// GENERAR HORAS DISPONIBLES
// =====================
function cargarHorasDisponibles() {
  horaSelect.innerHTML = '<option value="">Seleccione una hora</option>';
  const startHour = 9;
  const endHour = 18;

  for (let h = startHour; h <= endHour; h++) {
    const horaStr = `${h.toString().padStart(2, "0")}:00`;
    const option = document.createElement("option");
    option.value = horaStr;
    option.textContent = horaStr;
    horaSelect.appendChild(option);
  }
}
fechaInput.addEventListener("change", cargarHorasDisponibles);

// =====================
// ENVIAR FORMULARIO
// =====================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // DATOS DEL CLIENTE
  const cliente = {
    nombre: nombreInput.value.trim(),
    apellido1: apellido1Input.value.trim(),
    apellido2: apellido2Input.value.trim(),
    correo: correoInput.value.trim(),
    telefono: telefonoInput.value.trim()
  };

  // DATOS DE LA CITA
  const cita = {
    servicioId: servicioSelect.value,
    fecha: fechaInput.value,
    hora: horaSelect.value,
    clienteCorreo: cliente.correo,
    clienteTelefono: cliente.telefono,
    timestamp: Timestamp.now()
  };

  try {
    // =====================
    // GUARDAR CLIENTE (SI NO EXISTE)
    // =====================
    const clientesCol = collection(db, "clientes");

    let q = query(clientesCol, where("correo", "==", cliente.correo));
    let snap = await getDocs(q);

    if (snap.empty) {
      q = query(clientesCol, where("telefono", "==", cliente.telefono));
      snap = await getDocs(q);
    }

    if (snap.empty) {
      // No existe → crear
      await addDoc(clientesCol, cliente);
    }

    // =====================
    // GUARDAR CITA
    // =====================
    const citasCol = collection(db, "citas");

    // OPCIONAL: revisar duplicados en la misma fecha/hora y servicio
    const qCita = query(
      citasCol,
      where("fecha", "==", cita.fecha),
      where("hora", "==", cita.hora),
      where("servicioId", "==", cita.servicioId)
    );
    const snapCita = await getDocs(qCita);
    if (!snapCita.empty) {
      alert("La hora seleccionada ya está ocupada. Elige otra.");
      return;
    }

    await addDoc(citasCol, cita);

    // =====================
    // MENSAJE DE ÉXITO
    // =====================
    alert("Cita registrada con éxito!");
    form.reset();
    horaSelect.innerHTML = '<option value="">Seleccione una hora</option>';

  } catch (error) {
    console.error("Error guardando cita:", error);
    alert("Hubo un error al guardar la cita.");
  }
});

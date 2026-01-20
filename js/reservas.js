import { db } from "./firebase.js";
import { collection, addDoc, doc, getDoc, setDoc, Timestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const formReserva = document.getElementById("formReserva");
const correoInput = document.getElementById("correo");
const telefonoInput = document.getElementById("telefono");
const nombreInput = document.getElementById("nombre");
const apellido1Input = document.getElementById("apellido1");
const apellido2Input = document.getElementById("apellido2");
const servicioSelect = document.getElementById("servicio");
const fechaInput = document.getElementById("fecha");
const horaSelect = document.getElementById("hora");

// ================================
// AUTOCOMPLETAR CLIENTE
// ================================
async function autocompletarCliente(valor) {
  const clientesRef = collection(db, "clientes");
  
  // Buscar por correo
  let q = query(clientesRef, where("correo", "==", valor));
  let snapshot = await getDocs(q);

  if (snapshot.empty) {
    // Si no hay por correo, buscar por teléfono
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
    // Limpiar campos excepto correo/teléfono
    nombreInput.value = "";
    apellido1Input.value = "";
    apellido2Input.value = "";
  }
}

// Eventos autocompletar
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
    option.value = docSnap.id; // guardar el id del servicio
    option.textContent = `${data.nombre} - ₡${data.precio}`;
    servicioSelect.appendChild(option);
  });
}

// Llamar al cargar la página
document.addEventListener("DOMContentLoaded", cargarServicios);

// ================================
// CREAR RESERVA
// ================================
formReserva.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    // Crear/actualizar cliente en Firestore
    const clienteId = correoInput.value || telefonoInput.value; // ID único
    const clienteRef = doc(db, "clientes", clienteId);

    await setDoc(clienteRef, {
      nombre: nombreInput.value,
      apellido1: apellido1Input.value,
      apellido2: apellido2Input.value,
      correo: correoInput.value,
      telefono: telefonoInput.value,
      actualizado: Timestamp.now()
    }, { merge: true });

    // Crear la cita
    await addDoc(collection(db, "citas"), {
      servicioId: servicioSelect.value,
      fecha: fechaInput.value,
      hora: horaSelect.value,
      clienteId: clienteId,
      creado: Timestamp.now()
    });

    alert("¡Cita reservada con éxito!");
    formReserva.reset();

    // Redirigir a confirmar
    window.location.href = "confirmar.html";

  } catch (error) {
    console.error("Error al crear la reserva:", error);
    alert("Hubo un error al guardar la cita. Intente nuevamente.");
  }
});

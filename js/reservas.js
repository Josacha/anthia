import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ELEMENTOS
const servicioSelect = document.getElementById("servicio");
const fechaInput = document.getElementById("fecha");
const horaSelect = document.getElementById("hora");
const form = document.getElementById("formReserva");

const contactoInput = document.getElementById("contacto");
const nombreInput = document.getElementById("nombre");
const apellido1Input = document.getElementById("apellido1");
const apellido2Input = document.getElementById("apellido2");

let servicioActual = null;

// ===============================
// CARGAR SERVICIOS
// ===============================
async function cargarServicios() {
  servicioSelect.innerHTML = `<option value="">Seleccione un servicio</option>`;

  const snapshot = await getDocs(collection(db, "servicios"));
  snapshot.forEach(docSnap => {
    const s = docSnap.data();
    if (s.activo) {
      servicioSelect.innerHTML += `
        <option value="${docSnap.id}">
          ${s.nombre}
        </option>`;
    }
  });
}

// ===============================
// OBTENER SERVICIO SELECCIONADO
// ===============================
async function obtenerServicio() {
  if (!servicioSelect.value) return;

  const ref = doc(db, "servicios", servicioSelect.value);
  const snap = await getDoc(ref);

  servicioActual = snap.data();
}

// ===============================
// GENERAR HORAS DISPONIBLES
// ===============================
async function generarHoras() {
  horaSelect.innerHTML = `<option value="">Seleccione una hora</option>`;

  if (!fechaInput.value || !servicioActual) return;

  const horaInicioSalon = 9;
  const horaFinSalon = 18;

  for (let h = horaInicioSalon; h < horaFinSalon; h++) {
    const hora = `${h.toString().padStart(2, "0")}:00`;

    const q = query(
      collection(db, "citas"),
      where("fecha", "==", fechaInput.value),
      where("horaInicio", "==", hora)
    );

    const snapshot = await getDocs(q);

    // 👇 LÓGICA CLAVE
    if (servicioActual.simultaneo) {
      // Permitir siempre
      horaSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
    } else {
      // Bloquear si ya hay cita
      if (snapshot.empty) {
        horaSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
      }
    }
  }
}

// ===============================
// GUARDAR CITA
// ===============================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!nombreInput.value || !apellido1Input.value) {
    alert("Nombre y primer apellido son obligatorios");
    return;
  }

  await addDoc(collection(db, "citas"), {
    servicioId: servicioSelect.value,
    fecha: fechaInput.value,
    horaInicio: horaSelect.value,
    simultaneo: servicioActual.simultaneo,
    cliente: {
      nombre: nombreInput.value.trim(),
      apellido1: apellido1Input.value.trim(),
      apellido2: apellido2Input.value.trim() || null,
      contacto: contactoInput.value.trim()
    },
    estado: "reservada",
    creado: new Date()
  });

  window.location.href = "gracias.html";
});

// EVENTOS
servicioSelect.addEventListener("change", async () => {
  await obtenerServicio();
  generarHoras();
});

fechaInput.addEventListener("change", generarHoras);

// INIT
cargarServicios();

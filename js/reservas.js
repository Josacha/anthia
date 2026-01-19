import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where
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

// ===============================
// CARGAR SERVICIOS
// ===============================
async function cargarServicios() {
  servicioSelect.innerHTML = `<option value="">Seleccione un servicio</option>`;

  const snapshot = await getDocs(collection(db, "servicios"));
  snapshot.forEach(doc => {
    const s = doc.data();
    if (s.activo) {
      servicioSelect.innerHTML += `
        <option value="${doc.id}" data-duracion="${s.duracion}">
          ${s.nombre}
        </option>`;
    }
  });
}

// ===============================
// GENERAR HORAS DISPONIBLES
// ===============================
async function generarHoras() {
  horaSelect.innerHTML = `<option value="">Seleccione una hora</option>`;

  if (!fechaInput.value || !servicioSelect.value) return;

  // Horario del salón (9:00 a 18:00)
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

    if (snapshot.empty) {
      horaSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
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

  const servicioId = servicioSelect.value;
  const fecha = fechaInput.value;
  const horaInicio = horaSelect.value;

  if (!servicioId || !fecha || !horaInicio) {
    alert("Complete todos los campos requeridos");
    return;
  }

  await addDoc(collection(db, "citas"), {
    servicioId,
    fecha,
    horaInicio,
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
servicioSelect.addEventListener("change", generarHoras);
fechaInput.addEventListener("change", generarHoras);

// INIT
cargarServicios();


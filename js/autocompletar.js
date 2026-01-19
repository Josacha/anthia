import { db } from "./firebase.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const contactoInput = document.getElementById("contacto");
const nombreInput = document.getElementById("nombre");
const apellido1Input = document.getElementById("apellido1");
const apellido2Input = document.getElementById("apellido2");

let timeout = null;

// ===============================
// AUTOCOMPLETAR CLIENTE
// ===============================
contactoInput.addEventListener("input", () => {
  clearTimeout(timeout);

  timeout = setTimeout(() => {
    buscarCliente(contactoInput.value.trim());
  }, 600); // espera a que termine de escribir
});

async function buscarCliente(valor) {
  if (valor.length < 6) return;

  let idCliente = null;

  // Detectar si es correo
  if (valor.includes("@")) {
    idCliente = `correo_${valor.toLowerCase()}`;
  } else {
    // Solo números para teléfono
    const telefono = valor.replace(/\D/g, "");
    if (telefono.length < 8) return;
    idCliente = `tel_${telefono}`;
  }

  const ref = doc(db, "clientes", idCliente);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const c = snap.data();

    nombreInput.value = c.nombre || "";
    apellido1Input.value = c.apellido1 || "";
    apellido2Input.value = c.apellido2 || "";

    // UX
    nombreInput.classList.add("auto");
    apellido1Input.classList.add("auto");
    apellido2Input.classList.add("auto");
  } else {
    limpiarCampos();
  }
}

function limpiarCampos() {
  nombreInput.value = "";
  apellido1Input.value = "";
  apellido2Input.value = "";

  nombreInput.classList.remove("auto");
  apellido1Input.classList.remove("auto");
  apellido2Input.classList.remove("auto");
}


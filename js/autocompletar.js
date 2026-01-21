// autocompletar.js
import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  // -----------------------------
  // ELEMENTOS DEL DOM
  // -----------------------------
  const contactoInput = document.getElementById("contacto");
  const nombreInput = document.getElementById("nombre");
  const apellido1Input = document.getElementById("apellido1");
  const apellido2Input = document.getElementById("apellido2");

  if (!contactoInput || !nombreInput || !apellido1Input || !apellido2Input) return;

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
    if (valor.length < 6) {
      limpiarCampos();
      return;
    }

    let idCliente = null;

    // Detectar si es correo
    if (valor.includes("@")) {
      idCliente = valor.replace(/[.#$[\]]/g, "_"); // mismo formato que usas en Firebase
    } else {
      // Solo números para teléfono
      const telefono = valor.replace(/\D/g, "");
      if (telefono.length < 8) {
        limpiarCampos();
        return;
      }
      idCliente = telefono; // si quieres también puedes usar prefijo "tel_" en Firebase
    }

    try {
      const ref = doc(db, "clientes", idCliente);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const c = snap.data();

        nombreInput.value = c.nombre || "";
        apellido1Input.value = c.apellido1 || "";
        apellido2Input.value = c.apellido2 || "";

        // Opcional: mostrar nombre completo en otro campo si quieres
        // fullNameInput.value = `${c.nombre} ${c.apellido1} ${c.apellido2}`;

        nombreInput.classList.add("auto");
        apellido1Input.classList.add("auto");
        apellido2Input.classList.add("auto");
      } else {
        limpiarCampos();
      }
    } catch (err) {
      console.error("Error buscando cliente:", err);
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
});

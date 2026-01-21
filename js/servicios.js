import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let form, tabla;

// --------------------
// Crear fila de servicio
// --------------------
function crearFilaServicio(id, servicio) {
  const fila = document.createElement("tr");

  fila.innerHTML = `
    <td>${servicio.nombre}</td>
    <td>${servicio.duracion} min</td>
    <td>₡${servicio.precio}</td>
    <td>${servicio.simultaneo ? "Sí" : "No"}</td>
    <td>
      <button class="btn-eliminar" data-id="${id}">🗑️ Eliminar</button>
    </td>
  `;

  // Botón eliminar
  fila.querySelector(".btn-eliminar").addEventListener("click", async () => {
    if (confirm(`¿Eliminar el servicio "${servicio.nombre}"?`)) {
      await deleteDoc(doc(db, "servicios", id));
      cargarServicios();
    }
  });

  return fila;
}

// --------------------
// Cargar servicios desde Firebase
// --------------------
async function cargarServicios() {
  if (!tabla) return;

  tabla.innerHTML = ""; // limpiar

  try {
    const snapshot = await getDocs(collection(db, "servicios"));
    snapshot.forEach(docu => {
      const fila = crearFilaServicio(docu.id, docu.data());
      tabla.appendChild(fila);
    });
  } catch (err) {
    console.error("Error al cargar servicios:", err);
  }
}

// --------------------
// Inicializar módulo servicios
// --------------------
function initServicios() {
  // Esperar al DOM
  document.addEventListener("DOMContentLoaded", () => {
    form = document.getElementById("formServicios");
    tabla = document.getElementById("tablaServicios")?.querySelector("tbody");

    if (!form || !tabla) {
      console.warn("Servicios: HTML no cargado aún");
      return;
    }

    // Evento agregar servicio
    form.addEventListener("submit", async e => {
      e.preventDefault();

      const nombre = document.getElementById("nombreServicio").value.trim();
      const duracion = Number(document.getElementById("duracionServicio").value);
      const precio = Number(document.getElementById("precioServicio").value);
      const simultaneo = document.getElementById("simultaneoServicio").checked;

      if (!nombre || !duracion || !precio) {
        return alert("Por favor completa todos los campos.");
      }

      await addDoc(collection(db, "servicios"), {
        nombre,
        duracion,
        precio,
        simultaneo
      });

      form.reset();
      cargarServicios();
    });

    // Cargar servicios inicialmente
    cargarServicios();
  });
}

// --------------------
// Export
// --------------------
export { initServicios };

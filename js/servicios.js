 import { db } from "./firebase.js";
import { collection, getDocs, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById("formServicios");
const tabla = document.getElementById("tablaServicios").querySelector("tbody");

async function cargarServicios(){
  tabla.innerHTML = "";
  const snapshot = await getDocs(collection(db, "servicios"));
  snapshot.forEach(docu=>{
    const servicio = docu.data();
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${servicio.nombre}</td>
      <td>${servicio.duracion} min</td>
      <td>₡${servicio.precio}</td>
      <td>${servicio.simultaneo?"Sí":"No"}</td>
      <td>
        <button class="btn-secondary btnEliminar" data-id="${docu.id}">Eliminar</button>
      </td>
    `;
    tabla.appendChild(fila);
  });

  document.querySelectorAll(".btnEliminar").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.id;
      await deleteDoc(doc(db, "servicios", id));
      cargarServicios();
    });
  });
}

form.addEventListener("submit", async e=>{
  e.preventDefault();
  await addDoc(collection(db, "servicios"), {
    nombre: document.getElementById("nombreServicio").value,
    duracion: parseInt(document.getElementById("duracionServicio").value),
    precio: parseFloat(document.getElementById("precioServicio").value),
    simultaneo: document.getElementById("simultaneoServicio").checked
  });
  form.reset();
  cargarServicios();
});

cargarServicios();

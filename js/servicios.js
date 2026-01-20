import { db } from "./firebase.js";
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById("formServicios");
const tabla = document.getElementById("tablaServicios").querySelector("tbody");

async function cargarServicios(){
  tabla.innerHTML = "";
  const snapshot = await getDocs(collection(db, "servicios"));
  snapshot.forEach(docu=>{
    const s = docu.data();
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${s.nombre}</td>
      <td>${s.duracion} min</td>
      <td>₡${s.precio}</td>
      <td>${s.simultaneo?"Sí":"No"}</td>
      <td><button class="btn-secondary btnEliminar" data-id="${docu.id}">Eliminar</button></td>
    `;
    tabla.appendChild(fila);
  });

  document.querySelectorAll(".btnEliminar").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      await deleteDoc(doc(db,"servicios",btn.dataset.id));
      cargarServicios();
    });
  });
}

form.addEventListener("submit", async e=>{
  e.preventDefault();
  await addDoc(collection(db,"servicios"),{
    nombre: document.getElementById("nombreServicio").value,
    duracion: parseInt(document.getElementById("duracionServicio").value),
    precio: parseFloat(document.getElementById("precioServicio").value),
    simultaneo: document.getElementById("simultaneoServicio").checked
  });
  form.reset();
  cargarServicios();
});

cargarServicios();

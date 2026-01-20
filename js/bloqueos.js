import { db } from "./firebase.js";
import { collection, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tabla = document.getElementById("tablaBloqueos").querySelector("tbody");

async function cargarBloqueos(){
  tabla.innerHTML = "";
  const snapshot = await getDocs(collection(db, "bloqueos"));
  snapshot.forEach(docu=>{
    const b = docu.data();
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${b.fecha}</td>
      <td>${b.hora}</td>
      <td>
        <button class="btn-secondary btnEliminar" data-id="${docu.id}">Eliminar</button>
      </td>
    `;
    tabla.appendChild(fila);
  });

  document.querySelectorAll(".btnEliminar").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.id;
      await deleteDoc(doc(db, "bloqueos", id));
      cargarBloqueos();
    });
  });
}

cargarBloqueos();


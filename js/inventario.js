import { db } from "./firebase.js";
import { collection, getDocs, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tabla = document.getElementById("tablaInventario").querySelector("tbody");

async function cargarInventario(){
  tabla.innerHTML = "";
  const snapshot = await getDocs(collection(db, "inventario"));
  snapshot.forEach(docu=>{
    const item = docu.data();
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${item.producto}</td>
      <td>${item.cantidad}</td>
      <td>
        <button class="btn-secondary btnEliminar" data-id="${docu.id}">Eliminar</button>
      </td>
    `;
    tabla.appendChild(fila);
  });

  document.querySelectorAll(".btnEliminar").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.id;
      await deleteDoc(doc(db, "inventario", id));
      cargarInventario();
    });
  });
}

cargarInventario();


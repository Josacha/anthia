 import { db } from "./firebase.js";
import { collection, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tabla = document.getElementById("tablaContactos").querySelector("tbody");

async function cargarContactos(){
  tabla.innerHTML = "";
  const snapshot = await getDocs(collection(db, "clientes"));
  snapshot.forEach(docu => {
    const cliente = docu.data();
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${cliente.nombre}</td>
      <td>${cliente.apellido1}</td>
      <td>${cliente.apellido2 || ""}</td>
      <td>${cliente.correo}</td>
      <td>${cliente.telefono}</td>
      <td>
        <button class="btn-secondary btnEliminar" data-id="${docu.id}">Eliminar</button>
      </td>
    `;
    tabla.appendChild(fila);
  });

  document.querySelectorAll(".btnEliminar").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.id;
      await deleteDoc(doc(db, "clientes", id));
      cargarContactos();
    });
  });
}

cargarContactos();


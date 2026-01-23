import { db } from "./firebase.js";
import { collection, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tbody = document.querySelector("#tablaContactos tbody");
const inputBusqueda = document.getElementById("busquedaCliente");
let clientesData = []; // Para filtrar sin volver a consultar a Firebase

function renderFila(id, data) {
    const tr = document.createElement("tr");
    
    // Unimos los apellidos para que se vea más limpio
    const nombreCompleto = `${data.nombre} ${data.apellido1} ${data.apellido2 || ""}`;

    tr.innerHTML = `
        <td style="font-weight: 600; color: #1a1a1a;">${nombreCompleto}</td>
        <td style="color: #666;">${data.correo}</td>
        <td><a href="https://wa.me/${data.telefono}" target="_blank" style="text-decoration:none; color:#27ae60;">📱 ${data.telefono}</a></td>
        <td><button class="btn-ver-historial" style="background:none; border:1px solid #c5a059; color:#c5a059; padding:5px 10px; cursor:pointer; font-size:10px; border-radius:15px;">VER CITAS</button></td>
        <td>
            <button class="btn-eliminar" onclick="window.eliminarCliente('${id}', '${data.nombre}')">🗑️</button>
        </td>
    `;
    return tr;
}

// Escucha en tiempo real (onSnapshot es mejor para que se vea el cambio al borrar)
onSnapshot(collection(db, "clientes"), (snap) => {
    clientesData = [];
    tbody.innerHTML = "";
    snap.forEach(doc => {
        clientesData.push({ id: doc.id, ...doc.data() });
        tbody.appendChild(renderFila(doc.id, doc.data()));
    });
});

// Función de Búsqueda
inputBusqueda.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    tbody.innerHTML = "";
    const filtrados = clientesData.filter(c => 
        `${c.nombre} ${c.apellido1}`.toLowerCase().includes(term) || 
        c.correo.toLowerCase().includes(term)
    );
    filtrados.forEach(c => tbody.appendChild(renderFila(c.id, c)));
});

window.eliminarCliente = async (id, nombre) => {
    if (confirm(`¿Estás seguro de eliminar a ${nombre}? Esto no se puede deshacer.`)) {
        await deleteDoc(doc(db, "clientes", id));
    }
};

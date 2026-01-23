import { db } from "./firebase.js";
import { collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function renderFila(id, data) {
    const tr = document.createElement("tr");
    
    // SOLUCIÓN AL UNDEFINED: Si no existe categoría en Firebase, muestra "General"
    const categoria = data.categoria || "General";
    const precio = data.precio ? Number(data.precio).toLocaleString() : "0";

    tr.innerHTML = `
        <td><span class="badge-cat" style="background:#eee; padding:3px 8px; border-radius:4px; font-size:11px;">${categoria}</span></td>
        <td style="font-weight: 600;">${data.nombre}</td>
        <td>${data.duracion || 0} min</td>
        <td>₡${precio}</td>
        <td>
            <span>${data.simultaneo ? '✨' : '🔒'}</span>
        </td>
        <td>
            <button class="btn-eliminar" onclick="window.eliminarServicio('${id}', '${data.nombre}')" style="background:none; border:none; cursor:pointer;">🗑️</button>
        </td>
    `;
    return tr;
}

window.eliminarServicio = async (id, nombre) => {
    if (confirm(`¿Eliminar el servicio "${nombre}"?`)) {
        await deleteDoc(doc(db, "servicios", id));
    }
};

// Inicialización
const form = document.getElementById("formServicios");
const tbody = document.querySelector("#tablaServicios tbody");

onSnapshot(collection(db, "servicios"), (snap) => {
    tbody.innerHTML = "";
    snap.forEach(doc => {
        tbody.appendChild(renderFila(doc.id, doc.data()));
    });
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nuevo = {
        categoria: document.getElementById("categoriaServicio").value,
        nombre: document.getElementById("nombreServicio").value,
        duracion: Number(document.getElementById("duracionServicio").value),
        precio: Number(document.getElementById("precioServicio").value),
        simultaneo: document.getElementById("simultaneoServicio").checked
    };
    await addDoc(collection(db, "servicios"), nuevo);
    form.reset();
});

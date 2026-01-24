import { db } from "./firebase.js";
import { collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function renderFila(id, data) {
    const tr = document.createElement("tr");
    const categoria = data.categoria || "General";
    const precio = data.precio ? Number(data.precio).toLocaleString() : "0";

    tr.innerHTML = `
        <td><span class="badge-cat" style="background:#f4f4f4; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:600; color:#666;">${categoria}</span></td>
        <td style="font-weight: 600;">${data.nombre}</td>
        <td>${data.duracion || 0} min</td>
        <td>₡${precio}</td>
        <td><span>${data.simultaneo ? '✨' : '🔒'}</span></td>
        <td>
            <button class="btn-eliminar" onclick="window.eliminarServicio('${id}', '${data.nombre}')" style="background:none; border:none; cursor:pointer; font-size:18px;">🗑️</button>
        </td>
    `;
    return tr;
}

window.eliminarServicio = async (id, nombre) => {
    if (confirm(`¿Eliminar el servicio "${nombre}"?`)) {
        await deleteDoc(doc(db, "servicios", id));
    }
};

const form = document.getElementById("formServicios");
const tbody = document.querySelector("#tablaServicios tbody");
const buscador = document.getElementById("busquedaServicio");

onSnapshot(collection(db, "servicios"), (snap) => {
    tbody.innerHTML = "";
    let servicios = [];
    snap.forEach(doc => {
        servicios.push({ id: doc.id, ...doc.data() });
    });

    // Ordenar por categoría para facilitar la lectura
    servicios.sort((a, b) => a.categoria.localeCompare(b.categoria));

    servicios.forEach(serv => {
        tbody.appendChild(renderFila(serv.id, serv));
    });
});

// Buscador dinámico
buscador.addEventListener("input", (e) => {
    const termino = e.target.value.toLowerCase();
    const filas = tbody.querySelectorAll("tr");
    filas.forEach(fila => {
        const nombreServicio = fila.querySelector("td:nth-child(2)").textContent.toLowerCase();
        const categoriaServicio = fila.querySelector("td:nth-child(1)").textContent.toLowerCase();
        fila.style.display = (nombreServicio.includes(termino) || categoriaServicio.includes(termino)) ? "" : "none";
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

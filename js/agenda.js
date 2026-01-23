import { db } from "./firebase.js";
import { 
    collection, addDoc, onSnapshot, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let tbody;

function renderFila(id, data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td><span class="badge-cat">${data.categoria}</span></td>
        <td style="font-weight: 600;">${data.nombre}</td>
        <td>${data.duracion} min</td>
        <td>₡${Number(data.precio).toLocaleString()}</td>
        <td>
            <span class="badge-tipo ${data.simultaneo ? 'badge-simultaneo' : 'badge-exclusivo'}">
                ${data.simultaneo ? '✨' : '🔒'}
            </span>
        </td>
        <td>
            <button class="btn-eliminar" onclick="eliminarServicio('${id}', '${data.nombre}')">🗑️</button>
        </td>
    `;
    return tr;
}

window.eliminarServicio = async (id, nombre) => {
    if (confirm(`¿Eliminar ${nombre}?`)) {
        await deleteDoc(doc(db, "servicios", id));
    }
};

export function initServicios() {
    const form = document.getElementById("formServicios");
    tbody = document.querySelector("#tablaServicios tbody");

    // Escucha en tiempo real
    onSnapshot(collection(db, "servicios"), (snap) => {
        tbody.innerHTML = "";
        snap.forEach(doc => {
            tbody.appendChild(renderFila(doc.id, doc.data()));
        });
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nuevoServicio = {
            categoria: document.getElementById("categoriaServicio").value,
            nombre: document.getElementById("nombreServicio").value,
            duracion: Number(document.getElementById("duracionServicio").value),
            precio: Number(document.getElementById("precioServicio").value),
            simultaneo: document.getElementById("simultaneoServicio").checked
        };

        try {
            await addDoc(collection(db, "servicios"), nuevoServicio);
            form.reset();
        } catch (error) {
            console.error("Error:", error);
        }
    });
}

import { db } from "./firebase.js";
import { collection, addDoc, getDocs, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let form, tbody;

function crearFilaServicio(id, servicio) {
    const fila = document.createElement("tr");

    fila.innerHTML = `
        <td style="font-weight: 600;">${servicio.nombre}</td>
        <td>${servicio.duracion} min</td>
        <td>₡${Number(servicio.precio).toLocaleString()}</td>
        <td>
            <span class="badge-tipo ${servicio.simultaneo ? 'badge-simultaneo' : 'badge-exclusivo'}">
                ${servicio.simultaneo ? "✨ Simultáneo" : "🔒 Exclusivo"}
            </span>
        </td>
        <td>
            <button class="btn-eliminar" data-id="${id}" title="Eliminar servicio">🗑️</button>
        </td>
    `;

    fila.querySelector(".btn-eliminar").addEventListener("click", async () => {
        if (confirm(`¿Eliminar el servicio "${servicio.nombre}"?`)) {
            try {
                await deleteDoc(doc(db, "servicios", id));
            } catch (err) {
                alert("Error al eliminar: " + err.message);
            }
        }
    });

    return fila;
}

async function cargarServicios() {
    if (!tbody) return;

    // Usamos onSnapshot para que la tabla se actualice sola sin recargar
    onSnapshot(collection(db, "servicios"), (snapshot) => {
        tbody.innerHTML = "";
        snapshot.forEach(docu => {
            const fila = crearFilaServicio(docu.id, docu.data());
            tbody.appendChild(fila);
        });
    });
}

function initServicios() {
    form = document.getElementById("formServicios");
    tbody = document.getElementById("tablaServicios")?.querySelector("tbody");

    if (!form || !tbody) return;

    form.addEventListener("submit", async e => {
        e.preventDefault();

        const nombre = document.getElementById("nombreServicio").value.trim();
        const duracion = Number(document.getElementById("duracionServicio").value);
        const precio = Number(document.getElementById("precioServicio").value);
        const simultaneo = document.getElementById("simultaneoServicio").checked;

        try {
            await addDoc(collection(db, "servicios"), {
                nombre,
                duracion,
                precio,
                simultaneo,
                fechaCreacion: new Date()
            });
            form.reset();
        } catch (err) {
            alert("Error al guardar: " + err.message);
        }
    });

    cargarServicios();
}

export { initServicios };

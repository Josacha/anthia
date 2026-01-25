import { db } from "./firebase.js";
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tipoPrecio = document.getElementById("tipoPrecio");
const contFijo = document.getElementById("contenedorPrecioFijo");
const contRango = document.getElementById("contenedorPrecioRango");
const form = document.getElementById("formServicios");
const tbody = document.querySelector("#tablaServicios tbody");

// Lógica para cambiar entre precio único y rango
tipoPrecio.addEventListener("change", () => {
    const esRango = tipoPrecio.value === "rango";
    contFijo.style.display = esRango ? "none" : "block";
    contRango.style.display = esRango ? "grid" : "none";
});

function renderFila(id, data) {
    const tr = document.createElement("tr");
    
    // Construcción visual del precio
    let visualPrecio = "";
    if (data.precio.tipo === "fijo") {
        visualPrecio = `<b>₡${Number(data.precio.valor).toLocaleString()}</b>`;
    } else {
        visualPrecio = `
            <div style="font-size: 12px; line-height: 1.2;">
                <span style="color:#888;">Desde:</span> ₡${Number(data.precio.desde).toLocaleString()}<br>
                <span style="color:#888;">Hasta:</span> ₡${Number(data.precio.hasta).toLocaleString()}
            </div>
        `;
    }

    tr.innerHTML = `
        <td><span class="badge-cat" style="color:var(--gold); font-size:10px; font-weight:600;">${data.categoria}</span></td>
        <td style="font-weight:600; color:#333;">${data.nombre}</td>
        <td>${data.duracion} min</td>
        <td>${visualPrecio}</td>
        <td style="text-align:center;">${data.simultaneo ? '✨' : '🔒'}</td>
        <td>
            <button class="btn-eliminar" onclick="window.eliminarServicio('${id}', '${data.nombre}')">🗑️</button>
        </td>
    `;
    return tr;
}

window.eliminarServicio = async (id, nombre) => {
    if (confirm(`¿Eliminar el tratamiento "${nombre}"?`)) {
        await deleteDoc(doc(db, "servicios", id));
    }
};

// Guardar datos
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pTipo = tipoPrecio.value;
    
    const nuevoServicio = {
        categoria: document.getElementById("categoriaServicio").value,
        nombre: document.getElementById("nombreServicio").value,
        duracion: Number(document.getElementById("duracionServicio").value),
        precio: {
            tipo: pTipo,
            valor: pTipo === "fijo" ? Number(document.getElementById("precioServicio").value) : 0,
            desde: pTipo === "rango" ? Number(document.getElementById("precioDesde").value) : 0,
            hasta: pTipo === "rango" ? Number(document.getElementById("precioHasta").value) : 0
        },
        simultaneo: document.getElementById("simultaneoServicio").checked,
        fechaCreacion: new Date()
    };

    try {
        await addDoc(collection(db, "servicios"), nuevoServicio);
        form.reset();
        contFijo.style.display = "block";
        contRango.style.display = "none";
    } catch (error) {
        console.error("Error al guardar:", error);
    }
});

// Escuchar cambios en tiempo real ordenados por categoría
const q = query(collection(db, "servicios"), orderBy("categoria", "asc"));
onSnapshot(q, (snap) => {
    tbody.innerHTML = "";
    snap.forEach(doc => {
        tbody.appendChild(renderFila(doc.id, doc.data()));
    });
});

import { db } from "./firebase.js";
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- REFERENCIAS DOM ---
const formRegistro = document.getElementById("formServicios");
const formEdicion = document.getElementById("formEditarServicio");
const modal = document.getElementById("modalEditar");
const tbody = document.querySelector("#tablaServicios tbody");

// --- LÓGICA DE INTERFAZ (PRECIOS) ---
const manejarCambioPrecio = (selectId, fijoId, rangoId) => {
    const select = document.getElementById(selectId);
    select.addEventListener("change", () => {
        const esRango = select.value === "rango";
        document.getElementById(fijoId).style.display = esRango ? "none" : "block";
        document.getElementById(rangoId).style.display = esRango ? "grid" : "none";
    });
};
manejarCambioPrecio("tipoPrecio", "contenedorPrecioFijo", "contenedorPrecioRango");
manejarCambioPrecio("editTipoPrecio", "editContFijo", "editContRango");

// --- RENDERIZAR FILA ---
function renderFila(id, data) {
    const tr = document.createElement("tr");
    let visualPrecio = data.precio.tipo === "fijo" 
        ? `₡${Number(data.precio.valor).toLocaleString()}`
        : `<span style="font-size:11px; color:#666;">Desde</span> ₡${Number(data.precio.desde).toLocaleString()}<br><span style="font-size:11px; color:#666;">Hasta</span> ₡${Number(data.precio.hasta).toLocaleString()}`;

    tr.innerHTML = `
        <td><span class="badge-cat" style="color:var(--gold); font-size:10px;">${data.categoria}</span></td>
        <td style="font-weight:600;">${data.nombre}</td>
        <td>${data.duracion} min</td>
        <td style="line-height:1.2;">${visualPrecio}</td>
        <td style="text-align:center;">${data.simultaneo ? '✨' : '🔒'}</td>
        <td>
            <button onclick="window.abrirEditor('${id}', ${JSON.stringify(data).replace(/"/g, '&quot;')})" style="background:none; border:none; cursor:pointer; font-size:16px; margin-right:8px;">✏️</button>
            <button onclick="window.eliminarServicio('${id}', '${data.nombre}')" style="background:none; border:none; cursor:pointer; font-size:16px;">🗑️</button>
        </td>
    `;
    return tr;
}

// --- ACCIONES WINDOW (PARA BOTONES HTML) ---
window.eliminarServicio = async (id, nombre) => {
    if (confirm(`¿Eliminar permanentemente "${nombre}"?`)) {
        await deleteDoc(doc(db, "servicios", id));
    }
};

window.abrirEditor = (id, data) => {
    document.getElementById("editId").value = id;
    document.getElementById("editNombre").value = data.nombre;
    document.getElementById("editDuracion").value = data.duracion;
    document.getElementById("editTipoPrecio").value = data.precio.tipo;
    
    const esRango = data.precio.tipo === "rango";
    document.getElementById("editContFijo").style.display = esRango ? "none" : "block";
    document.getElementById("editContRango").style.display = esRango ? "grid" : "none";
    
    document.getElementById("editPrecioFijo").value = data.precio.valor || "";
    document.getElementById("editPrecioDesde").value = data.precio.desde || "";
    document.getElementById("editPrecioHasta").value = data.precio.hasta || "";
    
    modal.classList.add("active");
};

document.getElementById("btnCerrarModal").onclick = () => modal.classList.remove("active");

// --- FIREBASE: GUARDAR NUEVO ---
formRegistro.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tipo = document.getElementById("tipoPrecio").value;
    const nuevo = {
        categoria: document.getElementById("categoriaServicio").value,
        nombre: document.getElementById("nombreServicio").value,
        duracion: Number(document.getElementById("duracionServicio").value),
        precio: {
            tipo: tipo,
            valor: tipo === "fijo" ? Number(document.getElementById("precioServicio").value) : 0,
            desde: tipo === "rango" ? Number(document.getElementById("precioDesde").value) : 0,
            hasta: tipo === "rango" ? Number(document.getElementById("precioHasta").value) : 0
        },
        simultaneo: document.getElementById("simultaneoServicio").checked,
        creado: new Date()
    };
    await addDoc(collection(db, "servicios"), nuevo);
    formRegistro.reset();
});

// --- FIREBASE: ACTUALIZAR ---
formEdicion.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editId").value;
    const tipo = document.getElementById("editTipoPrecio").value;
    
    await updateDoc(doc(db, "servicios", id), {
        nombre: document.getElementById("editNombre").value,
        duracion: Number(document.getElementById("editDuracion").value),
        precio: {
            tipo: tipo,
            valor: tipo === "fijo" ? Number(document.getElementById("editPrecioFijo").value) : 0,
            desde: tipo === "rango" ? Number(document.getElementById("editPrecioDesde").value) : 0,
            hasta: tipo === "rango" ? Number(document.getElementById("editPrecioHasta").value) : 0
        }
    });
    modal.classList.remove("active");
});

// --- FIREBASE: LEER ---
const q = query(collection(db, "servicios"), orderBy("categoria", "asc"));
onSnapshot(q, (snap) => {
    tbody.innerHTML = "";
    snap.forEach(doc => tbody.appendChild(renderFila(doc.id, doc.data())));
});

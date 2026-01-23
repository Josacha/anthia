import { db } from "./firebase.js";
import { 
    collection, onSnapshot, deleteDoc, doc, getDocs, query, where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tbody = document.querySelector("#tablaContactos tbody");
const modalHistorial = document.getElementById("modalHistorial");
const tbodyHistorial = document.getElementById("tbodyHistorial");
const contenedorTarjetas = document.getElementById("contenedorTarjetas");

let clientesData = [];
let serviciosMap = {};

// --- 1. FUNCIÓN DE ELIMINAR (SOLUCIÓN) ---
// La asignamos explícitamente a window para que el HTML la encuentre
window.eliminarCliente = async (id, nombre) => {
    // Confirmación simple del navegador
    const confirmado = confirm(`¿Estás seguro de eliminar a ${nombre}? Esta acción no se puede deshacer.`);
    
    if (confirmado) {
        try {
            await deleteDoc(doc(db, "clientes", id));
            // No hace falta alert, la tabla se actualizará sola por el onSnapshot
        } catch (error) {
            console.error("Error al eliminar:", error);
            alert("Error: No se pudo eliminar el cliente. Revisa los permisos.");
        }
    }
};

// --- CARGA DE SERVICIOS ---
async function cargarServicios() {
    const snap = await getDocs(collection(db, "servicios"));
    snap.forEach(d => { serviciosMap[d.id] = d.data(); });
}

// --- GENERADOR DE CÍRCULOS (LEALTAD) ---
function generarCirculosHTML(cantidadTotal) {
    const progreso = cantidadTotal % 10 === 0 && cantidadTotal > 0 ? 10 : cantidadTotal % 10;
    let html = "";
    for (let i = 1; i <= 10; i++) {
        let clases = "punto";
        let texto = i;
        if (i <= progreso) clases += " sellado";
        if (i === 5) { clases += " especial"; texto = "50%"; }
        if (i === 10) { clases += " especial"; texto = "🎁"; }
        html += `<div class="${clases}">${texto}</div>`;
    }
    return html;
}

// --- VER HISTORIAL ---
window.verHistorial = async (id, nombre, correo) => {
    document.getElementById("historialNombre").textContent = nombre;
    document.getElementById("historialCorreo").textContent = correo;
    tbodyHistorial.innerHTML = "";
    contenedorTarjetas.innerHTML = "";

    const q = query(collection(db, "citas"), where("clienteId", "==", id));
    const snap = await getDocs(q);

    let totalCitas = 0;
    let gastoTotal = 0;
    const conteoPorServicio = {};

    if (!snap.empty) {
        const citas = [];
        snap.forEach(d => citas.push(d.data()));
        citas.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

        citas.forEach(cita => {
            const s = serviciosMap[cita.servicioId] || { nombre: "Servicio", precio: 0 };
            totalCitas++;
            gastoTotal += Number(s.precio || 0);
            conteoPorServicio[cita.servicioId] = (conteoPorServicio[cita.servicioId] || 0) + 1;

            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${cita.fecha}</td><td>${c.nombresServicios || s.nombre}</td><td>₡${Number(s.precio || 0).toLocaleString()}</td>`;
            tbodyHistorial.appendChild(tr);
        });

        // Tarjetas
        Object.entries(conteoPorServicio).forEach(([sId, cantidad]) => {
            const sInfo = serviciosMap[sId];
            if(!sInfo) return;
            
            const progreso = cantidad % 10 === 0 && cantidad > 0 ? 10 : cantidad % 10;
            const div = document.createElement("div");
            div.className = "tarjeta-lealtad";
            
            let msg = "Próximo premio: Cita #5 (50%)";
            if(progreso >= 5 && progreso < 10) msg = "¡TIENE 50% DE DESCUENTO!";
            if(progreso === 10) msg = "¡ESTA CITA ES GRATIS! 🎁";

            div.innerHTML = `
                <h5>${sInfo.nombre}</h5>
                <div class="puntos-container">${generarCirculosHTML(cantidad)}</div>
                <div class="recompensa-info">${msg}</div>
            `;
            contenedorTarjetas.appendChild(div);
        });
    }

    document.getElementById("statTotalCitas").textContent = totalCitas;
    document.getElementById("statTotalGasto").textContent = `₡${gastoTotal.toLocaleString()}`;
    modalHistorial.classList.add("active");
};

// --- RENDERIZADO DE TABLA ---
function renderFila(id, data) {
    const tr = document.createElement("tr");
    const fullNombre = `${data.nombre} ${data.apellido1}`;
    // Aquí es donde conectamos con la función window.eliminarCliente
    tr.innerHTML = `
        <td style="font-weight:600;">${fullNombre}</td>
        <td>${data.correo}</td>
        <td><a href="https://wa.me/${data.telefono}" target="_blank" style="text-decoration:none;">📱 ${data.telefono}</a></td>
        <td><button class="btn-ver-historial" onclick="window.verHistorial('${id}','${fullNombre}','${data.correo}')">TARJETA REGALO</button></td>
        <td><button class="btn-eliminar" onclick="window.eliminarCliente('${id}','${data.nombre}')">🗑️</button></td>
    `;
    return tr;
}

// Buscador
document.getElementById("busquedaCliente").addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    tbody.innerHTML = "";
    clientesData.filter(c => `${c.nombre} ${c.apellido1}`.toLowerCase().includes(term))
                .forEach(c => tbody.appendChild(renderFila(c.id, c)));
});

// Cerrar Modal
document.getElementById("cerrarHistorial").onclick = () => modalHistorial.classList.remove("active");

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", async () => {
    await cargarServicios();
    
    // Escucha en tiempo real para actualizar (y borrar) la tabla automáticamente
    onSnapshot(collection(db, "clientes"), (snap) => {
        tbody.innerHTML = ""; 
        clientesData = [];
        snap.forEach(d => {
            clientesData.push({id: d.id, ...d.data()});
            tbody.appendChild(renderFila(d.id, d.data()));
        });
    });
});

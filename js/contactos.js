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

// --- 1. CARGAR SERVICIOS PARA REFERENCIA DE PRECIOS ---
async function cargarServicios() {
    const snap = await getDocs(collection(db, "servicios"));
    snap.forEach(d => { serviciosMap[d.id] = d.data(); });
}

// --- 2. LÓGICA DE ELIMINAR ---
window.eliminarCliente = async (id, nombre) => {
    if (confirm(`¿Eliminar a ${nombre}? Esta acción es permanente.`)) {
        try {
            await deleteDoc(doc(db, "clientes", id));
        } catch (error) {
            console.error("Error:", error);
            alert("Error de permisos en Firebase. Revisa tus Rules.");
        }
    }
};

// --- 3. DIBUJAR PUNTOS DE LEALTAD ---
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

// --- 4. VER HISTORIAL Y TARJETAS REGALO ---
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
        // Ordenar por fecha descendente
        citas.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

        citas.forEach(cita => {
            const s = serviciosMap[cita.servicioId];
            totalCitas++;
            
            // --- CORRECCIÓN DE EXTRACCIÓN DE PRECIO ---
            let precioCita = 0;
            let precioTexto = "₡0";

            if (s && s.precio) {
                if (s.precio.tipo === "fijo") {
                    precioCita = Number(s.precio.valor) || 0;
                    precioTexto = `₡${precioCita.toLocaleString()}`;
                } else if (s.precio.tipo === "rango") {
                    // Si es rango, usamos el precio "desde" para el historial
                    precioCita = Number(s.precio.desde) || 0;
                    precioTexto = `₡${precioCita.toLocaleString()}*`;
                }
            }
            
            gastoTotal += precioCita;
            
            // Contabilizar para lealtad
            if (cita.servicioId) {
                conteoPorServicio[cita.servicioId] = (conteoPorServicio[cita.servicioId] || 0) + 1;
            }

            const tr = document.createElement("tr");
            const nombreMostrar = cita.nombresServicios || (s ? s.nombre : "Servicio");
            
            tr.innerHTML = `
                <td>${cita.fecha}</td>
                <td>${nombreMostrar}</td>
                <td>${precioTexto}</td>
            `;
            tbodyHistorial.appendChild(tr);
        });

        // Generar tarjetas por cada tipo de servicio consumido
        Object.entries(conteoPorServicio).forEach(([sId, cantidad]) => {
            const sInfo = serviciosMap[sId];
            if(!sInfo) return;
            
            const progreso = cantidad % 10 === 0 && cantidad > 0 ? 10 : cantidad % 10;
            const div = document.createElement("div");
            div.className = "tarjeta-lealtad";
            
            let msg = "Próximo premio: Cita #5 (50%)";
            if(progreso >= 5 && progreso < 9) msg = "¡TIENE 50% DE DESCUENTO!";
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
    // Opcional: Si quieres mostrar el gasto total en algún lado
  document.getElementById("statGastoTotal").textContent = `₡${gastoTotal.toLocaleString()}`;
  
    modalHistorial.classList.add("active");
};

// --- 5. RENDERIZADO DE TABLA PRINCIPAL ---
function renderFila(id, data) {
    const tr = document.createElement("tr");
    const fullNombre = `${data.nombre} ${data.apellido1 || ""}`;
    tr.innerHTML = `
        <td style="font-weight:600;">${fullNombre}</td>
        <td>${data.correo || "N/A"}</td>
        <td><a href="https://wa.me/${data.telefono}" target="_blank" style="text-decoration:none;">📱 ${data.telefono}</a></td>
        <td><button class="btn-ver-historial" onclick="window.verHistorial('${id}','${fullNombre}','${data.correo}')">TARJETA REGALO</button></td>
        <td><button class="btn-eliminar" onclick="window.eliminarCliente('${id}','${data.nombre}')">🗑️</button></td>
    `;
    return tr;
}

// --- 6. BUSCADOR ---
document.getElementById("busquedaCliente").addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    tbody.innerHTML = "";
    clientesData
        .filter(c => `${c.nombre} ${c.apellido1}`.toLowerCase().includes(term) || (c.correo || "").toLowerCase().includes(term))
        .forEach(c => tbody.appendChild(renderFila(c.id, c)));
});

document.getElementById("cerrarHistorial").onclick = () => modalHistorial.classList.remove("active");

// --- 7. INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", async () => {
    await cargarServicios();
    
    // Escucha cambios en Clientes
    onSnapshot(collection(db, "clientes"), (snap) => {
        tbody.innerHTML = ""; 
        clientesData = [];
        snap.forEach(d => {
            const data = d.data();
            clientesData.push({id: d.id, ...data});
            tbody.appendChild(renderFila(d.id, data));
        });
    });
});

import { db } from "./firebase.js";
import { 
    collection, onSnapshot, deleteDoc, doc, getDocs, query, where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tbody = document.querySelector("#tablaContactos tbody");
const modalHistorial = document.getElementById("modalHistorial");
const tbodyHistorial = document.getElementById("tbodyHistorial");
const inputBusqueda = document.getElementById("busquedaCliente");

let clientesData = [];
let serviciosMap = {};

// 1. Cargamos servicios para conocer precios y nombres en el historial
async function cargarServicios() {
    const snap = await getDocs(collection(db, "servicios"));
    snap.forEach(d => { serviciosMap[d.id] = d.data(); });
}

// 2. Función para abrir el modal de historial con estadísticas
window.verHistorial = async (id, nombre, correo) => {
    document.getElementById("historialNombre").textContent = nombre;
    document.getElementById("historialCorreo").textContent = correo;
    tbodyHistorial.innerHTML = "";
    document.getElementById("mensajeSinCitas").style.display = "none";

    let totalCitas = 0;
    let gastoAcumulado = 0;

    const q = query(collection(db, "citas"), where("clienteId", "==", id));
    const snap = await getDocs(q);

    if (snap.empty) {
        document.getElementById("mensajeSinCitas").style.display = "block";
    } else {
        const listaCitas = [];
        snap.forEach(d => listaCitas.push(d.data()));
        
        // Ordenar: Más reciente primero
        listaCitas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        listaCitas.forEach(cita => {
            const s = serviciosMap[cita.servicioId] || { nombre: "Servicio Eliminado", precio: 0 };
            totalCitas++;
            gastoAcumulado += Number(s.precio);

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${cita.fecha}</td>
                <td>${cita.hora}</td>
                <td style="font-weight:600;">${s.nombre}</td>
                <td>₡${Number(s.precio).toLocaleString()}</td>
            `;
            tbodyHistorial.appendChild(tr);
        });
    }

    // Actualizar estadísticas en el modal
    document.getElementById("statTotalCitas").textContent = totalCitas;
    document.getElementById("statTotalGasto").textContent = `₡${gastoAcumulado.toLocaleString()}`;
    
    modalHistorial.classList.add("active");
};

// 3. Renderizar tabla principal de clientes
function renderFila(id, data) {
    const tr = document.createElement("tr");
    const nombreFull = `${data.nombre} ${data.apellido1} ${data.apellido2 || ""}`;

    tr.innerHTML = `
        <td style="font-weight: 600;">${nombreFull}</td>
        <td style="color: #666;">${data.correo}</td>
        <td><a href="https://wa.me/${data.telefono}" target="_blank" style="text-decoration:none; color:#27ae60; font-weight:600;">📱 ${data.telefono}</a></td>
        <td>
            <button class="btn-ver-historial" onclick="window.verHistorial('${id}', '${nombreFull}', '${data.correo}')">Ver Citas</button>
        </td>
        <td>
            <button class="btn-eliminar" onclick="window.eliminarCliente('${id}', '${data.nombre}')">🗑️</button>
        </td>
    `;
    return tr;
}

// 4. Búsqueda en tiempo real
inputBusqueda.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    tbody.innerHTML = "";
    clientesData.filter(c => 
        `${c.nombre} ${c.apellido1}`.toLowerCase().includes(term) || c.correo.toLowerCase().includes(term)
    ).forEach(c => tbody.appendChild(renderFila(c.id, c)));
});

// 5. Borrado
window.eliminarCliente = async (id, nombre) => {
    if (confirm(`¿Eliminar a ${nombre} de la base de datos?`)) {
        await deleteDoc(doc(db, "clientes", id));
    }
};

// Control de Modal
document.getElementById("cerrarHistorial").onclick = () => modalHistorial.classList.remove("active");
window.onclick = (e) => { if(e.target == modalHistorial) modalHistorial.classList.remove("active"); };

// Inicio
document.addEventListener("DOMContentLoaded", async () => {
    await cargarServicios();
    onSnapshot(collection(db, "clientes"), (snap) => {
        tbody.innerHTML = "";
        clientesData = [];
        snap.forEach(doc => {
            clientesData.push({ id: doc.id, ...doc.data() });
            tbody.appendChild(renderFila(doc.id, doc.data()));
        });
    });
});

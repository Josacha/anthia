import { db } from "./firebase.js";
import { 
    collection, addDoc, getDocs, query, where, deleteDoc, onSnapshot, doc, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ELEMENTOS DEL DOM ---
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");

// Selectores dentro del Modal
const clienteSelect = document.getElementById("clienteSelect");
const servicioSelect = document.getElementById("servicioSelect");
const buscadorCliente = document.getElementById("buscadorCliente");

let serviciosMap = {};
let clientesMap = {};
let desuscribirAgenda = null;
let horaSeleccionadaGlobal = "";
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

const hAMin = (h) => { if(!h) return 0; const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; };

// --- 1. CARGAR DATOS Y LLENAR SELECTS ---
async function cargarDatos() {
    const [sSnap, cSnap] = await Promise.all([
        getDocs(collection(db, "servicios")), 
        getDocs(collection(db, "clientes"))
    ]);

    // Limpiar y llenar servicios
    servicioSelect.innerHTML = '<option value="">-- Seleccione Servicio --</option>';
    sSnap.forEach(d => { 
        const data = d.data();
        serviciosMap[d.id] = { id: d.id, ...data }; 
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = `${data.nombre} (${data.duracion} min)`;
        servicioSelect.appendChild(opt);
    });

    // Guardar clientes en mapa para búsqueda
    cSnap.forEach(d => { clientesMap[d.id] = d.data(); });
    actualizarListaClientes(""); // Llenar lista inicial de clientes
}

// --- 2. BUSCADOR DE CLIENTES ---
function actualizarListaClientes(filtro) {
    clienteSelect.innerHTML = '<option value="">-- Seleccione Cliente --</option>';
    const busqueda = filtro.toLowerCase();
    
    Object.keys(clientesMap).forEach(id => {
        const c = clientesMap[id];
        const nombreCompleto = `${c.nombre} ${c.apellido1}`.toLowerCase();
        
        if (nombreCompleto.includes(busqueda)) {
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = `${c.nombre} ${c.apellido1}`;
            clienteSelect.appendChild(opt);
        }
    });
}

if (buscadorCliente) {
    buscadorCliente.oninput = (e) => actualizarListaClientes(e.target.value);
}

// --- 3. LÓGICA DEL MODAL ---
window.abrirModal = (hora) => {
    horaSeleccionadaGlobal = hora;
    const inicioTxt = document.getElementById("inicioTxt");
    if (inicioTxt) inicioTxt.textContent = hora;
    if (modal) modal.style.display = "flex";
};

window.cerrarModal = () => {
    if (modal) modal.style.display = "none";
    if (buscadorCliente) buscadorCliente.value = "";
    actualizarListaClientes(""); 
};

// --- 4. CARGAR AGENDA (CON REGLA DE ORO) ---
async function cargarAgenda(fecha) {
    if (desuscribirAgenda) desuscribirAgenda();
    const q = query(collection(db, "citas"), where("fecha", "==", fecha));
    
    desuscribirAgenda = onSnapshot(q, (snap) => {
        const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        tbody.innerHTML = "";

        HORAS.forEach(hora => {
            const actualMin = hAMin(hora);
            const ocupantes = citas.filter(c => {
                const ini = hAMin(c.hora);
                const fin = ini + (Number(c.duracion) || 60);
                return actualMin >= ini && actualMin < fin;
            });

            if (ocupantes.length === 0) {
                tbody.innerHTML += `<tr><td>${hora}</td><td colspan="2" class="libre">Disponible</td><td>-</td><td><button onclick="window.abrirModal('${hora}')">➕</button></td></tr>`;
            } else {
                ocupantes.forEach((c, i) => {
                    const cli = clientesMap[c.clienteId];
                    const serv = serviciosMap[c.servicioId];
                    tbody.innerHTML += `
                        <tr>
                            <td>${i === 0 ? hora : ""}</td>
                            <td><b>${cli ? cli.nombre + " " + cli.apellido1 : "Cliente"}</b></td>
                            <td>${serv?.nombre || "Servicio"}</td>
                            <td>${c.simultaneo ? '✨' : '🔒'}</td>
                            <td><button onclick="window.eliminar('${c.id}')">🗑️</button></td>
                        </tr>`;
                });
                // Regla de Oro [cite: 2026-01-23]
                if (ocupantes.length === 1 && ocupantes[0].simultaneo) {
                    tbody.innerHTML += `<tr><td></td><td colspan="2" style="color:gray; font-size:12px;">+ Espacio Simultáneo</td><td>✨</td><td><button onclick="window.abrirModal('${hora}')">➕</button></td></tr>`;
                }
            }
        });
    });
}

// --- 5. GUARDAR CITA ---
document.getElementById("confirmarCita").onclick = async () => {
    const cId = clienteSelect.value;
    const sId = servicioSelect.value;
    if (!cId || !sId) return alert("Seleccione cliente y servicio");

    const serv = serviciosMap[sId];
    await addDoc(collection(db, "citas"), {
        clienteId: cId,
        servicioId: sId,
        fecha: fechaInput.value,
        hora: horaSeleccionadaGlobal,
        duracion: serv.duracion,
        simultaneo: serv.simultaneo === true,
        creado: Timestamp.now()
    });
    window.cerrarModal();
};

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", async () => {
    const d = new Date();
    const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    fechaInput.value = hoy;
    await cargarDatos();
    cargarAgenda(hoy);
    fechaInput.onchange = () => cargarAgenda(fechaInput.value);
    document.getElementById("btnCancelarCita").onclick = window.cerrarModal;
});

window.eliminar = async (id) => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, "citas", id)); };

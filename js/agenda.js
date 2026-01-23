import { db } from "./firebase.js";
import { 
    collection, addDoc, getDocs, query, where, deleteDoc, onSnapshot, doc, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ELEMENTOS DEL DOM ---
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");

// Header
const numeroDiaTxt = document.getElementById("numeroDia");
const mesTxt = document.getElementById("mes");
const diaSemanaTxt = document.getElementById("diaSemana");

// Modal
const clienteInput = document.getElementById("clienteNombre");
const listaSugerencias = document.getElementById("listaSugerencias");
const servicioSelect = document.getElementById("servicioSelect");
const displayInicio = document.getElementById("displayInicio");
const displayFin = document.getElementById("displayFin");

let serviciosMap = {};
let clientesMap = {};
let clienteSeleccionadoId = null;
let desuscribirAgenda = null;
let horaSeleccionadaGlobal = "";
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

// --- UTILIDADES ---
const hAMin = (h) => { if(!h) return 0; const [hh, mm] = h.split(":").map(Number); return (hh * 60) + mm; };
const minAH = (min) => {
    const hh = Math.floor(min / 60).toString().padStart(2, '0');
    const mm = (min % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

// --- 1. CARGAR DATOS INICIALES ---
async function cargarDatos() {
    const [sSnap, cSnap] = await Promise.all([
        getDocs(collection(db, "servicios")), 
        getDocs(collection(db, "clientes"))
    ]);

    servicioSelect.innerHTML = '<option value="">-- Seleccione Tratamiento --</option>';
    sSnap.forEach(d => { 
        const data = d.data();
        serviciosMap[d.id] = { id: d.id, ...data }; 
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = `${data.nombre} (${data.duracion} min)`;
        servicioSelect.appendChild(opt);
    });

    cSnap.forEach(d => { clientesMap[d.id] = { id: d.id, ...d.data() }; });
}

// --- 2. BUSCADOR DE CLIENTES Y CÁLCULO DE HORA ---
if (clienteInput) {
    clienteInput.addEventListener("input", (e) => {
        const busqueda = e.target.value.toLowerCase();
        listaSugerencias.innerHTML = "";
        if (busqueda.length < 2) return;

        Object.values(clientesMap).forEach(c => {
            const nombreCompleto = `${c.nombre} ${c.apellido1}`.toLowerCase();
            if (nombreCompleto.includes(busqueda)) {
                const item = document.createElement("div");
                item.className = "sugerencia-item";
                item.textContent = `${c.nombre} ${c.apellido1}`;
                item.onclick = () => {
                    clienteInput.value = item.textContent;
                    clienteSeleccionadoId = c.id;
                    listaSugerencias.innerHTML = "";
                };
                listaSugerencias.appendChild(item);
            }
        });
    });
}

if (servicioSelect) {
    servicioSelect.addEventListener("change", () => {
        const serv = serviciosMap[servicioSelect.value];
        if (serv && horaSeleccionadaGlobal) {
            const minutosInicio = hAMin(horaSeleccionadaGlobal);
            const minutosFin = minutosInicio + (Number(serv.duracion) || 0);
            if (displayFin) displayFin.textContent = minAH(minutosFin);
        } else {
            if (displayFin) displayFin.textContent = "--:--";
        }
    });
}

// --- 3. LÓGICA DEL MODAL ---
window.abrirModal = (hora) => {
    horaSeleccionadaGlobal = hora;
    if (displayInicio) displayInicio.textContent = hora;
    if (displayFin) displayFin.textContent = "--:--";
    if (modal) modal.style.display = "flex";
};

const cerrarModalFunc = () => {
    if (modal) modal.style.display = "none";
    clienteInput.value = "";
    clienteSeleccionadoId = null;
    servicioSelect.value = "";
    listaSugerencias.innerHTML = "";
    if (displayFin) displayFin.textContent = "--:--";
};

// --- 4. PREMIOS PUSH ---
async function verificarPremio(clienteId) {
    const qCount = query(collection(db, "citas"), where("clienteId", "==", clienteId));
    const snapCount = await getDocs(qCount);
    const total = snapCount.size;

    if (total > 0 && total % 5 === 0) {
        const cli = clientesMap[clienteId];
        const push = document.getElementById("notificacionPush");
        if (push && cli) {
            document.getElementById("pushCliente").textContent = `${cli.nombre} ${cli.apellido1}`;
            document.getElementById("pushDetalle").textContent = `¡Cita #${total}! Hoy recibe un premio especial. 🎁`;
            push.classList.add("active");
            setTimeout(() => push.classList.remove("active"), 8000);
        }
    }
}

window.cerrarPush = () => document.getElementById("notificacionPush").classList.remove("active");

// --- 5. CARGAR AGENDA ---
async function cargarAgenda(fecha) {
    if (desuscribirAgenda) desuscribirAgenda();

    // Actualizar Header Visual
    const [y, m, d] = fecha.split("-");
    const dateObj = new Date(y, m - 1, d);
    if (numeroDiaTxt) numeroDiaTxt.textContent = dateObj.getDate();
    if (mesTxt) mesTxt.textContent = dateObj.toLocaleString('es', { month: 'long' }).toUpperCase();
    if (diaSemanaTxt) diaSemanaTxt.textContent = dateObj.toLocaleString('es', { weekday: 'long' }).toUpperCase();

    const q = query(collection(db, "citas"), where("fecha", "==", fecha));
    desuscribirAgenda = onSnapshot(q, (snap) => {
        const citas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Revisar premios
        const clientesHoy = [...new Set(citas.map(c => c.clienteId))];
        clientesHoy.forEach(id => verificarPremio(id));

        tbody.innerHTML = "";
        HORAS.forEach(hora => {
            const actualMin = hAMin(hora);
            const ocupantes = citas.filter(c => {
                const ini = hAMin(c.hora);
                const fin = ini + (Number(c.duracion) || 60);
                return actualMin >= ini && actualMin < fin;
            });

            if (ocupantes.length === 0) {
                tbody.innerHTML += `<tr><td>${hora}</td><td colspan="2" class="libre">Disponible</td><td>-</td><td><button class="btn-add" onclick="window.abrirModal('${hora}')">➕</button></td></tr>`;
            } else {
                ocupantes.forEach((c, i) => {
                    const cli = clientesMap[c.clienteId];
                    const serv = serviciosMap[c.servicioId];
                    tbody.innerHTML += `
                        <tr>
                            <td>${i === 0 ? hora : ""}</td>
                            <td><b>${cli ? cli.nombre + " " + cli.apellido1 : "Cargando..."}</b></td>
                            <td>${serv?.nombre || "Servicio"}</td>
                            <td>${c.simultaneo ? '✨' : '🔒'}</td>
                            <td><button class="btn-eliminar" onclick="window.eliminar('${c.id}')">🗑️</button></td>
                        </tr>`;
                });
                // Regla de Oro [cite: 2026-01-23]
                if (ocupantes.length === 1 && ocupantes[0].simultaneo) {
                    tbody.innerHTML += `<tr><td></td><td colspan="2" class="libre-simul" onclick="window.abrirModal('${hora}')">+ Espacio disponible</td><td>✨</td><td><button class="btn-add" onclick="window.abrirModal('${hora}')">➕</button></td></tr>`;
                }
            }
        });
    });
}

// --- 6. GUARDAR ---
document.getElementById("guardarCita").onclick = async () => {
    if (!clienteSeleccionadoId || !servicioSelect.value) return alert("Seleccione cliente y servicio");
    const serv = serviciosMap[servicioSelect.value];
    try {
        await addDoc(collection(db, "citas"), {
            clienteId: clienteSeleccionadoId,
            servicioId: serv.id,
            fecha: fechaInput.value,
            hora: horaSeleccionadaGlobal,
            duracion: serv.duracion,
            simultaneo: serv.simultaneo === true,
            creado: Timestamp.now()
        });
        cerrarModalFunc();
    } catch (e) { alert("Error al guardar"); }
};

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", async () => {
    const d = new Date();
    const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    fechaInput.value = hoy;
    
    await cargarDatos();
    cargarAgenda(hoy);

    fechaInput.onchange = () => cargarAgenda(fechaInput.value);
    document.getElementById("cancelarModal").onclick = cerrarModalFunc;
});

window.eliminar = async (id) => { if(confirm("¿Eliminar cita?")) await deleteDoc(doc(db, "citas", id)); };

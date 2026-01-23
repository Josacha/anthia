import { db } from "./firebase.js";
import {
    collection, addDoc, getDocs, query, where, deleteDoc, onSnapshot, doc, setDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- SELECTORES ---
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");
const clienteNombre = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");
const listaSugerencias = document.getElementById("listaSugerencias");

// --- ESTADO ---
let carrito = [];
let horaSeleccionada = null;
let clienteSeleccionadoId = null;
let serviciosMap = {};
let clientesMap = {};
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

// --- UTILIDADES ---
const hAMin = (h) => { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; };
const minAH = (min) => {
    const hh = Math.floor(min / 60).toString().padStart(2, '0');
    const mm = (min % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

// --- MONITOR DE PREMIOS EN TIEMPO REAL ---
function mostrarAvisoPremio(nombre, tipoPremio) {
    const push = document.getElementById("notificacionPush");
    if (!push) return;
    document.getElementById("pushCliente").textContent = nombre;
    document.getElementById("pushDetalle").textContent = `¡Cita actual! Aplica: ${tipoPremio}`;
    push.classList.add("active");
    setTimeout(() => push.classList.remove("active"), 12000);
}

function iniciarMonitorDePremios() {
    const hoy = new Date().toISOString().split('T')[0];
    onSnapshot(query(collection(db, "citas"), where("fecha", "==", hoy)), (snapshot) => {
        setInterval(async () => {
            const ahora = new Date();
            const horaActual = ahora.getHours().toString().padStart(2, '0') + ":" + 
                             ahora.getMinutes().toString().padStart(2, '0');

            snapshot.forEach(async (docCita) => {
                const cita = docCita.data();
                if (cita.hora === horaActual && !cita.avisoMostrado) {
                    const qH = query(collection(db, "citas"), where("clienteId", "==", cita.clienteId));
                    const snapH = await getDocs(qH);
                    const numCita = snapH.size;
                    const ciclo = numCita % 10 === 0 ? 10 : numCita % 10;
                    const nombreCli = clientesMap[cita.clienteId]?.nombre || "Cliente";

                    if (ciclo === 5) mostrarAvisoPremio(nombreCli, "🎁 50% DE DESCUENTO");
                    else if (ciclo === 10) mostrarAvisoPremio(nombreCli, "✨ ¡SERVICIO GRATIS!");
                }
            });
        }, 60000); 
    });
}

// --- LÓGICA DE AGENDA ---
async function cargarDatos() {
    const [sSnap, cSnap] = await Promise.all([getDocs(collection(db, "servicios")), getDocs(collection(db, "clientes"))]);
    servicioSelect.innerHTML = '<option value="">+ Añadir tratamiento</option>';
    sSnap.forEach(d => {
        serviciosMap[d.id] = { id: d.id, ...d.data() };
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = `${d.data().nombre} (${d.data().duracion} min)`;
        servicioSelect.appendChild(opt);
    });
    cSnap.forEach(d => { clientesMap[d.id] = d.data(); });
}

async function cargarAgenda(fecha) {
    actualizarHero(fecha);
    const snap = await getDocs(query(collection(db, "citas"), where("fecha", "==", fecha)));
    const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    tbody.innerHTML = "";
    HORAS.forEach(hora => {
        const tr = document.createElement("tr");
        const actualMin = hAMin(hora);
        const ocupantes = citas.filter(c => {
            const inicio = hAMin(c.hora);
            const fin = inicio + (c.duracion || 60);
            return actualMin >= inicio && actualMin < fin;
        });

        if (ocupantes.length === 0) {
            tr.innerHTML = `<td>${hora}</td><td colspan="2" class="libre" onclick="window.abrirModal('${hora}')">Disponible</td><td>-</td><td><button onclick="window.abrirModal('${hora}')">➕</button></td>`;
        } else {
            ocupantes.forEach((c, i) => {
                const row = i === 0 ? tr : document.createElement("tr");
                const cli = clientesMap[c.clienteId];
                const nombreStr = cli ? `${cli.nombre} ${cli.apellido1 || ''}` : "Cliente";
                row.innerHTML = `<td>${hora}</td><td><b>${nombreStr}</b></td><td>${serviciosMap[c.servicioId]?.nombre || 'Servicio'}</td><td>${c.simultaneo ? '✨' : '🔒'}</td><td><button class="btn-eliminar" onclick="window.eliminar('${c.id}')">🗑️</button></td>`;
                if (i > 0) tbody.appendChild(row);
            });
        }
        tbody.appendChild(tr);
    });
}

// --- GUARDAR CON REGLA ESTRICTA DE SIMULTANEIDAD ---
document.getElementById("guardarCita").onclick = async () => {
    if(!horaSeleccionada || carrito.length === 0) return alert("Faltan datos");
    const fechaAct = fechaInput.value;
    const snapVal = await getDocs(query(collection(db, "citas"), where("fecha", "==", fechaAct)));
    const citasExistentes = snapVal.docs.map(d => d.data());

    let tiempoCorriente = hAMin(horaSeleccionada);
    const nuevasCitas = [];

    for (const s of carrito) {
        const inicio = tiempoCorriente;
        const fin = inicio + s.duracion;

        const ocupadas = citasExistentes.filter(c => {
            const cIni = hAMin(c.hora);
            const cFin = cIni + (c.duracion || 60);
            return (inicio < cFin && fin > cIni);
        });

        if (ocupadas.length > 0) {
            // REGLA: El primero que estaba DEBE ser simultáneo
            const elPrimeroEsSimultaneo = ocupadas.every(c => c.simultaneo === true);
            const miServicioEsSimultaneo = (s.simultaneo === true);

            if (!elPrimeroEsSimultaneo || !miServicioEsSimultaneo || ocupadas.length >= 2) {
                alert(`Conflicto en "${s.nombre}": El horario no permite simultaneidad.`);
                return;
            }
        }
        
        nuevasCitas.push({
            fecha: fechaAct,
            hora: minAH(inicio),
            clienteId: clienteSeleccionadoId || clienteNombre.value,
            servicioId: s.id,
            duracion: s.duracion,
            simultaneo: !!s.simultaneo,
            avisoMostrado: false,
            creado: Timestamp.now()
        });
        tiempoCorriente = fin;
    }

    for (const c of nuevasCitas) { await addDoc(collection(db, "citas"), c); }
    modal.classList.remove("active");
    alert("Cita guardada.");
    carrito = [];
};

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", async () => {
    fechaInput.value = new Date().toISOString().split("T")[0];
    await cargarDatos();
    cargarAgenda(fechaInput.value);
    iniciarMonitorDePremios();
    fechaInput.onchange = () => cargarAgenda(fechaInput.value);
    onSnapshot(collection(db, "citas"), () => cargarAgenda(fechaInput.value));
});

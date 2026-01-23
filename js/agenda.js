import { db } from "./firebase.js";
import {
    collection, addDoc, getDocs, query, where, deleteDoc, onSnapshot, doc, setDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. SELECTORES ---
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");
const clienteNombre = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");
const listaSugerencias = document.getElementById("listaSugerencias");

// --- 2. ESTADO ---
let carrito = [];
let horaSeleccionada = null;
let clienteSeleccionadoId = null;
let serviciosMap = {};
let clientesMap = {};
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

// --- 3. UTILIDADES DE TIEMPO Y HERO ---
const hAMin = (h) => { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; };
const minAH = (min) => {
    const hh = Math.floor(min / 60).toString().padStart(2, '0');
    const mm = (min % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

function actualizarHero(fechaStr) {
    const f = new Date(fechaStr + "T00:00:00");
    const numDia = document.getElementById("numeroDia");
    const mesTxt = document.getElementById("mes");
    const diaTxt = document.getElementById("diaSemana");
    if (numDia) numDia.textContent = f.getDate();
    if (mesTxt) mesTxt.textContent = f.toLocaleDateString('es-ES', { month: 'long' });
    if (diaTxt) diaTxt.textContent = f.toLocaleDateString('es-ES', { weekday: 'long' });
}

// --- 4. MONITOR DE PREMIOS ---
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
            const horaActual = ahora.getHours().toString().padStart(2, '0') + ":" + ahora.getMinutes().toString().padStart(2, '0');
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

// --- 5. LÓGICA DE DATOS ---
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

// --- 6. RENDERIZADO DE TABLA ---
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

// --- 7. GUARDAR CON ENCADENAMIENTO Y REGLAS DE SIMULTANEIDAD ---
window.abrirModal = (hora) => {
    horaSeleccionada = hora; carrito = [];
    document.getElementById("infoHoraSeleccionada").textContent = `Horario: ${hora}`;
    actualizarCarritoUI();
    modal.classList.add("active");
};

function actualizarCarritoUI() {
    const lista = document.getElementById("listaServicios");
    lista.innerHTML = carrito.map((s, i) => `<li>${s.nombre} (${s.duracion} min) <b onclick="window.quitar(${i})" style="color:red;cursor:pointer">✕</b></li>`).join("");
}

window.quitar = (i) => { carrito.splice(i,1); actualizarCarritoUI(); };

servicioSelect.onchange = () => {
    if(servicioSelect.value) {
        const s = serviciosMap[servicioSelect.value];
        carrito.push({ ...s, duracion: parseInt(s.duracion) || 60 });
        actualizarCarritoUI();
        servicioSelect.value = "";
    }
};

document.getElementById("guardarCita").onclick = async () => {
    if(!horaSeleccionada || carrito.length === 0 || !clienteNombre.value) return alert("Faltan datos");

    const fechaAct = fechaInput.value;
    const snapVal = await getDocs(query(collection(db, "citas"), where("fecha", "==", fechaAct)));
    const citasExistentes = snapVal.docs.map(d => d.data());

    let tiempoCorriente = hAMin(horaSeleccionada);
    const nuevasCitas = [];

    // ENCADENAMIENTO: Procesamos cada servicio del carrito
    for (const s of carrito) {
        const inicioReserva = tiempoCorriente;
        const finReserva = inicioReserva + s.duracion;

        // Buscar si hay alguien en este bloque de tiempo
        const ocupadas = citasExistentes.filter(c => {
            const cIni = hAMin(c.hora);
            const cFin = cIni + (c.duracion || 60);
            return (inicioReserva < cFin && finReserva > cIni);
        });

        if (ocupadas.length > 0) {
            // REGLA DE ORO DE ANTHIA:
            // 1. Solo se puede entrar si el que ya estaba es simultáneo.
            const elPrimeroEraSimultaneo = ocupadas.every(c => c.simultaneo === true);
            const limiteAlcanzado = ocupadas.length >= 2;

            if (!elPrimeroEraSimultaneo || limiteAlcanzado) {
                alert(`Conflicto en "${s.nombre}": El servicio existente no permite compañía o cabina llena.`);
                return;
            }
            // Nota: Si el primero es simultáneo, permitimos que entre el nuevo (sea simultáneo o no)
        }
        
        nuevasCitas.push({
            fecha: fechaAct,
            hora: minAH(inicioReserva),
            clienteId: clienteSeleccionadoId || clienteNombre.value,
            servicioId: s.id,
            duracion: s.duracion,
            simultaneo: !!s.simultaneo,
            avisoMostrado: false,
            creado: Timestamp.now()
        });

        // El siguiente servicio del carrito empieza donde termina este (Encadenamiento)
        tiempoCorriente = finReserva;
    }

    // Guardar todo si pasó la validación
    for (const cData of nuevasCitas) { await addDoc(collection(db, "citas"), cData); }
    modal.classList.remove("active");
    alert("Cita(s) agendada(s) correctamente.");
    carrito = [];
};

// --- 8. INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", async () => {
    fechaInput.value = new Date().toISOString().split("T")[0];
    await cargarDatos();
    cargarAgenda(fechaInput.value);
    iniciarMonitorDePremios();
    fechaInput.onchange = () => cargarAgenda(fechaInput.value);
    document.getElementById("cancelarModal").onclick = () => modal.classList.remove("active");
    onSnapshot(collection(db, "citas"), () => cargarAgenda(fechaInput.value));
});

import { db } from "./firebase.js";
import { 
    collection, addDoc, getDocs, query, where, deleteDoc, onSnapshot, doc, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ELEMENTOS ---
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");

// Header
const numeroDiaTxt = document.getElementById("numeroDia");
const mesTxt = document.getElementById("mes");
const diaSemanaTxt = document.getElementById("diaSemana");

// Modal
const clienteNombre = document.getElementById("clienteNombre");
const listaSugerencias = document.getElementById("listaSugerencias");
const servicioSelect = document.getElementById("servicioSelect");
const listaCarritoUI = document.getElementById("listaServiciosCarrito");
const displayInicio = document.getElementById("displayInicio");
const displayFin = document.getElementById("displayFin");

let serviciosMap = {};
let clientesMap = {};
let clienteSeleccionadoId = null;
let serviciosCarrito = []; 
let desuscribirAgenda = null;
let horaSeleccionadaGlobal = "";
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

const hAMin = (h) => { if(!h) return 0; const [hh, mm] = h.split(":").map(Number); return (hh * 60) + mm; };
const minAH = (min) => {
    const hh = Math.floor(min / 60).toString().padStart(2, '0');
    const mm = (min % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

// --- 1. CARGA INICIAL ---
async function cargarDatos() {
    const [sSnap, cSnap] = await Promise.all([
        getDocs(collection(db, "servicios")), 
        getDocs(collection(db, "clientes"))
    ]);

    servicioSelect.innerHTML = '<option value="">+ Añadir servicio...</option>';
    sSnap.forEach(d => { 
        serviciosMap[d.id] = { id: d.id, ...d.data() }; 
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = `${d.data().nombre} (${d.data().duracion} min)`;
        servicioSelect.appendChild(opt);
    });
    cSnap.forEach(d => { clientesMap[d.id] = d.data(); });
}

// --- 2. BUSCADOR PREDICTIVO ---
clienteNombre.addEventListener("input", (e) => {
    const busqueda = e.target.value.toLowerCase();
    listaSugerencias.innerHTML = "";
    if (busqueda.length < 2) { listaSugerencias.style.display = "none"; return; }

    const filtrados = Object.entries(clientesMap).filter(([id, c]) => 
        `${c.nombre} ${c.apellido1}`.toLowerCase().includes(busqueda)
    );

    if (filtrados.length > 0) {
        filtrados.forEach(([id, c]) => {
            const div = document.createElement("div");
            div.className = "sugerencia-item";
            div.innerHTML = `<b>${c.nombre} ${c.apellido1}</b>`;
            div.onclick = () => {
                clienteNombre.value = `${c.nombre} ${c.apellido1}`;
                clienteSeleccionadoId = id;
                listaSugerencias.style.display = "none";
            };
            listaSugerencias.appendChild(div);
        });
        listaSugerencias.style.display = "block";
    }
});

// --- 3. LÓGICA DEL CARRITO ---
servicioSelect.addEventListener("change", () => {
    const sId = servicioSelect.value;
    if (!sId) return;
    serviciosCarrito.push(serviciosMap[sId]);
    servicioSelect.value = "";
    actualizarCarritoUI();
});

window.quitarDelCarrito = (index) => {
    serviciosCarrito.splice(index, 1);
    actualizarCarritoUI();
};

function actualizarCarritoUI() {
    listaCarritoUI.innerHTML = "";
    let totalMin = 0;
    serviciosCarrito.forEach((s, i) => {
        totalMin += Number(s.duracion);
        const li = document.createElement("li");
        li.className = "item-carrito";
        li.innerHTML = `<span>${s.nombre}</span> <button class="btn-quitar" onclick="quitarDelCarrito(${i})">✕</button>`;
        listaCarritoUI.appendChild(li);
    });
    if (horaSeleccionadaGlobal) {
        displayFin.textContent = minAH(hAMin(horaSeleccionadaGlobal) + totalMin);
    }
}

// --- 4. AGENDA (CON CORRECCIÓN DE NOMBRE DE SERVICIO) ---
// --- 4. AGENDA (CON SOPORTE PARA BLOQUEOS) ---
async function cargarAgenda(fecha) {
    if (desuscribirAgenda) desuscribirAgenda();

    const [y, m, d] = fecha.split("-");
    const dateObj = new Date(y, m - 1, d);
    numeroDiaTxt.textContent = dateObj.getDate();
    mesTxt.textContent = dateObj.toLocaleString('es', { month: 'long' }).toUpperCase();
    diaSemanaTxt.textContent = dateObj.toLocaleString('es', { weekday: 'long' }).toUpperCase();

    desuscribirAgenda = onSnapshot(query(collection(db, "citas"), where("fecha", "==", fecha)), (snap) => {
        const citas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tbody.innerHTML = "";

        HORAS.forEach(hora => {
            const actualMin = hAMin(hora);
            const ocupantes = citas.filter(c => {
                const ini = hAMin(c.hora);
                const fin = ini + (Number(c.duracion) || 60);
                return actualMin >= ini && actualMin < fin;
            });

            if (ocupantes.length === 0) {
                tbody.innerHTML += `<tr><td>${hora}</td><td colspan="2">Disponible</td><td>-</td><td><button onclick="window.abrirModal('${hora}')">➕</button></td></tr>`;
            } else {
                ocupantes.forEach((c, i) => {
                    const cli = clientesMap[c.clienteId];
                    
                    // REVISIÓN DE BLOQUEO
                    const esBloqueo = c.clienteId === "SISTEMA_BLOQUEO";
                    const nombreMostrado = esBloqueo ? "🚫 BLOQUEADO" : (cli ? cli.nombre + " " + (cli.apellido1 || "") : "Cliente");
                    
                    // Color de fondo si es bloqueo
                    const filaStyle = esBloqueo ? "style='background-color: #ffebee; color: #c62828;'" : "";

                    tbody.innerHTML += `<tr ${filaStyle}>
                        <td>${i === 0 ? hora : ""}</td>
                        <td><b>${nombreMostrado}</b></td>
                        <td>${c.nombresServicios || "Servicio"}</td>
                        <td>${esBloqueo ? '🚫' : (c.simultaneo ? '✨' : '🔒')}</td>
                        <td><button onclick="window.eliminar('${c.id}')">🗑️</button></td>
                    </tr>`;
                });
                
                // REGLA: Solo mostrar "Espacio libre" si NO hay un bloqueo en esa hora
                const hayBloqueo = ocupantes.some(c => c.clienteId === "SISTEMA_BLOQUEO");
                if (ocupantes.length === 1 && ocupantes[0].simultaneo && !hayBloqueo) {
                    tbody.innerHTML += `<tr><td></td><td colspan="2" class="libre-simul" onclick="window.abrirModal('${hora}')">+ Espacio libre</td><td>✨</td><td><button onclick="window.abrirModal('${hora}')">➕</button></td></tr>`;
                }
            }
        });
    });
}


// --- FUNCIÓN PARA BLOQUEAR HORARIOS ---
window.bloquearHorario = async (tipo) => {
    const fecha = fechaInput.value;
    let horaInicio, duracionTotal, motivo;

    if (tipo === 'dia') {
        horaInicio = "08:00";
        duracionTotal = 600; // 10 horas (de 8am a 6pm)
        motivo = "DÍA BLOQUEADO / VACACIONES";
    } else if (tipo === 'manana') {
        horaInicio = "08:00";
        duracionTotal = 240; // 4 horas (8am a 12md)
        motivo = "MAÑANA BLOQUEADA";
    } else if (tipo === 'tarde') {
        horaInicio = "13:00";
        duracionTotal = 300; // 5 horas (1pm a 6pm)
        motivo = "TARDE BLOQUEADA";
    }

    if (!confirm(`¿Deseas bloquear ${tipo} el día ${fecha}?`)) return;

    try {
        await addDoc(collection(db, "citas"), {
            clienteId: "SISTEMA_BLOQUEO",
            nombreCliente: "🚫 BLOQUEADO",
            nombresServicios: motivo,
            fecha: fecha,
            hora: horaInicio,
            duracion: duracionTotal,
            simultaneo: false, // Importante: false para que nadie pueda agendar encima
            creado: Timestamp.now()
        });
        alert("Horario bloqueado correctamente");
    } catch (error) {
        console.error("Error al bloquear:", error);
    }
};



// --- 5. ACCIONES FINALES ---
window.abrirModal = (hora) => {
    horaSeleccionadaGlobal = hora;
    displayInicio.textContent = hora;
    modal.style.display = "flex";
};

const cerrarTodo = () => {
    modal.style.display = "none";
    serviciosCarrito = [];
    clienteSeleccionadoId = null;
    clienteNombre.value = "";
    actualizarCarritoUI();
};

document.getElementById("guardarCita").onclick = async () => {
    if (!clienteSeleccionadoId || serviciosCarrito.length === 0) return alert("Faltan datos");
    
    await addDoc(collection(db, "citas"), {
        clienteId: clienteSeleccionadoId,
        servicioId: serviciosCarrito[0].id,
        nombresServicios: serviciosCarrito.map(s => s.nombre).join(", "),
        fecha: fechaInput.value,
        hora: horaSeleccionadaGlobal,
        duracion: serviciosCarrito.reduce((acc, s) => acc + Number(s.duracion), 0),
        simultaneo: serviciosCarrito[0].simultaneo === true,
        creado: Timestamp.now()
    });
    cerrarTodo();
};

document.addEventListener("DOMContentLoaded", async () => {
    const d = new Date();
    const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    fechaInput.value = hoy;
    await cargarDatos();
    cargarAgenda(hoy);
    fechaInput.onchange = () => cargarAgenda(fechaInput.value);
    document.getElementById("cancelarModal").onclick = cerrarTodo;
});

window.eliminar = async (id) => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, "citas", id)); };
window.cerrarPush = () => document.getElementById("notificacionPush").classList.remove("active");

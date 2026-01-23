import { db } from "./firebase.js";
import { 
    collection, addDoc, getDocs, query, where, deleteDoc, onSnapshot, doc, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ELEMENTOS DEL DOM ---
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");

// Header Visual
const numeroDiaTxt = document.getElementById("numeroDia");
const mesTxt = document.getElementById("mes");
const diaSemanaTxt = document.getElementById("diaSemana");

// Elementos del Modal
const clienteNombre = document.getElementById("clienteNombre");
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

// --- UTILIDADES DE TIEMPO ---
const hAMin = (h) => { if(!h) return 0; const [hh, mm] = h.split(":").map(Number); return (hh * 60) + mm; };
const minAH = (min) => {
    const hh = Math.floor(min / 60).toString().padStart(2, '0');
    const mm = (min % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

// --- 1. CARGAR DATOS DE FIREBASE ---
async function cargarDatos() {
    const [sSnap, cSnap] = await Promise.all([
        getDocs(collection(db, "servicios")), 
        getDocs(collection(db, "clientes"))
    ]);

    // Llenar Servicios
    servicioSelect.innerHTML = '<option value="">-- Seleccione Tratamiento --</option>';
    sSnap.forEach(d => { 
        const data = d.data();
        serviciosMap[d.id] = { id: d.id, ...data }; 
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = `${data.nombre} (${data.duracion} min)`;
        servicioSelect.appendChild(opt);
    });

    // Guardar Clientes en memoria para el buscador
    cSnap.forEach(d => { clientesMap[d.id] = d.data(); });
}

// --- 2. LÓGICA DEL BUSCADOR PREDICTIVO ---
clienteNombre.addEventListener("input", (e) => {
    const busqueda = e.target.value.toLowerCase();
    listaSugerencias.innerHTML = "";
    
    if (busqueda.length < 2) { 
        listaSugerencias.style.display = "none"; 
        return; 
    }

    const sugerencias = Object.entries(clientesMap).filter(([id, c]) => 
        `${c.nombre} ${c.apellido1}`.toLowerCase().includes(busqueda) || 
        (c.correo || "").toLowerCase().includes(busqueda)
    );

    if (sugerencias.length > 0) {
        sugerencias.forEach(([id, c]) => {
            const div = document.createElement("div");
            div.className = "sugerencia-item";
            div.style.padding = "10px"; // Estilo rápido para asegurar visibilidad
            div.style.cursor = "pointer";
            div.innerHTML = `<b>${c.nombre} ${c.apellido1}</b> <br> <small>${c.correo || ''}</small>`;
            
            div.onclick = () => {
                clienteNombre.value = `${c.nombre} ${c.apellido1}`;
                clienteSeleccionadoId = id;
                listaSugerencias.style.display = "none";
                listaSugerencias.innerHTML = "";
            };
            listaSugerencias.appendChild(div);
        });
        listaSugerencias.style.display = "block";
    } else {
        listaSugerencias.style.display = "none";
    }
});

// --- 3. CÁLCULO DE HORA FIN ---
servicioSelect.addEventListener("change", () => {
    const serv = serviciosMap[servicioSelect.value];
    if (serv && horaSeleccionadaGlobal) {
        const minutosInicio = hAMin(horaSeleccionadaGlobal);
        const minutosFin = minutosInicio + (Number(serv.duracion) || 0);
        if (displayFin) displayFin.textContent = minAH(minutosFin);
    }
});

// --- 4. GESTIÓN DEL MODAL ---
window.abrirModal = (hora) => {
    horaSeleccionadaGlobal = hora;
    if (displayInicio) displayInicio.textContent = hora;
    if (modal) modal.style.display = "flex";
};

const cerrarModalFunc = () => {
    if (modal) modal.style.display = "none";
    clienteNombre.value = "";
    clienteSeleccionadoId = null;
    servicioSelect.value = "";
    listaSugerencias.style.display = "none";
    if (displayFin) displayFin.textContent = "--:--";
};

// --- 5. CARGAR AGENDA Y PREMIOS ---
async function cargarAgenda(fecha) {
    if (desuscribirAgenda) desuscribirAgenda();

    // Actualizar Encabezado (Día/Mes)
    const [y, m, d] = fecha.split("-");
    const dateObj = new Date(y, m - 1, d);
    if (numeroDiaTxt) numeroDiaTxt.textContent = dateObj.getDate();
    if (mesTxt) mesTxt.textContent = dateObj.toLocaleString('es', { month: 'long' }).toUpperCase();
    if (diaSemanaTxt) diaSemanaTxt.textContent = dateObj.toLocaleString('es', { weekday: 'long' }).toUpperCase();

    const q = query(collection(db, "citas"), where("fecha", "==", fecha));
    desuscribirAgenda = onSnapshot(q, async (snap) => {
        const citas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Alerta de premios (cada 5 citas)
        citas.forEach(async (cita) => {
            const qCount = query(collection(db, "citas"), where("clienteId", "==", cita.clienteId));
            const snapCount = await getDocs(qCount);
            if (snapCount.size > 0 && snapCount.size % 5 === 0) {
                const cli = clientesMap[cita.clienteId];
                if (cli) {
                    const push = document.getElementById("notificacionPush");
                    document.getElementById("pushCliente").textContent = cli.nombre;
                    document.getElementById("pushDetalle").textContent = `Cita #${snapCount.size}: ¡Tiene un premio! 🎁`;
                    push.classList.add("active");
                }
            }
        });

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
                            <td><b>${cli ? cli.nombre + " " + cli.apellido1 : "Cliente"}</b></td>
                            <td>${serv?.nombre || "Servicio"}</td>
                            <td>${c.simultaneo ? '✨' : '🔒'}</td>
                            <td><button class="btn-eliminar" onclick="window.eliminar('${c.id}')">🗑️</button></td>
                        </tr>`;
                });
                // Regla de Oro: Espacio si el primer servicio es simultáneo
                if (ocupantes.length === 1 && ocupantes[0].simultaneo) {
                    tbody.innerHTML += `<tr><td></td><td colspan="2" class="libre-simul" onclick="window.abrirModal('${hora}')">+ Espacio libre</td><td>✨</td><td><button class="btn-add" onclick="window.abrirModal('${hora}')">➕</button></td></tr>`;
                }
            }
        });
    });
}

// --- 6. GUARDAR CITA ---
document.getElementById("guardarCita").onclick = async () => {
    if (!clienteSeleccionadoId || !servicioSelect.value) return alert("Seleccione un cliente de la lista y un tratamiento");

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
window.cerrarPush = () => document.getElementById("notificacionPush").classList.remove("active");

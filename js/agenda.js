import { db } from "./firebase.js";
import {
    collection, addDoc, getDocs, query, where, deleteDoc, onSnapshot, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");

// IDs del Header (Para que no se vean guiones)
const numeroDia = document.getElementById("numeroDia");
const mesTexto = document.getElementById("mes");
const diaSemana = document.getElementById("diaSemana");

let serviciosMap = {};
let clientesMap = {};
let desuscribirAgenda = null;
let horaSeleccionadaGlobal = ""; // Para el modal
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

const hAMin = (h) => { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; };

// ACTUALIZAR TEXTOS DEL HEADER
function actualizarHero(fechaStr) {
    const partes = fechaStr.split("-");
    const f = new Date(partes[0], partes[1] - 1, partes[2]);
    if (numeroDia) numeroDia.textContent = f.getDate();
    if (mesTexto) mesTexto.textContent = f.toLocaleDateString('es-ES', { month: 'long' });
    if (diaSemana) diaSemana.textContent = f.toLocaleDateString('es-ES', { weekday: 'long' });
}

async function cargarDatos() {
    const [sSnap, cSnap] = await Promise.all([
        getDocs(collection(db, "servicios")), 
        getDocs(collection(db, "clientes"))
    ]);
    sSnap.forEach(d => { serviciosMap[d.id] = d.data(); });
    cSnap.forEach(d => { clientesMap[d.id] = d.data(); });
}

// FUNCIÓN PARA ABRIR MODAL (Asignada a window para los botones de la tabla)
window.abrirModal = (hora) => {
    horaSeleccionadaGlobal = hora;
    const infoHora = document.getElementById("infoHoraSeleccionada");
    if (infoHora) infoHora.textContent = `Nueva cita: ${hora}`;
    if (modal) modal.classList.add("active");
};

async function cargarAgenda(fecha) {
    if (desuscribirAgenda) desuscribirAgenda();
    actualizarHero(fecha);

    const q = query(collection(db, "citas"), where("fecha", "==", fecha));
    
    desuscribirAgenda = onSnapshot(q, async (snap) => {
        const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        tbody.innerHTML = "";

        HORAS.forEach(hora => {
            const actualMin = hAMin(hora);
            const ocupantes = citas.filter(c => {
                const inicio = hAMin(c.hora);
                const fin = inicio + (Number(c.duracion) || 60);
                return actualMin >= inicio && actualMin < fin;
            });

            if (ocupantes.length === 0) {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${hora}</td>
                    <td colspan="2" class="libre" onclick="window.abrirModal('${hora}')">Disponible</td>
                    <td>-</td>
                    <td><button onclick="window.abrirModal('${hora}')">➕</button></td>
                `;
                tbody.appendChild(tr);
            } else {
                ocupantes.forEach((c, idx) => {
                    const tr = document.createElement("tr");
                    const cli = clientesMap[c.clienteId];
                    const nombreStr = cli ? `${cli.nombre} ${cli.apellido1}` : (c.clienteId || "Cliente");
                    const servicio = serviciosMap[c.servicioId];
                    const iconoEstado = c.simultaneo ? '✨' : '🔒';

                    tr.innerHTML = `
                        <td>${idx === 0 ? hora : ""}</td>
                        <td><b>${nombreStr}</b></td>
                        <td>${servicio?.nombre || 'Servicio'}</td>
                        <td>${iconoEstado}</td>
                        <td><button class="btn-eliminar" onclick="window.eliminar('${c.id}')">🗑️</button></td>
                    `;
                    tbody.appendChild(tr);
                });

                // REGLA DE ORO: Espacio si el servicio es simultáneo [cite: 2026-01-23]
                if (ocupantes.length === 1 && ocupantes[0].simultaneo === true) {
                    const trEx = document.createElement("tr");
                    trEx.innerHTML = `
                        <td></td>
                        <td colspan="2" class="libre-simultaneo" onclick="window.abrirModal('${hora}')">+ Añadir simultáneo</td>
                        <td>✨</td>
                        <td><button onclick="window.abrirModal('${hora}')">➕</button></td>
                    `;
                    tbody.appendChild(trEx);
                }
            }
        });
    });
}

// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", async () => {
    const d = new Date();
    const hoyLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    fechaInput.value = hoyLocal;
    
    await cargarDatos();
    cargarAgenda(hoyLocal);

    fechaInput.onchange = () => cargarAgenda(fechaInput.value);

    // Cerrar modal
    const btnCancel = document.getElementById("cancelarModal");
    if (btnCancel) btnCancel.onclick = () => modal.classList.remove("active");
});

window.eliminar = async (id) => { 
    if(confirm("¿Eliminar cita?")) await deleteDoc(doc(db, "citas", id)); 
};

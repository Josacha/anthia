import { db } from "./firebase.js";
import {
    collection, getDocs, query, where, deleteDoc, onSnapshot, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
let serviciosMap = {};
let clientesMap = {};
let desuscribirAgenda = null;
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

const hAMin = (h) => { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; };

async function cargarDatos() {
    const [sSnap, cSnap] = await Promise.all([
        getDocs(collection(db, "servicios")), 
        getDocs(collection(db, "clientes"))
    ]);
    sSnap.forEach(d => { serviciosMap[d.id] = d.data(); });
    cSnap.forEach(d => { clientesMap[d.id] = d.data(); });
}

async function cargarAgenda(fecha) {
    if (desuscribirAgenda) desuscribirAgenda();

    console.log("🔍 Consultando Agenda para:", fecha);

    const q = query(collection(db, "citas"), where("fecha", "==", fecha));
    
    desuscribirAgenda = onSnapshot(q, async (snap) => {
        const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // --- LÓGICA DE PREMIOS (Revisión automática) ---
        const clientesRevisados = new Set();
        for (const cita of citas) {
            if (cita.clienteId && !clientesRevisados.has(cita.clienteId)) {
                // Contamos cuántas citas totales tiene este cliente en la historia
                const qCount = query(collection(db, "citas"), where("clienteId", "==", cita.clienteId));
                const snapCount = await getDocs(qCount);
                const totalCitas = snapCount.size;

                // Si es múltiplo de 5, disparamos la alerta
                if (totalCitas > 0 && totalCitas % 5 === 0) {
                    const cli = clientesMap[cita.clienteId];
                    const nombreCli = cli ? `${cli.nombre} ${cli.apellido1}` : cita.clienteId;
                    
                    // Usamos setTimeout para que no bloquee el renderizado de la tabla
                    setTimeout(() => {
                        alert(`🎁 ¡ALERTA DE PREMIO!\nEl cliente ${nombreCli} está realizando hoy su cita #${totalCitas}.\n¡Recuerda aplicarle su descuento o regalito!`);
                    }, 800);
                }
                clientesRevisados.add(cita.clienteId);
            }
        }

        // --- RENDERIZADO DE LA TABLA ---
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
                    <td colspan="2" class="libre">Disponible</td>
                    <td>-</td>
                    <td><button onclick="window.abrirModal('${hora}')">➕</button></td>
                `;
                tbody.appendChild(tr);
            } else {
                ocupantes.forEach((c, index) => {
                    const tr = document.createElement("tr");
                    const cli = clientesMap[c.clienteId];
                    const nombreStr = cli ? `${cli.nombre} ${cli.apellido1}` : (c.clienteId || "Cliente");
                    const servicio = serviciosMap[c.servicioId];
                    const iconoEstado = c.simultaneo ? '✨' : '🔒';
                    
                    if (ocupantes.length > 1) {
                        tr.style.borderLeft = "4px solid #d4af37";
                        tr.style.backgroundColor = "#fffdf5";
                    }

                    tr.innerHTML = `
                        <td>${index === 0 ? hora : ""}</td> 
                        <td><b>${nombreStr}</b></td>
                        <td>${servicio?.nombre || 'Servicio'}</td>
                        <td>${iconoEstado}</td>
                        <td><button class="btn-eliminar" onclick="window.eliminar('${c.id}')">🗑️</button></td>
                    `;
                    tbody.appendChild(tr);
                });

                // REGLA DE ORO: Si hay espacio para uno más (Simultáneo único) [cite: 2026-01-23]
                if (ocupantes.length === 1 && ocupantes[0].simultaneo === true) {
                    const trExtra = document.createElement("tr");
                    trExtra.innerHTML = `
                        <td style="border:none"></td>
                        <td colspan="2" style="color:#888; font-style:italic; font-size:11px;">+ Espacio para simultáneo</td>
                        <td>✨</td>
                        <td><button onclick="window.abrirModal('${hora}')">➕</button></td>
                    `;
                    tbody.appendChild(trExtra);
                }
            }
        });
    });
}

// --- INICIALIZACIÓN CON FECHA LOCAL ---
document.addEventListener("DOMContentLoaded", async () => {
    const d = new Date();
    const anio = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    const hoyLocal = `${anio}-${mes}-${dia}`;
    
    fechaInput.value = hoyLocal;
    
    await cargarDatos();
    cargarAgenda(hoyLocal);

    fechaInput.onchange = () => cargarAgenda(fechaInput.value);
});

window.eliminar = async (id) => { 
    if(confirm("¿Seguro que quieres eliminar esta cita?")) {
        await deleteDoc(doc(db, "citas", id));
    }
};

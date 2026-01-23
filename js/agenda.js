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
    const [sSnap, cSnap] = await Promise.all([getDocs(collection(db, "servicios")), getDocs(collection(db, "clientes"))]);
    sSnap.forEach(d => { serviciosMap[d.id] = d.data(); });
    cSnap.forEach(d => { clientesMap[d.id] = d.data(); });
}

async function cargarAgenda(fecha) {
    // 1. Limpieza de escucha anterior
    if (desuscribirAgenda) desuscribirAgenda();

    console.log("🔍 Buscando citas para la fecha:", fecha);

    const q = query(collection(db, "citas"), where("fecha", "==", fecha));
    
    desuscribirAgenda = onSnapshot(q, (snap) => {
        const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        console.log("✅ Citas encontradas en Firebase:", citas);

        if (citas.length === 0) {
            console.warn("⚠️ No hay citas guardadas para este día exacto en la base de datos.");
        }

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
                tr.innerHTML = `<td>${hora}</td><td colspan="2" class="libre">Disponible</td><td>-</td><td><button onclick="window.abrirModal('${hora}')">➕</button></td>`;
                tbody.appendChild(tr);
            } else {
                ocupantes.forEach((c) => {
                    const tr = document.createElement("tr");
                    const cli = clientesMap[c.clienteId];
                    const nombreStr = cli ? `${cli.nombre} ${cli.apellido1}` : (c.clienteId || "Sin nombre");
                    const servicioNombre = serviciosMap[c.servicioId]?.nombre || "Servicio no encontrado";
                    const iconoEstado = c.simultaneo ? '✨' : '🔒';

                    tr.innerHTML = `
                        <td>${hora}</td>
                        <td><b>${nombreStr}</b></td>
                        <td>${servicioNombre}</td>
                        <td>${iconoEstado}</td>
                        <td><button class="btn-eliminar" onclick="window.eliminar('${c.id}')">🗑️</button></td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        });
    }, (error) => {
        console.error("❌ Error de Firebase al leer agenda:", error);
    });
}

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", async () => {
    // Establecer fecha de hoy por defecto
    const hoy = new Date().toISOString().split("T")[0];
    fechaInput.value = hoy;
    
    await cargarDatos();
    cargarAgenda(hoy);

    fechaInput.onchange = () => cargarAgenda(fechaInput.value);
});

window.eliminar = async (id) => { 
    if(confirm("¿Eliminar cita?")) await deleteDoc(doc(db, "citas", id)); 
};

import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, query, where, updateDoc, deleteDoc, onSnapshot, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Selectores
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");
const clienteNombre = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");

// Estado
let carrito = [];
let horaSeleccionada = null;
let serviciosMap = {};
let clientesMap = {};
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

// --- UTILIDADES DE TIEMPO ---
function hAMin(h) {
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + mm;
}

function minAH(min) {
    const hh = Math.floor(min / 60).toString().padStart(2, '0');
    const mm = (min % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
}

// --- ACTUALIZACIÓN UI HERO ---
function actualizarHero(fechaStr) {
    const fecha = new Date(fechaStr + "T00:00:00");
    document.getElementById("numeroDia").textContent = fecha.getDate();
    document.getElementById("mes").textContent = fecha.toLocaleDateString('es-ES', { month: 'long' });
    document.getElementById("diaSemana").textContent = fecha.toLocaleDateString('es-ES', { weekday: 'long' });
}

// --- CARRITO Y CÁLCULO INTELIGENTE ---
function actualizarCarritoUI() {
    const lista = document.getElementById("listaServicios");
    lista.innerHTML = carrito.map((s, i) => `
        <li>
            <span>${s.nombre} (${s.duracion} min)</span>
            <b style="cursor:pointer; color:red" onclick="window.quitarServicio(${i})">✕</b>
        </li>
    `).join("");

    const duracionTotal = carrito.reduce((acc, s) => acc + s.duracion, 0);
    document.getElementById("displayInicio").textContent = horaSeleccionada || "--:--";
    
    if (horaSeleccionada) {
        const finMin = hAMin(horaSeleccionada) + duracionTotal;
        document.getElementById("displayFin").textContent = minAH(finMin);
    }
}

window.quitarServicio = (i) => {
    carrito.splice(i, 1);
    actualizarCarritoUI();
};

// --- CARGA DE DATOS ---
async function cargarDatosBase() {
    const [servSnap, cliSnap] = await Promise.all([
        getDocs(collection(db, "servicios")),
        getDocs(collection(db, "clientes"))
    ]);

    servicioSelect.innerHTML = '<option value="">+ Seleccionar servicio</option>';
    servSnap.forEach(d => {
        serviciosMap[d.id] = d.data();
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = `${d.data().nombre} (${d.data().duracion} min)`;
        servicioSelect.appendChild(opt);
    });

    cliSnap.forEach(d => { clientesMap[d.id] = d.data(); });
}

// --- RENDER DE TABLA ---
async function cargarAgenda(fecha) {
    actualizarHero(fecha);
    tbody.innerHTML = "";
    const snap = await getDocs(query(collection(db, "citas"), where("fecha", "==", fecha)));
    const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    HORAS.forEach(hora => {
        const tr = document.createElement("tr");
        const ocupantes = citas.filter(c => {
            const inicio = hAMin(c.hora);
            const fin = inicio + c.duracion;
            const actual = hAMin(hora);
            return actual >= inicio && actual < fin;
        });

        if (ocupantes.length === 0) {
            tr.innerHTML = `<td>${hora}</td><td colspan="2" class="libre">Disponible</td><td><span class="badge-libre">Libre</span></td><td><button onclick="window.abrirModal('${hora}')">➕</button></td>`;
        } else {
            ocupantes.forEach((c, i) => {
                const row = i === 0 ? tr : document.createElement("tr");
                const cli = clientesMap[c.clienteId];
                const nombre = cli ? `${cli.nombre} ${cli.apellido1 || ''}` : c.clienteId;
                row.innerHTML = `
                    <td>${hora}</td>
                    <td><b>${nombre}</b></td>
                    <td>${serviciosMap[c.servicioId]?.nombre || 'Servicio'}</td>
                    <td><span class="badge-ocupado">${c.simultaneo ? 'Simultáneo' : 'Ocupado'}</span></td>
                    <td><button onclick="window.eliminarCita('${c.id}')">🗑️</button></td>
                `;
                if (i > 0) tbody.appendChild(row);
            });
        }
        tbody.appendChild(tr);
    });
}

// --- ACCIONES ---
window.abrirModal = (hora) => {
    horaSeleccionada = hora;
    carrito = [];
    document.getElementById("infoHoraSeleccionada").textContent = `Horario: ${hora}`;
    actualizarCarritoUI();
    modal.classList.add("active");
};

window.eliminarCita = async (id) => {
    if(confirm("¿Eliminar cita?")) {
        await deleteDoc(doc(db, "citas", id));
        cargarAgenda(fechaInput.value);
    }
};

servicioSelect.onchange = () => {
    const sId = servicioSelect.value;
    if(sId) {
        carrito.push({ id: sId, ...serviciosMap[sId] });
        actualizarCarritoUI();
        servicioSelect.value = "";
    }
};

document.getElementById("guardarCita").onclick = async () => {
    if(!horaSeleccionada || carrito.length === 0) return alert("Faltan datos");

    const inicioMin = hAMin(horaSeleccionada);
    const duracionCita = carrito.reduce((acc, s) => acc + s.duracion, 0);
    const fecha = fechaInput.value;

    // REGLAS INTELIGENTES (Tus reglas originales)
    const snap = await getDocs(query(collection(db, "citas"), where("fecha", "==", fecha)));
    const citasDia = snap.docs.map(d => d.data());

    for (const s of carrito) {
        const choques = citasDia.filter(c => {
            const cI = hAMin(c.hora);
            const cF = cI + c.duracion;
            return !(inicioMin + s.duracion <= cI || inicioMin >= cF);
        });

        if (choques.length > 0) {
            if (choques.some(c => !c.simultaneo) || !s.simultaneo) {
                return alert("Conflicto: El horario requiere exclusividad.");
            }
            if (choques.length >= 2) return alert("Límite de 2 citas simultáneas alcanzado.");
        }
    }

    // Guardar
    for (const s of carrito) {
        await addDoc(collection(db, "citas"), {
            fecha,
            hora: horaSeleccionada,
            clienteId: clienteNombre.value,
            servicioId: s.id,
            duracion: s.duracion,
            simultaneo: s.simultaneo || false
        });
    }

    modal.classList.remove("active");
    cargarAgenda(fecha);
};

// Init
document.addEventListener("DOMContentLoaded", async () => {
    fechaInput.value = new Date().toISOString().split("T")[0];
    await cargarDatosBase();
    cargarAgenda(fechaInput.value);
    fechaInput.onchange = () => cargarAgenda(fechaInput.value);
    document.getElementById("cancelarModal").onclick = () => modal.classList.remove("active");
    onSnapshot(collection(db, "citas"), () => cargarAgenda(fechaInput.value));
});

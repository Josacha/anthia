import { db } from "./firebase.js";
import {
    collection, addDoc, getDocs, query, where, deleteDoc, onSnapshot, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");
const clienteNombre = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");
const listaSugerencias = document.getElementById("listaSugerencias");

let carrito = [];
let horaSeleccionada = null;
let clienteSeleccionadoId = null;
let serviciosMap = {};
let clientesMap = {};
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

const hAMin = (h) => { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; };
const minAH = (min) => `${Math.floor(min/60).toString().padStart(2,'0')}:${(min%60).toString().padStart(2,'0')}`;

function actualizarHero(fechaStr) {
    const f = new Date(fechaStr + "T00:00:00");
    document.getElementById("numeroDia").textContent = f.getDate();
    document.getElementById("mes").textContent = f.toLocaleDateString('es-ES', { month: 'long' });
    document.getElementById("diaSemana").textContent = f.toLocaleDateString('es-ES', { weekday: 'long' });
}

async function cargarDatos() {
    const [sSnap, cSnap] = await Promise.all([getDocs(collection(db, "servicios")), getDocs(collection(db, "clientes"))]);
    servicioSelect.innerHTML = '<option value="">+ Añadir tratamiento</option>';
    sSnap.forEach(d => {
        serviciosMap[d.id] = d.data();
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = `${d.data().nombre} (${d.data().duracion} min)`;
        servicioSelect.appendChild(opt);
    });
    cSnap.forEach(d => { clientesMap[d.id] = d.data(); });
}

// BÚSQUEDA PREDICTIVA
clienteNombre.addEventListener("input", (e) => {
    const busqueda = e.target.value.toLowerCase();
    listaSugerencias.innerHTML = "";
    if (busqueda.length < 2) { listaSugerencias.style.display = "none"; return; }

    const sugerencias = Object.entries(clientesMap).filter(([id, c]) => 
        `${c.nombre} ${c.apellido1}`.toLowerCase().includes(busqueda) || (c.correo || "").toLowerCase().includes(busqueda)
    );

    if (sugerencias.length > 0) {
        sugerencias.forEach(([id, c]) => {
            const div = document.createElement("div");
            div.className = "sugerencia-item";
            div.innerHTML = `<b>${c.nombre} ${c.apellido1}</b><span>${c.correo || ''}</span>`;
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

async function cargarAgenda(fecha) {
    actualizarHero(fecha);
    const snap = await getDocs(query(collection(db, "citas"), where("fecha", "==", fecha)));
    const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // --- LÓGICA DE PREMIOS (AVISO AL CARGAR DÍA) ---
    const clientesAlertados = new Set();
    for (const cita of citas) {
        if (cita.clienteId && !clientesAlertados.has(cita.clienteId)) {
            const qCount = query(collection(db, "citas"), where("clienteId", "==", cita.clienteId));
            const snapCount = await getDocs(qCount);
            const totalCitas = snapCount.size;

            if (totalCitas > 0 && totalCitas % 5 === 0) {
                const cli = clientesMap[cita.clienteId];
                const nombre = cli ? `${cli.nombre} ${cli.apellido1}` : cita.clienteId;
                setTimeout(() => {
                    alert(`🎁 ¡PREMIO HOY! El cliente ${nombre} cumple hoy su cita número ${totalCitas}.`);
                }, 500);
            }
            clientesAlertados.add(cita.clienteId);
        }
    }
    
    tbody.innerHTML = "";

    // --- RENDERIZADO DE LA TABLA ---
    HORAS.forEach(hora => {
        const actualMin = hAMin(hora);
        
        // Filtramos citas que ocupen este horario
        const ocupantes = citas.filter(c => {
            const inicio = hAMin(c.hora);
            const fin = inicio + (Number(c.duracion) || 60);
            return actualMin >= inicio && actualMin < fin;
        });

        if (ocupantes.length === 0) {
            // ESPACIO DISPONIBLE
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${hora}</td>
                <td colspan="2" class="libre" onclick="window.abrirModal('${hora}')">Disponible</td>
                <td>-</td>
                <td><button onclick="window.abrirModal('${hora}')">➕</button></td>
            `;
            tbody.appendChild(tr);
        } else {
            // ESPACIO OCUPADO (SOPORTA MÚLTIPLES CITAS SIMULTÁNEAS)
            ocupantes.forEach((c) => {
                const tr = document.createElement("tr");
                const cli = clientesMap[c.clienteId];
                const nombreStr = cli ? `${cli.nombre} ${cli.apellido1 || ''}` : c.clienteId;
                
                // REGLA DE ORO: Refleja si el servicio es ✨ o 🔒 [cite: 2026-01-23]
                const iconoEstado = c.simultaneo ? '✨' : '🔒';
                
                // Si hay dos personas a la misma hora, aplicamos clase visual
                if (ocupantes.length > 1) tr.style.backgroundColor = "#f9f9f9";

                tr.innerHTML = `
                    <td>${hora}</td>
                    <td><b>${nombreStr}</b></td>
                    <td>${serviciosMap[c.servicioId]?.nombre || 'Servicio'}</td>
                    <td>${iconoEstado}</td>
                    <td><button class="btn-eliminar" onclick="window.eliminar('${c.id}')">🗑️</button></td>
                `;
                tbody.appendChild(tr);
            });
        }
    });
}

window.abrirModal = (hora) => {
    horaSeleccionada = hora; 
    carrito = [];
    clienteNombre.value = "";
    clienteSeleccionadoId = null;
    document.getElementById("infoHoraSeleccionada").textContent = `Horario: ${hora}`;
    actualizarCarritoUI();
    modal.classList.add("active");
};

function actualizarCarritoUI() {
    const lista = document.getElementById("listaServicios");
    lista.innerHTML = carrito.map((s, i) => `<li>${s.nombre} <b onclick="window.quitar(${i})" style="color:red;cursor:pointer">✕</b></li>`).join("");
    const duracion = carrito.reduce((a, b) => a + b.duracion, 0);
    document.getElementById("displayInicio").textContent = horaSeleccionada || "--:--";
    if(horaSeleccionada) document.getElementById("displayFin").textContent = minAH(hAMin(horaSeleccionada) + duracion);
}

window.quitar = (i) => { carrito.splice(i,1); actualizarCarritoUI(); };

servicioSelect.onchange = () => {
    if(servicioSelect.value) {
        const sInfo = serviciosMap[servicioSelect.value];
        carrito.push({ id: servicioSelect.value, ...sInfo });
        actualizarCarritoUI();
        servicioSelect.value = "";
    }
};

document.getElementById("guardarCita").onclick = async () => {
    if(!horaSeleccionada || carrito.length === 0) return alert("Faltan datos");
    
    let tiempoCorriente = hAMin(horaSeleccionada);
    
    for (const s of carrito) {
        await addDoc(collection(db, "citas"), {
            fecha: fechaInput.value,
            hora: minAH(tiempoCorriente),
            clienteId: clienteSeleccionadoId || clienteNombre.value,
            servicioId: s.id,
            duracion: Number(s.duracion),
            simultaneo: s.simultaneo === true // Hereda del servicio [cite: 2026-01-23]
        });
        tiempoCorriente += Number(s.duracion);
    }
    
    modal.classList.remove("active");
    clienteSeleccionadoId = null;
    clienteNombre.value = "";
};

window.eliminar = async (id) => { if(confirm("¿Eliminar cita?")) await deleteDoc(doc(db, "citas", id)); };

document.addEventListener("DOMContentLoaded", async () => {
    fechaInput.value = new Date().toISOString().split("T")[0];
    await cargarDatos();
    cargarAgenda(fechaInput.value);
    fechaInput.onchange = () => cargarAgenda(fechaInput.value);
    document.getElementById("cancelarModal").onclick = () => modal.classList.remove("active");
    onSnapshot(collection(db, "citas"), () => cargarAgenda(fechaInput.value));
});

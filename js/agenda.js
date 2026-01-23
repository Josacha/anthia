import { db } from "./firebase.js";
import {
    collection, addDoc, getDocs, query, where, deleteDoc, onSnapshot, doc, setDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. SELECTORES ---
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");
const clienteNombreInput = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");

// --- 2. ESTADO ---
let carrito = [];
let horaSeleccionada = null;
let clienteSeleccionadoId = null;
let serviciosMap = {};
let clientesMap = {};
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

// --- 3. UTILIDADES MATEMÁTICAS ---
const hAMin = (h) => { 
    if(!h) return 0;
    const [hh, mm] = h.split(":").map(Number); 
    return (hh * 60) + mm; 
};
const minAH = (min) => {
    const hh = Math.floor(min / 60).toString().padStart(2, '0');
    const mm = (min % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

function actualizarHero(fechaStr) {
    const f = new Date(fechaStr + "T00:00:00");
    document.getElementById("numeroDia").textContent = f.getDate();
    document.getElementById("mes").textContent = f.toLocaleDateString('es-ES', { month: 'long' });
    document.getElementById("diaSemana").textContent = f.toLocaleDateString('es-ES', { weekday: 'long' });
}

// --- 4. MONITOR DE PREMIOS ---
function mostrarAvisoPremio(nombre, tipoPremio) {
    const push = document.getElementById("notificacionPush");
    if (!push) return;
    document.getElementById("pushCliente").textContent = nombre;
    document.getElementById("pushDetalle").textContent = `¡Cita actual! Aplica: ${tipoPremio}`;
    push.classList.add("active");
    setTimeout(() => push.classList.remove("active"), 10000);
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
                    const snapH = await getDocs(query(collection(db, "citas"), where("clienteId", "==", cita.clienteId)));
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

// --- 6. RENDERIZADO DE TABLA (CORREGIDO) ---
async function cargarAgenda(fecha) {
    actualizarHero(fecha);
    const snap = await getDocs(query(collection(db, "citas"), where("fecha", "==", fecha)));
    const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    tbody.innerHTML = "";

    HORAS.forEach(hora => {
        const actualMin = hAMin(hora);
        // Buscamos quiénes ocupan este bloque de 1 hora
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
                <td><button class="btn-add" onclick="window.abrirModal('${hora}')">➕</button></td>`;
            tbody.appendChild(tr);
        } else {
            // Creamos una fila física en la tabla por cada persona
            ocupantes.forEach((c) => {
                const tr = document.createElement("tr");
                const cli = clientesMap[c.clienteId] || { nombre: c.clienteId };
                const nombreStr = `${cli.nombre} ${cli.apellido1 || ''}`;
                
                tr.innerHTML = `
                    <td>${hora}</td>
                    <td><b>${nombreStr}</b></td>
                    <td>${serviciosMap[c.servicioId]?.nombre || 'Servicio'}</td>
                    <td>${c.simultaneo ? '✨' : '🔒'}</td>
                    <td><button class="btn-eliminar" onclick="window.eliminar('${c.id}')">🗑️</button></td>`;
                tbody.appendChild(tr);
            });
            
            // Si solo hay 1 persona y es simultánea, mostramos opción de añadir otra
            const puedeAñadirMas = ocupantes.length === 1 && ocupantes[0].simultaneo === true;
            if (puedeAñadirMas) {
                const trAdd = document.createElement("tr");
                trAdd.innerHTML = `<td>${hora}</td><td colspan="3" class="libre-parcial" onclick="window.abrirModal('${hora}')">Espacio disponible (Compartido)</td><td><button class="btn-add" onclick="window.abrirModal('${hora}')">➕</button></td>`;
                tbody.appendChild(trAdd);
            }
        }
    });
}

// --- 7. MODAL Y GUARDADO CON ENCADENAMIENTO ---
window.abrirModal = (hora) => {
    horaSeleccionada = hora; 
    carrito = [];
    clienteNombreInput.value = "";
    clienteSeleccionadoId = null;
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
        carrito.push({ ...s, duracion: Number(s.duracion) || 60 });
        actualizarCarritoUI();
        servicioSelect.value = "";
    }
};

document.getElementById("guardarCita").onclick = async () => {
    if(!horaSeleccionada || carrito.length === 0 || !clienteNombreInput.value) return alert("Faltan datos");

    const fechaAct = fechaInput.value;
    const snapVal = await getDocs(query(collection(db, "citas"), where("fecha", "==", fechaAct)));
    const citasExistentes = snapVal.docs.map(d => d.data());

    let tiempoCorriente = hAMin(horaSeleccionada);
    const nuevasCitas = [];

    for (const s of carrito) {
        const inicioR = Number(tiempoCorriente);
        const finR = inicioR + s.duracion;

        const ocupadas = citasExistentes.filter(c => {
            const cIni = hAMin(c.hora);
            const cFin = cIni + (Number(c.duracion) || 60);
            return (inicioR < cFin && finR > cIni);
        });

        if (ocupadas.length > 0) {
            const elPrimeroEsSimultaneo = ocupadas.every(c => c.simultaneo === true);
            const limiteCabina = ocupadas.length >= 2;
            const elNuevoEsSimultaneo = s.simultaneo === true;

            if (!elPrimeroEsSimultaneo || limiteCabina || !elNuevoEsSimultaneo) {
                alert(`¡Conflicto! El bloque de las ${minAH(inicioR)} está bloqueado o lleno.`);
                return;
            }
        }
        
        nuevasCitas.push({
            fecha: fechaAct,
            hora: minAH(inicioR),
            clienteId: clienteNombreInput.value, // Simplificado para este ejemplo
            servicioId: s.id,
            duracion: s.duracion,
            simultaneo: s.simultaneo === true,
            avisoMostrado: false,
            creado: Timestamp.now()
        });
        tiempoCorriente = finR;
    }

    for (const cData of nuevasCitas) { await addDoc(collection(db, "citas"), cData); }
    modal.classList.remove("active");
    alert("Cita agendada.");
};

window.eliminar = async (id) => {
    if(confirm("¿Eliminar cita?")) {
        await deleteDoc(doc(db, "citas", id));
    }
};

// --- 8. INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", async () => {
    fechaInput.value = new Date().toISOString().split("T")[0];
    await cargarDatos();
    cargarAgenda(fechaInput.value);
    iniciarMonitorDePremios();
    
    fechaInput.onchange = () => cargarAgenda(fechaInput.value);
    document.getElementById("cancelarModal").onclick = () => modal.classList.remove("active");
    
    // Escuchar cambios en tiempo real
    onSnapshot(collection(db, "citas"), () => cargarAgenda(fechaInput.value));
});

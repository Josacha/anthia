import { db } from "./firebase.js";
import {
    collection, addDoc, getDocs, query, where, updateDoc, 
    deleteDoc, onSnapshot, doc, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM - Selectores
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");
const btnNuevaCita = document.getElementById("btnNuevaCita");
const guardarCita = document.getElementById("guardarCita");
const cancelarModal = document.getElementById("cancelarModal");
const clienteNombre = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");

// Elementos del Hero (Visuales)
const numeroDia = document.getElementById("numeroDia");
const mesTexto = document.getElementById("mes");
const diaSemanaTexto = document.getElementById("diaSemana");

// Estado de la aplicación
let carrito = [];
let horaSeleccionada = null;
let serviciosMap = {};
let clientesMap = {};
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

// --------------------
// Utilidades Visuales
// --------------------
function actualizarHeroFecha(fechaStr) {
    const fecha = new Date(fechaStr + "T00:00:00");
    const opcionesMes = { month: 'long' };
    const opcionesDia = { weekday: 'long' };

    numeroDia.textContent = fecha.getDate();
    mesTexto.textContent = fecha.toLocaleDateString('es-ES', opcionesMes);
    diaSemanaTexto.textContent = fecha.toLocaleDateString('es-ES', opcionesDia);
}

function horaAMinutos(h) {
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + mm;
}

// --------------------
// Lógica del Carrito en Modal
// --------------------
function actualizarCarrito() {
    let carritoDiv = document.getElementById("listaServicios");
    const tiempoTotalSpan = document.getElementById("tiempoTotal");

    carritoDiv.innerHTML = carrito.map((s, i) => `
        <li>
            <span>${s.nombre}</span>
            <span>${s.duracion} min <b class="remove" data-index="${i}" style="color:red; cursor:pointer; margin-left:10px;">✕</b></span>
        </li>
    `).join("");

    const total = carrito.reduce((acc, s) => acc + (parseInt(s.duracion) || 0), 0);
    tiempoTotalSpan.textContent = total;

    // Eventos para eliminar del carrito
    carritoDiv.querySelectorAll(".remove").forEach(btn => {
        btn.onclick = () => {
            carrito.splice(btn.dataset.index, 1);
            actualizarCarrito();
        };
    });
}

// --------------------
// Carga de Datos desde Firebase
// --------------------
async function cargarServicios() {
    const snap = await getDocs(collection(db, "servicios"));
    servicioSelect.innerHTML = `<option value="">-- Seleccionar Servicio --</option>`;
    snap.forEach(d => {
        const s = d.data();
        serviciosMap[d.id] = { id: d.id, ...s };
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = `${s.nombre} (${s.duracion} min)`;
        servicioSelect.appendChild(opt);
    });
}

async function cargarClientes() {
    const snap = await getDocs(collection(db, "clientes"));
    snap.forEach(d => { clientesMap[d.id] = d.data(); });
}

// --------------------
// Renderizado de Agenda
// --------------------
async function cargarAgenda(fecha) {
    actualizarHeroFecha(fecha);
    tbody.innerHTML = "";

    const snap = await getDocs(query(collection(db, "citas"), where("fecha", "==", fecha)));
    const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    HORAS.forEach(hora => {
        const tr = document.createElement("tr");
        const citasHora = citas.filter(c => c.hora === hora);

        if (citasHora.length === 0) {
            // Fila Disponible
            tr.innerHTML = `
                <td>${hora}</td>
                <td colspan="3" class="libre">Disponible</td>
                <td><span class="badge-status">Libre</span></td>
                <td><button class="btn-add-table" data-hora="${hora}">+</button></td>
            `;
            tr.querySelector(".libre").onclick = () => abrirModalNuevaCita(hora);
        } else {
            // Fila Ocupada (Muestra la primera cita, o lógica de simultaneidad)
            const c = citasHora[0];
            tr.innerHTML = `
                <td>${hora}</td>
                <td><b>${clientesMap[c.clienteId]?.nombre || c.clienteId}</b></td>
                <td>${serviciosMap[c.servicioId]?.nombre || 'Servicio'}</td>
                <td>${c.duracion} min</td>
                <td class="ocupado">Ocupado</td>
                <td>
                    <button class="accion-btn eliminar" data-id="${c.id}">🗑️</button>
                </td>
            `;
        }
        tbody.appendChild(tr);
    });

    // Eventos de botones en la tabla
    tbody.querySelectorAll(".eliminar").forEach(btn => {
        btn.onclick = async () => {
            if (confirm("¿Eliminar cita?")) {
                await deleteDoc(doc(db, "citas", btn.dataset.id));
                cargarAgenda(fechaInput.value);
            }
        };
    });
}

// --------------------
// Acciones de Modal
// --------------------
function abrirModalNuevaCita(hora = null) {
    horaSeleccionada = hora;
    clienteNombre.value = "";
    carrito = [];
    actualizarCarrito();
    modal.classList.add("active");
}

servicioSelect.addEventListener("change", () => {
    const id = servicioSelect.value;
    if (id && serviciosMap[id]) {
        carrito.push(serviciosMap[id]);
        actualizarCarrito();
        servicioSelect.value = ""; // Reset select
    }
});

guardarCita.onclick = async () => {
    if (!clienteNombre.value || carrito.length === 0) return alert("Faltan datos");
    
    try {
        for (const s of carrito) {
            await addDoc(collection(db, "citas"), {
                fecha: fechaInput.value,
                hora: horaSeleccionada || "08:00", // Default si viene de "Nueva Cita" general
                clienteId: clienteNombre.value,
                servicioId: s.id,
                duracion: s.duracion,
                simultaneo: s.simultaneo || false,
                creado: Timestamp.now()
            });
        }
        modal.classList.remove("active");
        cargarAgenda(fechaInput.value);
    } catch (e) {
        console.error(e);
        alert("Error al guardar");
    }
};

// --------------------
// Inicialización
// --------------------
document.addEventListener("DOMContentLoaded", async () => {
    const hoy = new Date().toISOString().split("T")[0];
    fechaInput.value = hoy;
    
    await cargarServicios();
    await cargarClientes();
    cargarAgenda(hoy);

    // Escuchar cambios de fecha
    fechaInput.addEventListener("change", (e) => cargarAgenda(e.target.value));
    
    // Botón nueva cita general
    btnNuevaCita.onclick = () => abrirModalNuevaCita();
    cancelarModal.onclick = () => modal.classList.remove("active");
});

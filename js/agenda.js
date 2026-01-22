import { db } from "./firebase.js";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");
const servicioSelect = document.getElementById("servicioSelect");
const clienteNombre = document.getElementById("clienteNombre");

let carrito = [];
let horaSeleccionada = null;
let serviciosMap = {};
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

// Actualizar textos del Hero
function actualizarUIFecha(fechaStr) {
    const fecha = new Date(fechaStr + "T00:00:00");
    document.getElementById("numeroDia").textContent = fecha.getDate();
    document.getElementById("mes").textContent = fecha.toLocaleDateString('es-ES', { month: 'long' });
    document.getElementById("diaSemana").textContent = fecha.toLocaleDateString('es-ES', { weekday: 'long' });
}

// Cargar Servicios
async function cargarServicios() {
    const snap = await getDocs(collection(db, "servicios"));
    servicioSelect.innerHTML = '<option value="">+ Añadir servicio</option>';
    snap.forEach(d => {
        serviciosMap[d.id] = d.data();
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = `${d.data().nombre} (${d.data().duracion} min)`;
        servicioSelect.appendChild(opt);
    });
}

// Cargar Tabla
async function cargarAgenda(fecha) {
    actualizarUIFecha(fecha);
    tbody.innerHTML = "";
    const snap = await getDocs(query(collection(db, "citas"), where("fecha", "==", fecha)));
    const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    HORAS.forEach(hora => {
        const cita = citas.find(c => c.hora === hora);
        const tr = document.createElement("tr");

        if (!cita) {
            tr.innerHTML = `
                <td>${hora}</td>
                <td colspan="3" class="libre">Disponible</td>
                <td>Libre</td>
                <td><button onclick="abrirModal('${hora}')" style="cursor:pointer; background:none; border:none;">➕</button></td>
            `;
        } else {
            tr.innerHTML = `
                <td>${hora}</td>
                <td><b>${cita.clienteId}</b></td>
                <td>${serviciosMap[cita.servicioId]?.nombre || 'Servicio'}</td>
                <td>${cita.duracion} min</td>
                <td class="ocupado">Ocupado</td>
                <td><button class="btn-delete" data-id="${cita.id}">🗑️</button></td>
            `;
        }
        tbody.appendChild(tr);
    });
}

// Manejo de Modal
window.abrirModal = (hora) => {
    horaSeleccionada = hora;
    document.getElementById("infoHoraSeleccionada").textContent = `Horario seleccionado: ${hora}`;
    modal.classList.add("active");
};

document.getElementById("cancelarModal").onclick = () => modal.classList.remove("active");

document.getElementById("guardarCita").onclick = async () => {
    if(!clienteNombre.value || carrito.length === 0) return alert("Completa los datos");
    
    for (const s of carrito) {
        await addDoc(collection(db, "citas"), {
            fecha: fechaInput.value,
            hora: horaSeleccionada,
            clienteId: clienteNombre.value,
            servicioId: s.id,
            duracion: s.duracion
        });
    }
    modal.classList.remove("active");
    cargarAgenda(fechaInput.value);
};

// Carrito
servicioSelect.onchange = () => {
    const id = servicioSelect.value;
    if(id) {
        carrito.push({ id, ...serviciosMap[id] });
        actualizarCarritoUI();
    }
};

function actualizarCarritoUI() {
    const lista = document.getElementById("listaServicios");
    lista.innerHTML = carrito.map(s => `<li>${s.nombre} <span>${s.duracion} min</span></li>`).join("");
    document.getElementById("tiempoTotal").textContent = carrito.reduce((acc, s) => acc + s.duracion, 0);
}

// Init
document.addEventListener("DOMContentLoaded", () => {
    const hoy = new Date().toISOString().split("T")[0];
    fechaInput.value = hoy;
    cargarServicios();
    cargarAgenda(hoy);
    fechaInput.onchange = () => cargarAgenda(fechaInput.value);
});

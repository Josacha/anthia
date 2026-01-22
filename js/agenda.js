import { db } from "./firebase.js";
import { 
    collection, addDoc, getDocs, query, where, deleteDoc, doc, limit 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");
const servicioSelect = document.getElementById("servicioSelect");

// Inputs de nombre completo
const inputNombre = document.getElementById("clienteNombre");
const inputApe1 = document.getElementById("clienteApellido1");
const inputApe2 = document.getElementById("clienteApellido2");

let carrito = [];
let horaSeleccionada = null;
let serviciosMap = {};
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

/**
 * VALIDACIÓN CLAVE: Verifica si el horario ya está ocupado
 * Igual a la lógica del sistema de reserva
 */
async function verificarDisponibilidad(fecha, hora) {
    const q = query(
        collection(db, "citas"), 
        where("fecha", "==", fecha), 
        where("hora", "==", hora),
        limit(1)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty; // true si está disponible
}

// 1. Cargar Servicios para el Select
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

// 2. Cargar Tabla de Agenda
async function cargarAgenda(fecha) {
    tbody.innerHTML = "<tr><td colspan='6'>Cargando agenda...</td></tr>";
    
    try {
        const snap = await getDocs(query(collection(db, "citas"), where("fecha", "==", fecha)));
        const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        tbody.innerHTML = "";
        HORAS.forEach(hora => {
            const cita = citas.find(c => c.hora === hora);
            const tr = document.createElement("tr");

            if (!cita) {
                tr.innerHTML = `
                    <td>${hora}</td>
                    <td colspan="3" class="libre" onclick="abrirModal('${hora}')">Disponible</td>
                    <td><span class="badge-libre">Libre</span></td>
                    <td><button onclick="abrirModal('${hora}')" class="btn-add">➕</button></td>
                `;
            } else {
                tr.innerHTML = `
                    <td>${hora}</td>
                    <td><b>${cita.clienteNombreCompleto || 'Sin nombre'}</b></td>
                    <td>${serviciosMap[cita.servicioId]?.nombre || 'Servicio'}</td>
                    <td>${cita.duracion} min</td>
                    <td class="ocupado">Ocupado</td>
                    <td><button class="btn-delete" onclick="eliminarCita('${cita.id}')">🗑️</button></td>
                `;
            }
            tbody.appendChild(tr);
        });
        actualizarHeroFecha(fecha);
    } catch (error) {
        console.error("Error al cargar agenda:", error);
    }
}

// 3. Guardar Cita con Validaciones de Reserva
document.getElementById("guardarCita").onclick = async () => {
    // A. Validar campos vacíos
    if(!inputNombre.value.trim() || !inputApe1.value.trim() || carrito.length === 0) {
        alert("Por favor complete el nombre, al menos el primer apellido y seleccione un servicio.");
        return;
    }

    const fecha = fechaInput.value;
    const nombreCompleto = `${inputNombre.value} ${inputApe1.value} ${inputApe2.value}`.trim();

    // B. Bloquear botón para evitar doble clic
    const btnGuardar = document.getElementById("guardarCita");
    btnGuardar.disabled = true;
    btnGuardar.textContent = "Validando...";

    // C. Validación de Disponibilidad (Crucial para evitar duplicados)
    const estaDisponible = await verificarDisponibilidad(fecha, horaSeleccionada);
    
    if (!estaDisponible) {
        alert("Lo sentimos, este horario acaba de ser ocupado. Por favor elija otro.");
        btnGuardar.disabled = false;
        btnGuardar.textContent = "Confirmar Reserva";
        cerrarModal();
        cargarAgenda(fecha);
        return;
    }

    // D. Proceso de Guardado
    try {
        // En la agenda administrativa, guardamos los servicios seleccionados
        for (const s of carrito) {
            await addDoc(collection(db, "citas"), {
                fecha: fecha,
                hora: horaSeleccionada,
                clienteNombreCompleto: nombreCompleto,
                servicioId: s.id,
                duracion: s.duracion,
                creadoEn: new Date(),
                origen: "Panel Administrativo"
            });
        }
        
        alert("Cita agendada correctamente.");
        cerrarModal();
        cargarAgenda(fecha);
    } catch (e) {
        alert("Error al guardar la cita: " + e.message);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = "Confirmar Reserva";
    }
};

// --- Funciones de Soporte ---

window.abrirModal = (hora) => {
    horaSeleccionada = hora;
    document.getElementById("infoHoraSeleccionada").textContent = `Horario: ${hora}`;
    modal.classList.add("active");
};

function cerrarModal() {
    modal.classList.remove("active");
    inputNombre.value = "";
    inputApe1.value = "";
    inputApe2.value = "";
    carrito = [];
    actualizarCarritoUI();
}

window.eliminarCita = async (id) => {
    if(confirm("¿Está seguro de que desea eliminar esta cita?")) {
        await deleteDoc(doc(db, "citas", id));
        cargarAgenda(fechaInput.value);
    }
};

servicioSelect.onchange = () => {
    const id = servicioSelect.value;
    if(id) {
        // Evitar duplicar el mismo servicio en la misma cita
        if(carrito.find(s => s.id === id)) return; 
        
        carrito.push({ id, ...serviciosMap[id] });
        actualizarCarritoUI();
        servicioSelect.value = "";
    }
};

function actualizarCarritoUI() {
    const lista = document.getElementById("listaServicios");
    lista.innerHTML = carrito.map((s, index) => `
        <li>
            ${s.nombre} <span>${s.duracion} min</span>
            <small onclick="quitarServicio(${index})" style="color:red; cursor:pointer; margin-left:10px;">✕</small>
        </li>
    `).join("");
    document.getElementById("tiempoTotal").textContent = carrito.reduce((acc, s) => acc + s.duracion, 0);
}

window.quitarServicio = (index) => {
    carrito.splice(index, 1);
    actualizarCarritoUI();
};

function actualizarHeroFecha(fechaStr) {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const fecha = new Date(fechaStr + "T00:00:00");
    document.getElementById("numeroDia").textContent = fecha.getDate();
    document.getElementById("mes").textContent = meses[fecha.getMonth()];
    document.getElementById("diaSemana").textContent = dias[fecha.getDay()];
}

// Inicialización al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    const hoy = new Date().toISOString().split("T")[0];
    fechaInput.value = hoy;
    cargarServicios();
    cargarAgenda(hoy);
    
    fechaInput.onchange = () => cargarAgenda(fechaInput.value);
    document.getElementById("cancelarModal").onclick = cerrarModal;
});

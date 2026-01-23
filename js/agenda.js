import { db } from "./firebase.js";
import {
    collection, addDoc, getDocs, query, where, deleteDoc, onSnapshot, doc, setDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- SELECTORES ---
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");
const clienteNombre = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");
const listaSugerencias = document.getElementById("listaSugerencias");

// --- ESTADO DE LA APLICACIÓN ---
let carrito = [];
let horaSeleccionada = null;
let clienteSeleccionadoId = null;
let serviciosMap = {};
let clientesMap = {};
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

// --- UTILIDADES DE TIEMPO (Reglas de negocio) ---
const hAMin = (h) => { 
    const [hh, mm] = h.split(":").map(Number); 
    return hh * 60 + mm; 
};
const minAH = (min) => {
    const hh = Math.floor(min / 60).toString().padStart(2, '0');
    const mm = (min % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

// --- NOTIFICACIONES Y MONITOR DE PREMIOS ---
function mostrarAvisoPremio(nombre, tipoPremio) {
    const push = document.getElementById("notificacionPush");
    if (!push) return;
    document.getElementById("pushCliente").textContent = nombre;
    document.getElementById("pushDetalle").textContent = `¡Llegó a su cita! Aplica: ${tipoPremio}`;
    push.classList.add("active");
    setTimeout(() => push.classList.remove("active"), 12000); // 12 seg de visibilidad
}

window.cerrarPush = () => document.getElementById("notificacionPush").classList.remove("active");

function iniciarMonitorDePremios() {
    const hoy = new Date().toISOString().split('T')[0];
    onSnapshot(query(collection(db, "citas"), where("fecha", "==", hoy)), (snapshot) => {
        setInterval(async () => {
            const ahora = new Date();
            const horaActual = ahora.getHours().toString().padStart(2, '0') + ":" + 
                             ahora.getMinutes().toString().padStart(2, '0');

            snapshot.forEach(async (docCita) => {
                const cita = docCita.data();
                if (cita.hora === horaActual && !cita.avisoMostrado) {
                    const qH = query(collection(db, "citas"), where("clienteId", "==", cita.clienteId));
                    const snapH = await getDocs(qH);
                    const numCita = snapH.size;
                    const ciclo = numCita % 10 === 0 ? 10 : numCita % 10;
                    
                    const nombreCli = clientesMap[cita.clienteId]?.nombre || "Cliente";

                    if (ciclo === 5) mostrarAvisoPremio(nombreCli, "🎁 50% DE DESCUENTO");
                    else if (ciclo === 10) mostrarAvisoPremio(nombreCli, "✨ ¡SERVICIO GRATIS!");
                    
                    // Nota: Para marcar como avisado en tiempo real sin recargar, 
                    // podrías actualizar el doc en Firebase aquí.
                }
            });
        }, 60000); 
    });
}

// --- LÓGICA DE DATOS ---
async function cargarDatos() {
    const [sSnap, cSnap] = await Promise.all([
        getDocs(collection(db, "servicios")), 
        getDocs(collection(db, "clientes"))
    ]);
    
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

// BUSCADOR PREDICTIVO (Igual que tu reserva externa)
clienteNombre.addEventListener("input", (e) => {
    const busqueda = e.target.value.toLowerCase();
    listaSugerencias.innerHTML = "";
    if (busqueda.length < 2) { listaSugerencias.style.display = "none"; return; }

    const sugerencias = Object.entries(clientesMap).filter(([id, c]) => 
        `${c.nombre} ${c.apellido1}`.toLowerCase().includes(busqueda) || 
        (c.correo || "").toLowerCase().includes(busqueda)
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
    
    tbody.innerHTML = "";
    HORAS.forEach(hora => {
        const tr = document.createElement("tr");
        const actualMin = hAMin(hora);
        
        const ocupantes = citas.filter(c => {
            const inicio = hAMin(c.hora);
            const fin = inicio + (c.duracion || 60);
            return actualMin >= inicio && actualMin < fin;
        });

        if (ocupantes.length === 0) {
            tr.innerHTML = `<td>${hora}</td><td colspan="2" class="libre" onclick="window.abrirModal('${hora}')">Disponible</td><td>-</td><td><button onclick="window.abrirModal('${hora}')">➕</button></td>`;
        } else {
            ocupantes.forEach((c, i) => {
                const row = i === 0 ? tr : document.createElement("tr");
                const cli = clientesMap[c.clienteId];
                const nombreStr = cli ? `${cli.nombre} ${cli.apellido1 || ''}` : "Cliente";
                row.innerHTML = `<td>${hora}</td><td><b>${nombreStr}</b></td><td>${serviciosMap[c.servicioId]?.nombre || 'Servicio'}</td><td>${c.simultaneo ? '✨' : '🔒'}</td><td><button class="btn-eliminar" onclick="window.eliminar('${c.id}')">🗑️</button></td>`;
                if (i > 0) tbody.appendChild(row);
            });
        }
        tbody.appendChild(tr);
    });
}

// --- MANEJO DEL CARRITO Y MODAL ---
window.abrirModal = (hora) => {
    horaSeleccionada = hora; carrito = [];
    document.getElementById("infoHoraSeleccionada").textContent = `Horario: ${hora}`;
    actualizarCarritoUI();
    modal.classList.add("active");
};

function actualizarCarritoUI() {
    const lista = document.getElementById("listaServicios");
    lista.innerHTML = carrito.map((s, i) => `<li>${s.nombre} <b onclick="window.quitar(${i})" style="color:red;cursor:pointer;margin-left:10px;">✕</b></li>`).join("");
    const duracionTotal = carrito.reduce((a, b) => a + b.duracion, 0);
    document.getElementById("displayInicio").textContent = horaSeleccionada || "--:--";
    if(horaSeleccionada) document.getElementById("displayFin").textContent = minAH(hAMin(horaSeleccionada) + duracionTotal);
}

window.quitar = (i) => { carrito.splice(i,1); actualizarCarritoUI(); };

servicioSelect.onchange = () => {
    if(servicioSelect.value) {
        const s = serviciosMap[servicioSelect.value];
        carrito.push({ ...s, duracion: parseInt(s.duracion) || 60 });
        actualizarCarritoUI();
        servicioSelect.value = "";
    }
};

// --- GUARDAR CON REGLAS DE SIMULTANEIDAD (Igual que reserva externa) ---
document.getElementById("guardarCita").onclick = async () => {
    if(!horaSeleccionada || carrito.length === 0 || !clienteNombre.value) return alert("Faltan datos");

    const fechaAct = fechaInput.value;
    const snapValidar = await getDocs(query(collection(db, "citas"), where("fecha", "==", fechaAct)));
    const citasExistentes = snapValidar.docs.map(d => d.data());

    let tiempoCorriente = hAMin(horaSeleccionada);

    try {
        for (const s of carrito) {
            const inicio = tiempoCorriente;
            const fin = inicio + s.duracion;

            // VALIDAR ESPACIO
            const ocupadas = citasExistentes.filter(c => {
                const cIni = hAMin(c.hora);
                const cFin = cIni + (c.duracion || 60);
                return !(fin <= cIni || inicio >= cFin);
            });

            if (ocupadas.length > 0) {
                const hayBloqueo = ocupadas.some(c => !c.simultaneo) || !s.simultaneo || ocupadas.length >= 2;
                if (hayBloqueo) {
                    alert(`El horario para "${s.nombre}" está ocupado o no permite más personas simultáneas.`);
                    return;
                }
            }

            // GUARDAR CITA
            await addDoc(collection(db, "citas"), {
                fecha: fechaAct,
                hora: minAH(inicio),
                clienteId: clienteSeleccionadoId || clienteNombre.value,
                servicioId: s.id,
                duracion: s.duracion,
                simultaneo: !!s.simultaneo,
                avisoMostrado: false,
                creado: Timestamp.now()
            });

            tiempoCorriente = fin; // Encadenamiento
        }

        modal.classList.remove("active");
        alert("Cita agendada con éxito.");
        // Limpiar
        clienteSeleccionadoId = null;
        clienteNombre.value = "";
        carrito = [];
    } catch (e) {
        alert("Error al guardar la cita.");
    }
};

// --- INICIALIZACIÓN ---
function actualizarHero(fechaStr) {
    const f = new Date(fechaStr + "T00:00:00");
    document.getElementById("numeroDia").textContent = f.getDate();
    document.getElementById("mes").textContent = f.toLocaleDateString('es-ES', { month: 'long' });
    document.getElementById("diaSemana").textContent = f.toLocaleDateString('es-ES', { weekday: 'long' });
}

window.eliminar = async (id) => { if(confirm("¿Eliminar cita?")) await deleteDoc(doc(db, "citas", id)); };

document.addEventListener("DOMContentLoaded", async () => {
    fechaInput.value = new Date().toISOString().split("T")[0];
    await cargarDatos();
    cargarAgenda(fechaInput.value);
    
    iniciarMonitorDePremios(); // Activar notificaciones automáticas

    fechaInput.onchange = () => cargarAgenda(fechaInput.value);
    document.getElementById("cancelarModal").onclick = () => modal.classList.remove("active");
    
    // Escuchar cambios globales en citas para refrescar tabla
    onSnapshot(collection(db, "citas"), () => cargarAgenda(fechaInput.value));
});

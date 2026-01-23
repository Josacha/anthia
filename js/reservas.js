import { db } from "./firebase.js";
import { 
    collection, addDoc, setDoc, doc, getDocs, query, where, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const formReserva = document.getElementById("formReserva");
const correoInput = document.getElementById("correo");
const telefonoInput = document.getElementById("telefono");
const nombreInput = document.getElementById("nombre");
const apellido1Input = document.getElementById("apellido1");
const fechaInput = document.getElementById("fecha");
const carritoDiv = document.getElementById("carritoServicios");
const serviciosGrid = document.getElementById("serviciosGrid");
const calendarioContenedor = document.getElementById("calendarioSemanas");
const horasVisualGrid = document.getElementById("horasVisualGrid");

const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
let carrito = [];
let horaSeleccionada = "";

const hAMin = (h) => { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; };
const minAH = (min) => {
    const hh = Math.floor(min / 60).toString().padStart(2, '0');
    const mm = (min % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

// --- LÓGICA DE HORAS DISPONIBLES (REVISIÓN DE RANGO COMPLETO) ---
async function cargarHorasDisponibles() {
    horasVisualGrid.innerHTML = "";
    const fechaSeleccionada = fechaInput.value;
    if (!fechaSeleccionada || carrito.length === 0) {
        horasVisualGrid.innerHTML = "<p style='font-size:12px; color:#aaa;'>Selecciona servicios y fecha.</p>";
        return;
    }

    const q = query(collection(db, "citas"), where("fecha", "==", fechaSeleccionada));
    const snapshotCitas = await getDocs(q);
    const citasDelDia = snapshotCitas.docs.map(d => d.data());

    for (const hApertura of HORAS) {
        let tiempoCorriente = hAMin(hApertura);
        let esPosibleTodoElRango = true;

        // ESTE BUCLE REVISA EL ENCADENAMIENTO
        for (const s of carrito) {
            const inicioPropuesto = tiempoCorriente;
            const finPropuesto = inicioPropuesto + (Number(s.duracion) || 60);

            // Buscamos si hay choque en este "eslabón" de la cadena
            const ocupantes = citasDelDia.filter(c => {
                const cIni = hAMin(c.hora);
                const cFin = cIni + (Number(c.duracion) || 60);
                return (inicioPropuesto < cFin && finPropuesto > cIni);
            });

            if (ocupantes.length > 0) {
                // REGLA DE ORO: Si hay candado 🔒 o cabina llena, se rompe la posibilidad
                const tieneBloqueo = ocupantes.some(c => c.simultaneo !== true);
                const cabinaLlena = ocupantes.length >= 2;

                if (tieneBloqueo || cabinaLlena) {
                    esPosibleTodoElRango = false;
                    break; // Deja de revisar el resto del carrito para esta hora
                }
            }
            // Saltamos al siguiente bloque de tiempo del carrito
            tiempoCorriente = finPropuesto;
        }

        if (esPosibleTodoElRango) {
            const btn = document.createElement("div");
            btn.className = "hour-item";
            btn.textContent = hApertura;
            if (horaSeleccionada === hApertura) btn.classList.add("selected");
            btn.onclick = () => {
                document.querySelectorAll(".hour-item").forEach(el => el.classList.remove("selected"));
                btn.classList.add("selected");
                horaSeleccionada = hApertura;
            };
            horasVisualGrid.appendChild(btn);
        }
    }
}

// --- RESTO DE FUNCIONES MANTENIDAS ---
function generarCalendario() {
    calendarioContenedor.innerHTML = "";
    const hoy = new Date();
    let diasContados = 0; let offset = 0;
    while (diasContados < 7) {
        let d = new Date(); d.setDate(hoy.getDate() + offset); offset++;
        if (d.getDay() === 0) continue; 
        const diaCard = document.createElement("div");
        diaCard.className = "day-item";
        const isoFecha = d.toISOString().split('T')[0];
        diaCard.innerHTML = `<span class="mes">${d.toLocaleString('es', { weekday: 'short' })}</span><span class="num">${d.getDate()}</span><span class="mes">${d.toLocaleString('es', { month: 'short' })}</span>`;
        diaCard.onclick = () => {
            document.querySelectorAll(".day-item").forEach(el => el.classList.remove("selected"));
            diaCard.classList.add("selected");
            fechaInput.value = isoFecha;
            cargarHorasDisponibles(); 
        };
        calendarioContenedor.appendChild(diaCard); diasContados++;
    }
}

async function cargarServicios() {
    serviciosGrid.innerHTML = "";
    const snapshot = await getDocs(collection(db, "servicios"));
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const card = document.createElement("div");
        card.className = "service-card";
        card.innerHTML = `<h4>${data.nombre}</h4><span>₡${data.precio}</span><p>${data.duracion || 60} min</p>`;
        card.onclick = () => {
            const index = carrito.findIndex(s => s.id === docSnap.id);
            if (index > -1) { carrito.splice(index, 1); card.classList.remove("selected"); }
            else { carrito.push({ id: docSnap.id, nombre: data.nombre, duracion: Number(data.duracion)||60, simultaneo: data.simultaneo === true }); card.classList.add("selected"); }
            renderCarrito(); cargarHorasDisponibles();
        };
        serviciosGrid.appendChild(card);
    });
}

function renderCarrito() {
    carritoDiv.innerHTML = "";
    if (carrito.length === 0) return;
    let total = carrito.reduce((sum, s) => sum + s.duracion, 0);
    carritoDiv.innerHTML = `<div class="resumen-badge"><p>RESUMEN DE SELECCIÓN:</p>${carrito.map(s => `<div class='resumen-item'><span>${s.nombre}</span><span>${s.duracion} min</span></div>`).join('')}<div class='resumen-total'><span>Total</span><span>${total} min</span></div></div>`;
}

formReserva.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!fechaInput.value || !horaSeleccionada || carrito.length === 0) return alert("Faltan datos");
    try {
        const idClie = (correoInput.value || telefonoInput.value).replace(/[.#$[\]]/g,'_');
        await setDoc(doc(db, "clientes", idClie), { nombre: nombreInput.value, apellido1: apellido1Input.value, correo: correoInput.value, telefono: telefonoInput.value }, { merge: true });
        let t = hAMin(horaSeleccionada);
        for (const s of carrito) {
            await addDoc(collection(db, "citas"), { clienteId: idClie, servicioId: s.id, fecha: fechaInput.value, hora: minAH(t), duracion: s.duracion, simultaneo: s.simultaneo, avisoMostrado: false, creado: Timestamp.now() });
            t += s.duracion;
        }
        alert("¡Reserva exitosa!"); window.location.reload();
    } catch (err) { alert("Error al guardar"); }
});

generarCalendario();
cargarServicios();

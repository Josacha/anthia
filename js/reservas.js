import { db } from "./firebase.js";
import { 
    collection, addDoc, setDoc, doc, getDocs, query, where, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
let carrito = [];
let horaSeleccionada = "";

// --- UTILIDADES MATEMÁTICAS ---
const hAMin = (h) => { 
    const [hh, mm] = h.split(":").map(Number); 
    return (hh * 60) + mm; 
};
const minAH = (min) => {
    const hh = Math.floor(min / 60).toString().padStart(2, '0');
    const mm = (min % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

// --- LÓGICA DE DISPONIBILIDAD ---
async function cargarHorasDisponibles() {
    const horasVisualGrid = document.getElementById("horasVisualGrid");
    const fechaInput = document.getElementById("fecha");
    horasVisualGrid.innerHTML = "";
    
    if (!fechaInput.value || carrito.length === 0) return;

    const q = query(collection(db, "citas"), where("fecha", "==", fechaInput.value));
    const snap = await getDocs(q);
    const citasDelDia = snap.docs.map(d => d.data());

    for (const hApertura of HORAS) {
        let tiempoCorriente = hAMin(hApertura);
        let esPosibleTodoElRango = true;

        for (const s of carrito) {
            const inicioPropuesto = Number(tiempoCorriente);
            const duracionS = Number(s.duracion) || 60;
            const finPropuesto = inicioPropuesto + duracionS;

            // Revisar choques en este bloque
            const ocupantes = citasDelDia.filter(c => {
                const cIni = hAMin(c.hora);
                const cFin = cIni + (Number(c.duracion) || 60);
                return (inicioPropuesto < cFin && finPropuesto > cIni);
            });

            if (ocupantes.length > 0) {
                // REGLA: Solo simultáneo si el PRIMERO lo permite
                const elPrimeroEsSimultaneo = ocupantes.every(c => c.simultaneo === true);
                const cabinaLlena = ocupantes.length >= 2;
                const elNuevoEsSimultaneo = s.simultaneo === true;

                if (!elPrimeroEsSimultaneo || cabinaLlena || !elNuevoEsSimultaneo) {
                    esPosibleTodoElRango = false;
                    break;
                }
            }
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

// --- GESTIÓN DE INTERFAZ ---
async function cargarServicios() {
    const grid = document.getElementById("serviciosGrid");
    const snap = await getDocs(collection(db, "servicios"));
    grid.innerHTML = "";
    snap.forEach(docSnap => {
        const data = docSnap.data();
        const card = document.createElement("div");
        card.className = "service-card";
        card.innerHTML = `<h4>${data.nombre}</h4><p>${data.duracion} min</p>`;
        card.onclick = () => {
            const idx = carrito.findIndex(item => item.id === docSnap.id);
            if (idx > -1) { carrito.splice(idx, 1); card.classList.remove("selected"); }
            else { carrito.push({ id: docSnap.id, ...data, duracion: Number(data.duracion) }); card.classList.add("selected"); }
            cargarHorasDisponibles();
            renderCarrito();
        };
        grid.appendChild(card);
    });
}

function renderCarrito() {
    const div = document.getElementById("carritoServicios");
    div.innerHTML = carrito.length ? `<div class="resumen-badge">Total: ${carrito.reduce((s, a) => s + a.duracion, 0)} min</div>` : "";
}

// --- GUARDADO ---
document.getElementById("formReserva").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!horaSeleccionada || carrito.length === 0) return alert("Faltan datos");
    const idClie = document.getElementById("telefono").value;
    
    let t = hAMin(horaSeleccionada);
    for (const s of carrito) {
        await addDoc(collection(db, "citas"), {
            clienteId: idClie,
            servicioId: s.id,
            fecha: document.getElementById("fecha").value,
            hora: minAH(t),
            duracion: s.duracion,
            simultaneo: s.simultaneo === true,
            creado: Timestamp.now()
        });
        t += s.duracion;
    }
    alert("Reserva lista");
    window.location.reload();
});

cargarServicios();

import { db } from "./firebase.js";
import { 
    collection, addDoc, getDocs, query, where, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN ---
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
let carrito = [];
let horaSeleccionada = "";

// --- UTILIDADES MATEMÁTICAS ---
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

// --- 1. LÓGICA DE DISPONIBILIDAD ---
async function cargarHorasDisponibles() {
    const horasVisualGrid = document.getElementById("horasVisualGrid");
    const fechaInput = document.getElementById("fecha");
    
    if (!horasVisualGrid || !fechaInput) return;
    horasVisualGrid.innerHTML = "";
    
    if (!fechaInput.value || carrito.length === 0) {
        horasVisualGrid.innerHTML = "<p style='grid-column: 1/-1; text-align: center; color: #666;'>Selecciona fecha y tratamientos para ver horarios</p>";
        return;
    }

    try {
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

                const ocupantes = citasDelDia.filter(c => {
                    const cIni = hAMin(c.hora);
                    const cFin = cIni + (Number(c.duracion) || 60);
                    return (inicioPropuesto < cFin && finPropuesto > cIni);
                });

                if (ocupantes.length > 0) {
                    // REGLA: El primero debe ser simultáneo para poder entrar
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
    } catch (error) {
        console.error("Error al cargar horas:", error);
    }
}

// --- 2. GESTIÓN DE SERVICIOS ---
async function cargarServicios() {
    const grid = document.getElementById("serviciosGrid");
    if (!grid) return;

    try {
        const snap = await getDocs(collection(db, "servicios"));
        grid.innerHTML = "";
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const card = document.createElement("div");
            card.className = "service-card";
            card.innerHTML = `<h4>${data.nombre}</h4><p>${data.duracion} min</p>`;
            card.onclick = () => {
                const idx = carrito.findIndex(item => item.id === docSnap.id);
                if (idx > -1) { 
                    carrito.splice(idx, 1); 
                    card.classList.remove("selected"); 
                } else { 
                    carrito.push({ id: docSnap.id, ...data, duracion: Number(data.duracion) }); 
                    card.classList.add("selected"); 
                }
                cargarHorasDisponibles();
                renderCarrito();
            };
            grid.appendChild(card);
        });
    } catch (error) {
        console.error("Error al cargar servicios:", error);
    }
}

function renderCarrito() {
    const div = document.getElementById("carritoServicios");
    if (!div) return;
    div.innerHTML = carrito.length ? 
        `<div class="resumen-badge">Servicios: ${carrito.length} | Total: ${carrito.reduce((s, a) => s + a.duracion, 0)} min</div>` : "";
}

// --- 3. INICIALIZACIÓN (IMPORTANTE) ---
document.addEventListener("DOMContentLoaded", () => {
    // Cargar servicios al abrir la página
    cargarServicios();

    // Listener para la fecha
    const fechaInput = document.getElementById("fecha");
    if (fechaInput) {
        // Establecer fecha de hoy por defecto
        fechaInput.min = new Date().toISOString().split("T")[0];
        fechaInput.addEventListener("change", cargarHorasDisponibles);
    }

    // Listener para el formulario de guardado
    const form = document.getElementById("formReserva");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!horaSeleccionada || carrito.length === 0) return alert("Selecciona servicios y un horario disponible");
            
            const telefono = document.getElementById("telefono").value;
            if (!telefono) return alert("Ingresa tu teléfono");

            try {
                let t = hAMin(horaSeleccionada);
                for (const s of carrito) {
                    await addDoc(collection(db, "citas"), {
                        clienteId: telefono,
                        servicioId: s.id,
                        fecha: fechaInput.value,
                        hora: minAH(t),
                        duracion: s.duracion,
                        simultaneo: s.simultaneo === true,
                        creado: Timestamp.now()
                    });
                    t += s.duracion;
                }
                alert("¡Cita reservada con éxito!");
                window.location.reload();
            } catch (error) {
                console.error("Error al guardar:", error);
                alert("Hubo un error al guardar la cita.");
            }
        });
    }
});

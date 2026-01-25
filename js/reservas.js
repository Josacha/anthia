import { db } from "./firebase.js";
import { 
    collection, addDoc, setDoc, doc, getDocs, query, where, Timestamp, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN ---
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
const NUMERO_WHATSAPP = "50686920294"; // <-- Reemplaza con el número real de Andre
let carrito = [];
let horaSeleccionada = "";
let ultimaFechaConsultada = "";
let desuscribirCitas = null;

// Inicializar EmailJS
emailjs.init("s8xK3KN3XQ4g9Qccg");

// --- UTILIDADES ---
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

// --- MOTOR DE DISPONIBILIDAD ---
async function cargarHorasDisponibles() {
    const horasVisualGrid = document.getElementById("horasVisualGrid");
    const fechaInput = document.getElementById("fecha");
    if (!horasVisualGrid || !fechaInput) return;

    const requiereValoracion = verificarSiRequiereValoracion();
    if (requiereValoracion) {
        horasVisualGrid.innerHTML = `
            <div class="aviso-whatsapp-inline">
                <p>Para este servicio, Andre coordinará la hora directamente contigo tras la valoración técnica.</p>
            </div>`;
        return;
    }

    const fechaSeleccionada = fechaInput.value;
    if (!fechaSeleccionada || carrito.length === 0) {
        horasVisualGrid.innerHTML = "<p style='font-size:12px; color:#aaa; text-align:center;'>Selecciona servicios y fecha.</p>";
        return;
    }

    if (desuscribirCitas && fechaSeleccionada !== ultimaFechaConsultada) {
        desuscribirCitas();
        desuscribirCitas = null;
    }

    if (!desuscribirCitas) {
        const q = query(collection(db, "citas"), where("fecha", "==", fechaSeleccionada));
        desuscribirCitas = onSnapshot(q, (snapshot) => {
            const citasExistentes = snapshot.docs.map(d => {
                const data = d.data();
                const ini = hAMin(data.hora);
                return {
                    inicio: ini,
                    fin: ini + (Number(data.duracion) || 60),
                    simultaneo: data.simultaneo === true 
                };
            });
            ultimaFechaConsultada = fechaSeleccionada;
            renderizarBotones(citasExistentes);
        });
    }
}

function renderizarBotones(citasExistentes) {
    const horasVisualGrid = document.getElementById("horasVisualGrid");
    horasVisualGrid.innerHTML = ""; 

    HORAS.forEach(hApertura => {
        let tiempoCorriente = hAMin(hApertura);
        let esPosibleTodoElCombo = true;

        for (const s of carrito) {
            const inicioNuevo = tiempoCorriente;
            const duracionNuevo = Number(s.duracion) || 60;
            const finNuevo = inicioNuevo + duracionNuevo;

            const ocupantes = citasExistentes.filter(c => (inicioNuevo < c.fin && finNuevo > c.inicio));

            if (ocupantes.length > 0) {
                // REGLA DE ORO [cite: 2026-01-23]
                const existentesPermiten = ocupantes.every(c => c.simultaneo === true);
                const nuevoPermite = s.simultaneo === true;
                const hayCupo = ocupantes.length < 2;

                if (!existentesPermiten || !nuevoPermite || !hayCupo) {
                    esPosibleTodoElCombo = false;
                    break;
                }
            }
            tiempoCorriente = finNuevo;
        }

        if (esPosibleTodoElCombo) {
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
    });
}

// --- GESTIÓN DE SERVICIOS ---
function verificarSiRequiereValoracion() {
    return carrito.some(s => 
        s.duracion >= 240 || 
        s.nombre.toLowerCase().includes("alaciado") || 
        s.nombre.toLowerCase().includes("color")
    );
}

async function cargarServicios() {
    const serviciosGrid = document.getElementById("serviciosGrid");
    const categoriasFilter = document.getElementById("categoriasFilter");
    if (!serviciosGrid) return;

    const snapshot = await getDocs(collection(db, "servicios"));
    const todosLosServicios = [];
    const categoriasSet = new Set(["Todos"]);

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        todosLosServicios.push({ id: docSnap.id, ...data });
        if (data.categoria) categoriasSet.add(data.categoria);
    });

    categoriasFilter.innerHTML = "";
    categoriasSet.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = "cat-btn" + (cat === "Todos" ? " active" : "");
        btn.textContent = cat;
        btn.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            renderizarGrid(todosLosServicios, cat);
        };
        categoriasFilter.appendChild(btn);
    });

    function renderizarGrid(servicios, filtro) {
        serviciosGrid.innerHTML = "";
        const filtrados = filtro === "Todos" ? servicios : servicios.filter(s => s.categoria === filtro);

        filtrados.forEach(s => {
            const card = document.createElement("div");
            card.className = "service-card";
            if (carrito.some(item => item.id === s.id)) card.classList.add("selected");
            
            let txtPrecio = s.precio.tipo === "fijo" 
                ? `₡${Number(s.precio.valor).toLocaleString()}`
                : `₡${Number(s.precio.desde).toLocaleString()} - ₡${Number(s.precio.hasta).toLocaleString()}*`;

            card.innerHTML = `
                <h4>${s.nombre}</h4>
                <span class="price-tag">${txtPrecio}</span>
                <p class="duration-tag">${s.duracion || 60} min</p>
                ${s.precio.tipo === 'rango' ? '<small style="font-size:9px; color:var(--gold);">*Sujeto a valoración</small>' : ''}
            `;
            
            card.onclick = () => {
                const index = carrito.findIndex(item => item.id === s.id);
                if (index > -1) {
                    carrito.splice(index, 1);
                    card.classList.remove("selected");
                } else {
                    carrito.push({
                        id: s.id,
                        nombre: s.nombre,
                        duracion: Number(s.duracion) || 60,
                        simultaneo: s.simultaneo === true,
                        precio_info: txtPrecio
                    });
                    card.classList.add("selected");
                }
                renderCarrito();
                cargarHorasDisponibles();
            };
            serviciosGrid.appendChild(card);
        });
    }
    renderizarGrid(todosLosServicios, "Todos");
}

function renderCarrito() {
    const carritoDiv = document.getElementById("carritoServicios");
    const btnConfirmar = document.querySelector(".btn-submit-lux");
    if (!carritoDiv) return;

    carritoDiv.innerHTML = "";
    if (carrito.length === 0) return;

    const requiereValoracion = verificarSiRequiereValoracion();
    let totalMin = carrito.reduce((sum, s) => sum + s.duracion, 0);
    
    carritoDiv.innerHTML = `
        <div class="resumen-badge">
            <p><b>TU SELECCIÓN:</b></p>
            ${carrito.map(s => `<div class='resumen-item'><span>${s.nombre}</span><span>${s.precio_info}</span></div>`).join('')}
            <div class='resumen-total'><span>Duración Estimada</span><span>${totalMin} min</span></div>
            ${requiereValoracion ? '<div class="aviso-v"><small>⚠️ Requiere valoración por WhatsApp</small></div>' : ''}
        </div>`;

    if (requiereValoracion) {
        btnConfirmar.textContent = "SOLICITAR VALORACIÓN WHATSAPP";
        btnConfirmar.classList.add("btn-whatsapp");
        btnConfirmar.dataset.modo = "whatsapp";
    } else {
        btnConfirmar.textContent = "CONFIRMAR RESERVA";
        btnConfirmar.classList.remove("btn-whatsapp");
        btnConfirmar.dataset.modo = "reserva";
    }
}

// --- ENVÍO ---
const form = document.getElementById("formReserva");
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btnSubmit = form.querySelector("button[type='submit']");
        const modo = btnSubmit.dataset.modo;
        
        const nombre = document.getElementById("nombre").value;
        const telefono = document.getElementById("telefono").value;
        const correo = document.getElementById("correo").value;
        const serviciosTxt = carrito.map(s => s.nombre).join(", ");

        if (modo === "whatsapp") {
            const msj = `¡Hola Andre! ✨%0A%0AInterés en valoración:%0A*Servicios:* ${serviciosTxt}%0A*Cliente:* ${nombre}%0A*WhatsApp:* ${telefono}`;
            window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${msj}`, '_blank');
        } else {
            if (!horaSeleccionada) return alert("Selecciona una hora.");
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Reservando...";

            try {
                const idClie = (correo || telefono).replace(/[.#$[\]]/g,'_');
                await setDoc(doc(db, "clientes", idClie), { nombre, correo, telefono }, { merge: true });

                let t = hAMin(horaSeleccionada);
                for (const s of carrito) {
                    await addDoc(collection(db, "citas"), { 
                        clienteId: idClie, servicioId: s.id, fecha: document.getElementById("fecha").value, 
                        hora: minAH(t), duracion: s.duracion, simultaneo: s.simultaneo, creado: Timestamp.now() 
                    });
                    t += s.duracion;
                }
                alert("¡Cita reservada con éxito!");
                window.location.reload();
            } catch (err) { alert("Error al reservar."); btnSubmit.disabled = false; }
        }
    });
}

// --- CALENDARIO ---
function generarCalendario() {
    const contenedor = document.getElementById("calendarioSemanas");
    const fechaInput = document.getElementById("fecha");
    if (!contenedor) return;
    
    const hoy = new Date();
    for (let i = 0; i < 10; i++) {
        let d = new Date(); d.setDate(hoy.getDate() + i);
        if (d.getDay() === 0) continue; 

        const card = document.createElement("div");
        card.className = "day-item";
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

        card.innerHTML = `<span class="mes">${d.toLocaleString('es',{weekday:'short'})}</span><span class="num">${d.getDate()}</span>`;
        card.onclick = () => {
            document.querySelectorAll(".day-item").forEach(el => el.classList.remove("selected"));
            card.classList.add("selected");
            fechaInput.value = iso;
            cargarHorasDisponibles();
        };
        contenedor.appendChild(card);
    }
}

document.addEventListener("DOMContentLoaded", () => { generarCalendario(); cargarServicios(); });

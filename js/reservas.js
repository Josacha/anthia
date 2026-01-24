import { db } from "./firebase.js";
import { 
    collection, addDoc, setDoc, doc, getDocs, query, where, Timestamp, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN ---
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
let carrito = [];
let horaSeleccionada = "";
let ultimaFechaConsultada = "";
let desuscribirCitas = null;

// --- CONFIGURACIÓN EMAILJS ---
const SERVICE_ID = "service_14jwpyq";
const TEMPLATE_ID = "template_itx9f7f";
const PUBLIC_KEY = "s8xK3KN3XQ4g9Qccg";

// Inicializar EmailJS para evitar el error "defined"
emailjs.init(PUBLIC_KEY);

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

// --- MOTOR DE DISPONIBILIDAD (SINCRO REAL) ---
async function cargarHorasDisponibles() {
    const horasVisualGrid = document.getElementById("horasVisualGrid");
    const fechaInput = document.getElementById("fecha");
    if (!horasVisualGrid || !fechaInput) return;

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
    } else {
        desuscribirCitas();
        desuscribirCitas = null;
        cargarHorasDisponibles();
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
async function cargarServicios() {
    const serviciosGrid = document.getElementById("serviciosGrid");
    const categoriasFilter = document.getElementById("categoriasFilter");
    if (!serviciosGrid) return;

    const snapshot = await getDocs(collection(db, "servicios"));
    const todosLosServicios = [];
    const categoriasSet = new Set(["Todos"]);

    // Guardamos los datos y extraemos categorías únicas
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        todosLosServicios.push({ id: docSnap.id, ...data });
        if (data.categoria) categoriasSet.add(data.categoria);
    });

    // 1. Renderizar botones de categorías
    categoriasFilter.innerHTML = "";
    categoriasSet.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = "cat-btn" + (cat === "Todos" ? " active" : "");
        btn.textContent = cat;
        btn.onclick = () => {
            document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            renderizarGrid(todosLosServicios, cat);
        };
        categoriasFilter.appendChild(btn);
    });

    // 2. Función para renderizar el grid filtrado
    function renderizarGrid(servicios, filtro) {
        serviciosGrid.innerHTML = "";
        const filtrados = filtro === "Todos" ? servicios : servicios.filter(s => s.categoria === filtro);

        filtrados.forEach(s => {
            const card = document.createElement("div");
            card.className = "service-card";
            if (carrito.some(item => item.id === s.id)) card.classList.add("selected");
            
            card.innerHTML = `
                <h4>${s.nombre}</h4>
                <span>₡${s.precio}</span>
                <p>${s.duracion || 60} min</p>
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
                        simultaneo: s.simultaneo === true
                    });
                    card.classList.add("selected");
                }
                renderCarrito();
                cargarHorasDisponibles();
            };
            serviciosGrid.appendChild(card);
        });
    }

    // Render inicial
    renderizarGrid(todosLosServicios, "Todos");
}

function renderCarrito() {
    const carritoDiv = document.getElementById("carritoServicios");
    if (!carritoDiv) return;
    carritoDiv.innerHTML = "";
    if (carrito.length === 0) return;
    let total = carrito.reduce((sum, s) => sum + s.duracion, 0);
    carritoDiv.innerHTML = `<div class="resumen-badge"><p><b>RESUMEN:</b></p>${carrito.map(s => `<div class='resumen-item'><span>${s.nombre}</span><span>${s.duracion} min</span></div>`).join('')}<div class='resumen-total'><span>Total</span><span>${total} min</span></div></div>`;
}

// --- CALENDARIO ---
function generarCalendario() {
    const calendarioContenedor = document.getElementById("calendarioSemanas");
    const fechaInput = document.getElementById("fecha");
    if (!calendarioContenedor || !fechaInput) return;
    
    calendarioContenedor.innerHTML = "";
    const hoy = new Date();
    let diasContados = 0;
    let offset = 0;

    while (diasContados < 7) {
        let d = new Date();
        d.setDate(hoy.getDate() + offset);
        offset++;
        
        if (d.getDay() === 0) continue; 

        const diaCard = document.createElement("div");
        diaCard.className = "day-item";

        const anio = d.getFullYear();
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const dia = String(d.getDate()).padStart(2, '0');
        const isoFechaLocal = `${anio}-${mes}-${dia}`;

        diaCard.innerHTML = `
            <span class="mes">${d.toLocaleString('es', { weekday: 'short' })}</span>
            <span class="num">${d.getDate()}</span>
            <span class="mes">${d.toLocaleString('es', { month: 'short' })}</span>
        `;

        diaCard.onclick = () => {
            document.querySelectorAll(".day-item").forEach(el => el.classList.remove("selected"));
            diaCard.classList.add("selected");
            fechaInput.value = isoFechaLocal; 
            cargarHorasDisponibles(); 
        };

        calendarioContenedor.appendChild(diaCard);
        diasContados++;
    }
}

// --- FORMULARIO Y ENVÍO DE CORREO ---
const form = document.getElementById("formReserva");
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!horaSeleccionada || carrito.length === 0) return alert("Selecciona servicios y hora");
        
        const btnSubmit = form.querySelector("button[type='submit']");
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Procesando...";

        try {
            const nombre = document.getElementById("nombre").value;
            const correo = document.getElementById("correo").value;
            const telefono = document.getElementById("telefono").value;
            const fecha = document.getElementById("fecha").value;
            const idClie = (correo || telefono).replace(/[.#$[\]]/g,'_');
            
            await setDoc(doc(db, "clientes", idClie), { 
                nombre: nombre, 
                apellido1: document.getElementById("apellido1").value, 
                correo: correo, 
                telefono: telefono 
            }, { merge: true });

            let t = hAMin(horaSeleccionada);
            for (const s of carrito) {
                await addDoc(collection(db, "citas"), { 
                    clienteId: idClie, 
                    servicioId: s.id, 
                    fecha: fecha, 
                    hora: minAH(t), 
                    duracion: s.duracion, 
                    simultaneo: s.simultaneo === true, 
                    creado: Timestamp.now() 
                });
                t += s.duracion;
            }

            // Enviar correo
            const templateParams = {
                nombre_cliente: nombre,
                email_cliente: correo,
                servicio: carrito.map(s => s.nombre).join(", "),
                fecha: fecha,
                hora: horaSeleccionada,
                link_calendario: `https://www.google.com/calendar/render?action=TEMPLATE&text=Cita+Anthia&dates=${fecha.replace(/-/g,'')}T${horaSeleccionada.replace(':','')}00Z`
            };

            await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);

            alert("¡Reserva exitosa! Se ha enviado un correo de confirmación."); 
            window.location.reload();

        } catch (err) { 
            console.error(err); 
            alert("Error al procesar la reserva."); 
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Confirmar Reserva";
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    generarCalendario();
    cargarServicios();
});

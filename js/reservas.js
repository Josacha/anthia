import { db } from "./firebase.js";
import { 
    collection, addDoc, setDoc, doc, getDocs, query, where, Timestamp, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN ---
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
const HORA_CIERRE = "20:00"; 
const NUMERO_WHATSAPP = "50686920294"; 
let carrito = [];
let horaSeleccionada = "";
let ultimaFechaConsultada = "";
let desuscribirCitas = null;

// Inicialización de EmailJS
emailjs.init("s8xK3KN3XQ4g9Qccg");

// --- UTILIDADES DE TIEMPO ---
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

// --- FUNCIÓN PARA GENERAR LINK DE GOOGLE CALENDAR ---
const generarGoogleCalendarLink = (nombre, servicio, fecha, hora) => {
    try {
        const baseUrl = "https://calendar.google.com/calendar/render?action=TEMPLATE";
        const titulo = encodeURIComponent(`Cita Beauty: ${servicio}`);
        const f = fecha.replace(/-/g, '');
        const hInicio = hora.replace(/:/g, '') + "00";
        let [hh, mm] = hora.split(':').map(Number);
        let hFin = `${(hh + 1).toString().padStart(2, '0')}${mm.toString().padStart(2, '0')}00`;
        const detalles = encodeURIComponent(`Hola ${nombre}, te esperamos en Andre Arias Beauty Stylist.`);
        const ubicacion = encodeURIComponent("Andre Arias Beauty Stylist, Costa Rica");
        return `${baseUrl}&text=${titulo}&dates=${f}T${hInicio}/${f}T${hFin}&details=${detalles}&location=${ubicacion}`;
    } catch (e) {
        console.error("Error al generar link:", e);
        return "#";
    }
};

// --- LÓGICA DE VALORACIÓN ---
function verificarSiRequiereValoracion() {
    if (carrito.length === 0) return false;
    return carrito.some(s => 
        s.nombre === "Alaciados/Control de volumen " || 
        s.duracion >= 300
    );
}

// --- MOTOR DE DISPONIBILIDAD ---
async function cargarHorasDisponibles() {
    const horasVisualGrid = document.getElementById("horasVisualGrid");
    const fechaInput = document.getElementById("fecha");
    if (!horasVisualGrid || !fechaInput) return;

    if (carrito.length === 0) {
        horasVisualGrid.innerHTML = "<p style='font-size:12px; color:#aaa; text-align:center;'>Selecciona servicios y fecha.</p>";
        return;
    }

    if (verificarSiRequiereValoracion()) {
        horasVisualGrid.innerHTML = `<div class="aviso-whatsapp-inline"><p>Este servicio requiere valoración técnica previa.</p></div>`;
        return;
    }

    const fechaSeleccionada = fechaInput.value;
    if (!fechaSeleccionada) {
        horasVisualGrid.innerHTML = "<p style='font-size:12px; color:#aaa; text-align:center;'>Selecciona una fecha.</p>";
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
                return { inicio: ini, fin: ini + (Number(data.duracion) || 60), simultaneo: data.simultaneo === true };
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
        for (let i = 0; i < carrito.length; i++) {
            const s = carrito[i];
            const inicioNuevo = tiempoCorriente;
            const duracionNuevo = Number(s.duracion) || 60;
            const finNuevo = inicioNuevo + duracionNuevo;
            if (finNuevo > hAMin(HORA_CIERRE)) { esPosibleTodoElCombo = false; break; }
            const ocupantes = citasExistentes.filter(c => (inicioNuevo < c.fin && finNuevo > c.inicio));
            if (ocupantes.length > 0) {
                const primerServicioPermite = carrito[0].simultaneo === true;
                const existentesPermiten = ocupantes.every(c => c.simultaneo === true);
                if (!primerServicioPermite || !existentesPermiten || ocupantes.length >= 2) { esPosibleTodoElCombo = false; break; }
            }
            tiempoCorriente = finNuevo;
        }
        if (esPosibleTodoElCombo) {
            const btn = document.createElement("div");
            btn.className = "hour-item" + (horaSeleccionada === hApertura ? " selected" : "");
            btn.textContent = hApertura;
            btn.onclick = () => {
                document.querySelectorAll(".hour-item").forEach(el => el.classList.remove("selected"));
                btn.classList.add("selected");
                horaSeleccionada = hApertura;
            };
            horasVisualGrid.appendChild(btn);
        }
    });
}

// --- CARGA DE SERVICIOS ---
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
            card.className = "service-card" + (carrito.some(item => item.id === s.id) ? " selected" : "");
            let esRango = s.precio.tipo === "rango";
            let txtPrecio = !esRango ? `₡${Number(s.precio.valor).toLocaleString()}` : `₡${Number(s.precio.desde).toLocaleString()} - ₡${Number(s.precio.hasta).toLocaleString()}*`;
            card.innerHTML = `<h4>${s.nombre}</h4><span class="price-tag">${txtPrecio}</span><p class="duration-tag">${s.duracion || 60} min</p>`;
            card.onclick = () => {
                const index = carrito.findIndex(item => item.id === s.id);
                if (index > -1) { carrito.splice(index, 1); } else {
                    carrito.push({ id: s.id, nombre: s.nombre, duracion: Number(s.duracion) || 60, simultaneo: s.simultaneo === true, precio_info: txtPrecio, esRango: esRango });
                }
                horaSeleccionada = ""; renderCarrito(); cargarHorasDisponibles();
                renderizarGrid(servicios, filtro);
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
    if (carrito.length === 0) { carritoDiv.innerHTML = ""; return; }
    const requiereWhatsApp = verificarSiRequiereValoracion();
    carritoDiv.innerHTML = `<div class="resumen-badge"><p><b>RESUMEN:</b></p>${carrito.map(s => `<div class='resumen-item'><span>${s.nombre}</span><span>${s.precio_info}</span></div>`).join('')}</div>`;
    btnConfirmar.textContent = requiereWhatsApp ? "SOLICITAR VALORACIÓN WHATSAPP" : "CONFIRMAR RESERVA";
    btnConfirmar.dataset.modo = requiereWhatsApp ? "whatsapp" : "reserva";
}

// --- ENVÍO ---
const form = document.getElementById("formReserva");
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btnSubmit = form.querySelector("button[type='submit']");
        const modo = btnSubmit.dataset.modo;
        if (modo === "whatsapp") {
            const msj = `¡Hola Andre! Me interesa valoración para: ${carrito.map(s => s.nombre).join(", ")}.`;
            window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(msj)}`, '_blank');
            return;
        }
        if (!horaSeleccionada) return alert("Selecciona una hora.");
        btnSubmit.disabled = true;
        try {
            const nombre = document.getElementById("nombre").value;
            const correo = document.getElementById("correo").value;
            const telefono = document.getElementById("telefono").value;
            const fecha = document.getElementById("fecha").value;
            const idClie = (correo || telefono).replace(/[.#$[\]]/g,'_');
            await setDoc(doc(db, "clientes", idClie), { nombre, correo, telefono }, { merge: true });
            let t = hAMin(horaSeleccionada);
            for (const s of carrito) {
                await addDoc(collection(db, "citas"), { clienteId: idClie, servicioId: s.id, fecha: fecha, hora: minAH(t), duracion: s.duracion, simultaneo: s.simultaneo, creado: Timestamp.now() });
                t += s.duracion;
            }
            alert("¡Cita reservada!");
            window.location.reload();
        } catch (err) { alert("Error al reservar."); btnSubmit.disabled = false; }
    });
}

// --- GENERACIÓN DE CALENDARIO (CORREGIDO) ---
function generarCalendario() {
    const contenedor = document.getElementById("calendarioSemanas");
    const fechaInput = document.getElementById("fecha");
    if (!contenedor) return;

    const hoy = new Date();
    const navMeses = document.createElement("div");
    navMeses.className = "nav-meses-premium";
    const gridCalendario = document.createElement("div");
    gridCalendario.id = "gridCalendarioDinamico";

    for (let m = 0; m < 4; m++) {
        const fechaMes = new Date(hoy.getFullYear(), hoy.getMonth() + m, 1);
        const botonMes = document.createElement("button");
        botonMes.className = `btn-mes ${m === 0 ? 'active' : ''}`;
        botonMes.textContent = fechaMes.toLocaleString('es', { month: 'short' }).toUpperCase();
        botonMes.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll(".btn-mes").forEach(btn => btn.classList.remove("active"));
            botonMes.classList.add("active");
            renderizarMes(fechaMes.getFullYear(), fechaMes.getMonth());
        };
        navMeses.appendChild(botonMes);
    }

    function renderizarMes(año, mes) {
        gridCalendario.innerHTML = "";
        ["L", "M", "M", "J", "V", "S"].forEach(d => {
            gridCalendario.innerHTML += `<div class="day-name">${d}</div>`;
        });

        const primerDiaFecha = new Date(año, mes, 1);
        let primerDiaSemana = primerDiaFecha.getDay(); 

        // AJUSTE CLAVE: Lunes es columna 0. 
        // getDay() es: Dom=0, Lun=1, Mar=2, Mie=3, Jue=4, Vie=5, Sab=6
        // Si el mes empieza en Domingo (0), el primer día visible (Lunes 2) no necesita huecos.
        let huecos = (primerDiaSemana === 0) ? 0 : primerDiaSemana - 1;

        for (let h = 0; h < huecos; h++) {
            gridCalendario.innerHTML += `<div class="day-empty"></div>`;
        }

        const ultimoDiaMes = new Date(año, mes + 1, 0).getDate();
        for (let dia = 1; dia <= ultimoDiaMes; dia++) {
            const fechaLoop = new Date(año, mes, dia);
            if (fechaLoop.getDay() === 0) continue; // Saltar Domingos

            const hoySinHora = new Date(); hoySinHora.setHours(0,0,0,0);
            const esPasado = fechaLoop < hoySinHora;
            const iso = `${año}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

            const card = document.createElement("div");
            card.className = `day-item-new ${esPasado ? 'pasado' : ''}` + (fechaInput.value === iso ? " selected" : "");
            card.innerHTML = `<span>${dia}</span>`;
            if (!esPasado) {
                card.onclick = () => {
                    document.querySelectorAll(".day-item-new").forEach(el => el.classList.remove("selected"));
                    card.classList.add("selected");
                    fechaInput.value = iso;
                    cargarHorasDisponibles();
                };
            }
            gridCalendario.appendChild(card);
        }
    }

    contenedor.innerHTML = "";
    contenedor.appendChild(navMeses);
    contenedor.appendChild(gridCalendario);
    renderizarMes(hoy.getFullYear(), hoy.getMonth());
}

document.addEventListener("DOMContentLoaded", () => { generarCalendario(); cargarServicios(); });

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

// --- FUNCIÓN PARA GENERAR LINK DE GOOGLE CALENDAR (CORREGIDA) ---
const generarGoogleCalendarLink = (nombre, servicio, fecha, hora) => {
    try {
        const baseUrl = "https://calendar.google.com/calendar/render?action=TEMPLATE";
        const titulo = encodeURIComponent(`Cita Beauty: ${servicio}`);
        
        // Formato fecha: de "2024-05-10" a "20240510"
        const f = fecha.replace(/-/g, '');
        
        // Formato hora inicio: de "08:30" a "083000"
        const hInicio = hora.replace(/:/g, '') + "00";
        
        // Calcular hora fin (sumamos 1 hora por defecto para el calendario)
        let [hh, mm] = hora.split(':').map(Number);
        let hFin = `${(hh + 1).toString().padStart(2, '0')}${mm.toString().padStart(2, '0')}00`;

        const detalles = encodeURIComponent(`Hola ${nombre}, te esperamos en Andre Arias Beauty Stylist para tu servicio de ${servicio}.`);
        const ubicacion = encodeURIComponent("Andre Arias Beauty Stylist, Costa Rica");

        // Retorna el link completo con fechas de inicio y fin requeridas por Google
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
        horasVisualGrid.innerHTML = `
            <div class="aviso-whatsapp-inline">
                <p>Este servicio requiere valoración técnica previa. Haz clic en el botón inferior para coordinar por WhatsApp.</p>
            </div>`;
        return;
    }

    const fechaSeleccionada = fechaInput.value;
    if (!fechaSeleccionada) {
        horasVisualGrid.innerHTML = "<p style='font-size:12px; color:#aaa; text-align:center;'>Selecciona una fecha en el calendario.</p>";
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

        for (let i = 0; i < carrito.length; i++) {
            const s = carrito[i];
            const inicioNuevo = tiempoCorriente;
            const duracionNuevo = Number(s.duracion) || 60;
            const finNuevo = inicioNuevo + duracionNuevo;

            if (finNuevo > hAMin(HORA_CIERRE)) {
                esPosibleTodoElCombo = false;
                break;
            }

            const ocupantes = citasExistentes.filter(c => (inicioNuevo < c.fin && finNuevo > c.inicio));

            if (ocupantes.length > 0) {
                const primerServicioPermite = carrito[0].simultaneo === true;
                const existentesPermiten = ocupantes.every(c => c.simultaneo === true);
                const hayCupo = ocupantes.length < 2;

                if (!primerServicioPermite || !existentesPermiten || !hayCupo) {
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

// --- CARGA DE SERVICIOS Y PRECIOS ---
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
            
            let esRango = s.precio.tipo === "rango";
            let txtPrecio = !esRango 
                ? `₡${Number(s.precio.valor).toLocaleString()}`
                : `₡${Number(s.precio.desde).toLocaleString()} - ₡${Number(s.precio.hasta).toLocaleString()}*`;

            card.innerHTML = `
                <h4>${s.nombre}</h4>
                <span class="price-tag">${txtPrecio}</span>
                <p class="duration-tag">${s.duracion || 60} min</p>
                ${esRango ? '<small class="tag-valoracion">Sujeto a valoración el día de la cita</small>' : ''}
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
                        precio_info: txtPrecio,
                        esRango: esRango
                    });
                    card.classList.add("selected");
                }
                horaSeleccionada = ""; 
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

    if (carrito.length === 0) {
        carritoDiv.innerHTML = "";
        btnConfirmar.textContent = "CONFIRMAR RESERVA";
        btnConfirmar.classList.remove("btn-whatsapp");
        btnConfirmar.dataset.modo = "reserva";
        return;
    }

    const requiereWhatsApp = verificarSiRequiereValoracion();
    const tieneAlgunRango = carrito.some(s => s.esRango);
    let totalMin = carrito.reduce((sum, s) => sum + s.duracion, 0);
    
    carritoDiv.innerHTML = `
        <div class="resumen-badge">
            <p><b>RESUMEN:</b></p>
            ${carrito.map(s => `
                <div class='resumen-item'>
                    <span>${s.nombre} ${s.esRango ? '<b style="color:#d4af37;">*</b>' : ''}</span>
                    <span>${s.precio_info}</span>
                </div>`).join('')}
            <div class='resumen-total'><span>Tiempo Est.</span><span>${totalMin} min</span></div>
            ${tieneAlgunRango ? '<p class="aviso-rango-footer">* El precio final se definirá mediante valoración presencial el día de la cita.</p>' : ''}
        </div>`;

    if (requiereWhatsApp) {
        btnConfirmar.textContent = "SOLICITAR VALORACIÓN WHATSAPP";
        btnConfirmar.classList.add("btn-whatsapp");
        btnConfirmar.dataset.modo = "whatsapp";
    } else {
        btnConfirmar.textContent = "CONFIRMAR RESERVA";
        btnConfirmar.classList.remove("btn-whatsapp");
        btnConfirmar.dataset.modo = "reserva";
    }
}

// --- ENVÍO DE DATOS ---
const form = document.getElementById("formReserva");
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btnSubmit = form.querySelector("button[type='submit']");
        const modo = btnSubmit.dataset.modo;
        const textoOriginal = btnSubmit.textContent;

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span class="spinner"></span> Procesando...`;

        const nombre = document.getElementById("nombre").value;
        const apellido = document.getElementById("apellido1")?.value || "";
        const telefono = document.getElementById("telefono").value;
        const correo = document.getElementById("correo").value;
        const fecha = document.getElementById("fecha").value;
        const serviciosTxt = carrito.map(s => s.nombre).join(", ");

        if (modo === "whatsapp") {
            const msj = `¡Hola Andre! ✨ Me interesa una valoración para: ${serviciosTxt}. Cliente: ${nombre}, Cel: ${telefono}.`;
            window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${msj}`, '_blank');
            btnSubmit.disabled = false;
            btnSubmit.textContent = textoOriginal;
        } else {
            if (!horaSeleccionada) {
                alert("Por favor selecciona una hora.");
                btnSubmit.disabled = false;
                btnSubmit.textContent = textoOriginal;
                return;
            }
            try {
                // Guardar/Actualizar Cliente en Firestore
                const idClie = (correo || telefono).replace(/[.#$[\]]/g,'_');
                await setDoc(doc(db, "clientes", idClie), { 
                    nombre, 
                    apellido1: apellido, 
                    correo, 
                    telefono 
                }, { merge: true });

                // Guardar Citas en Firestore
                let t = hAMin(horaSeleccionada);
                for (const s of carrito) {
                    await addDoc(collection(db, "citas"), { 
                        clienteId: idClie, 
                        servicioId: s.id, 
                        fecha: fecha, 
                        hora: minAH(t), 
                        duracion: s.duracion, 
                        simultaneo: s.simultaneo, 
                        creado: Timestamp.now() 
                    });
                    t += s.duracion;
                }

                // --- PROCESO DE EMAIL ---
                // Generamos el link real para el botón de calendario
                const linkCal = generarGoogleCalendarLink(nombre, serviciosTxt, fecha, horaSeleccionada);

                const templateParams = {
                    nombre_cliente: `${nombre} ${apellido}`,
                    email_cliente: correo,
                    servicio: serviciosTxt,
                    fecha: fecha,
                    hora: horaSeleccionada,
                    link_calendario: linkCal 
                };

                // Enviamos el correo con EmailJS
                await emailjs.send(
                    "service_14jwpyq", 
                    "template_itx9f7f", 
                    templateParams
                );

                alert("¡Cita reservada con éxito!");
                window.location.reload();
            } catch (err) {
                console.error("Error completo:", err);
                alert("Ocurrió un error al procesar la reserva. Revisa la consola.");
                btnSubmit.disabled = false;
                btnSubmit.textContent = textoOriginal;
            }
        }
    });
}

function generarCalendario() {
    const contenedor = document.getElementById("calendarioSemanas");
    const fechaInput = document.getElementById("fecha");
    if (!contenedor) return;

    contenedor.innerHTML = ""; // Limpiar
    const hoy = new Date();
    
    // Generar 3 meses
    for (let m = 0; m < 3; m++) {
        const mesActual = new Date(hoy.getFullYear(), hoy.getMonth() + m, 1);
        const nombreMes = mesActual.toLocaleString('es', { month: 'long' });
        const año = mesActual.getFullYear();

        // Contenedor del mes
        const mesWrapper = document.createElement("div");
        mesWrapper.className = "mes-container";
        mesWrapper.innerHTML = `<h3 class="mes-titulo">${nombreMes.toUpperCase()} ${año}</h3>`;

        const grid = document.createElement("div");
        grid.className = "calendar-grid-premium";

        // Cabecera de días
        ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].forEach(d => {
            grid.innerHTML += `<div class="day-name">${d}</div>`;
        });

        // Obtener primer día del mes (0=Dom, 1=Lun...)
        let primerDia = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1).getDay();
        // Ajustar porque omitimos Domingo (si es domingo, no ponemos huecos)
        let huecosCeros = primerDia === 0 ? 0 : primerDia - 1;

        // Espacios vacíos al inicio
        for (let h = 0; h < huecosCeros; h++) {
            grid.innerHTML += `<div class="day-empty"></div>`;
        }

        // Días del mes
        const ultimoDia = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0).getDate();
        for (let dia = 1; dia <= ultimoDia; dia++) {
            const fechaLoop = new Date(mesActual.getFullYear(), mesActual.getMonth(), dia);
            
            // Omitir domingos
            if (fechaLoop.getDay() === 0) continue;

            // Validar que no sea pasado
            const esPasado = fechaLoop < new Date().setHours(0,0,0,0);

            const card = document.createElement("div");
            card.className = `day-item-new ${esPasado ? 'pasado' : ''}`;
            const iso = `${fechaLoop.getFullYear()}-${String(fechaLoop.getMonth()+1).padStart(2,'0')}-${String(fechaLoop.getDate()).padStart(2,'0')}`;
            
            card.innerHTML = `<span class="num">${dia}</span>`;
            
            if (!esPasado) {
                card.onclick = () => {
                    document.querySelectorAll(".day-item-new").forEach(el => el.classList.remove("selected"));
                    card.classList.add("selected");
                    fechaInput.value = iso;
                    cargarHorasDisponibles();
                    // Scroll suave a las horas
                    document.getElementById("horasVisualGrid").scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                };
            }
            grid.appendChild(card);
        }
        mesWrapper.appendChild(grid);
        contenedor.appendChild(mesWrapper);
    }
}

document.addEventListener("DOMContentLoaded", () => { generarCalendario(); cargarServicios(); });

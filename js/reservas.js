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

emailjs.init("s8xK3KN3XQ4g9Qccg");

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

// --- LÓGICA DE VALORACIÓN (ESTRICTA) ---
function verificarSiRequiereValoracion() {
    if (carrito.length === 0) return false;
    
    // Solo WhatsApp si el servicio es específicamente el alaciado o si UN servicio individual es gigante
    return carrito.some(s => 
        s.nombre === "Alaciados/Control de volumen " || 
        s.precio_tipo === "rango" ||
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
                <p>Este tratamiento requiere valoración técnica. Coordinaremos la hora por WhatsApp.</p>
            </div>`;
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
            
            // FORMATEO DE PRECIO (RESTAURADO)
            let txtPrecio = "";
            if (s.precio.tipo === "fijo") {
                txtPrecio = `₡${Number(s.precio.valor).toLocaleString()}`;
            } else {
                txtPrecio = `₡${Number(s.precio.desde).toLocaleString()} - ₡${Number(s.precio.hasta).toLocaleString()}*`;
            }

            card.innerHTML = `
                <h4>${s.nombre}</h4>
                <span class="price-tag">${txtPrecio}</span>
                <p class="duration-tag">${s.duracion || 60} min</p>
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
                        precio_tipo: s.precio.tipo,
                        precio_info: txtPrecio
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

    const requiereValoracion = verificarSiRequiereValoracion();
    let totalMin = carrito.reduce((sum, s) => sum + s.duracion, 0);
    
    carritoDiv.innerHTML = `
        <div class="resumen-badge">
            <p><b>RESUMEN:</b></p>
            ${carrito.map(s => `<div class='resumen-item'><span>${s.nombre}</span><span>${s.precio_info}</span></div>`).join('')}
            <div class='resumen-total'><span>Total</span><span>${totalMin} min</span></div>
        </div>`;

    if (requiereValoracion) {
        btnConfirmar.textContent = "SOLICITAR POR WHATSAPP";
        btnConfirmar.classList.add("btn-whatsapp");
        btnConfirmar.dataset.modo = "whatsapp";
    } else {
        btnConfirmar.textContent = "CONFIRMAR RESERVA";
        btnConfirmar.classList.remove("btn-whatsapp");
        btnConfirmar.dataset.modo = "reserva";
    }
}

// --- ENVÍO Y CALENDARIO ---
const form = document.getElementById("formReserva");
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btnSubmit = form.querySelector("button[type='submit']");
        const modo = btnSubmit.dataset.modo;

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span class="spinner"></span>...`;

        const nombre = document.getElementById("nombre").value;
        const telefono = document.getElementById("telefono").value;
        const serviciosTxt = carrito.map(s => s.nombre).join(", ");

        if (modo === "whatsapp") {
            const msj = `¡Hola Andre! Me interesa el servicio de: ${serviciosTxt}. Mi nombre es ${nombre}.`;
            window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${msj}`, '_blank');
            btnSubmit.disabled = false;
            btnSubmit.textContent = "SOLICITAR POR WHATSAPP";
        } else {
            if (!horaSeleccionada) {
                alert("Selecciona una hora.");
                btnSubmit.disabled = false;
                btnSubmit.textContent = "CONFIRMAR RESERVA";
                return;
            }
            try {
                const idClie = telefono.replace(/\s/g,'');
                await setDoc(doc(db, "clientes", idClie), { nombre, telefono }, { merge: true });
                let t = hAMin(horaSeleccionada);
                for (const s of carrito) {
                    await addDoc(collection(db, "citas"), { 
                        clienteId: idClie, servicioId: s.id, fecha: document.getElementById("fecha").value, 
                        hora: minAH(t), duracion: s.duracion, simultaneo: s.simultaneo, creado: Timestamp.now() 
                    });
                    t += s.duracion;
                }
                alert("¡Reservado!");
                window.location.reload();
            } catch (err) {
                alert("Error.");
                btnSubmit.disabled = false;
                btnSubmit.textContent = "CONFIRMAR RESERVA";
            }
        }
    });
}

function generarCalendario() {
    const contenedor = document.getElementById("calendarioSemanas");
    const fechaInput = document.getElementById("fecha");
    if (!contenedor) return;
    const hoy = new Date();
    for (let i = 0; i < 14; i++) {
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

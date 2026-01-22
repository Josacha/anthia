import { db } from "./firebase.js";
import { collection, addDoc, setDoc, doc, getDocs, query, where, Timestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- SELECTORES ---
const formReserva = document.getElementById("formReserva");
const correoInput = document.getElementById("correo");
const telefonoInput = document.getElementById("telefono");
const nombreInput = document.getElementById("nombre");
const apellido1Input = document.getElementById("apellido1");
const apellido2Input = document.getElementById("apellido2");
const fechaInput = document.getElementById("fecha");
const carritoDiv = document.getElementById("carritoServicios");

// Selectores de los contenedores visuales nuevos
const serviciosGrid = document.getElementById("serviciosGrid");
const calendarioContenedor = document.getElementById("calendarioSemanas");
const horasVisualGrid = document.getElementById("horasVisualGrid");

const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
let carrito = [];
let horaSeleccionada = ""; // Reemplaza la dependencia del select oculto

// --- UTILIDADES ---
function horaAMinutos(hora) {
    if (!hora) return 0;
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
}

function minutosAHora(totalMinutos) {
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
}

// --- 1. GENERAR CALENDARIO PREMIUM ---
function generarCalendario() {
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
        diaCard.className = "day-item"; // Usando la clase del nuevo CSS
        const isoFecha = d.toISOString().split('T')[0];

        diaCard.innerHTML = `
            <span class="mes">${d.toLocaleString('es', { weekday: 'short' })}</span>
            <span class="num">${d.getDate()}</span>
            <span class="mes">${d.toLocaleString('es', { month: 'short' })}</span>
        `;

        diaCard.onclick = () => {
            document.querySelectorAll(".day-item").forEach(el => el.classList.remove("selected"));
            diaCard.classList.add("selected");
            fechaInput.value = isoFecha;
            cargarHorasDisponibles();
        };
        calendarioContenedor.appendChild(diaCard);
        diasContados++;
    }
}

// --- 2. CARGAR SERVICIOS PREMIUM ---
async function cargarServicios() {
    serviciosGrid.innerHTML = "";
    const serviciosRef = collection(db, "servicios");
    const snapshot = await getDocs(serviciosRef);

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const card = document.createElement("div");
        card.className = "service-card";
        
        // Verificamos si ya está en el carrito para mantener la clase 'selected'
        if(carrito.some(item => item.id === docSnap.id)) card.classList.add("selected");

        card.innerHTML = `
            <h4>${data.nombre}</h4>
            <span>₡${data.precio}</span>
            <p style="font-size: 0.7rem; color: #888; margin-top:8px; text-transform:uppercase; letter-spacing:1px;">${data.duracion || 60} min</p>
        `;

        card.onclick = () => {
            toggleServicio(docSnap.id, data.nombre, data.duracion, data.simultaneo, card);
        };
        serviciosGrid.appendChild(card);
    });
}

function toggleServicio(id, nombre, duracion, simultaneo, cardElement) {
    const index = carrito.findIndex(s => s.id === id);
    if (index > -1) {
        carrito.splice(index, 1);
        cardElement.classList.remove("selected");
    } else {
        carrito.push({ id, nombre, duracion: parseInt(duracion) || 60, simultaneo: simultaneo === true });
        cardElement.classList.add("selected");
    }
    renderCarrito();
    cargarHorasDisponibles();
}

// --- 3. CARGAR HORAS PREMIUM ---
async function cargarHorasDisponibles() {
    horasVisualGrid.innerHTML = "";
    const fecha = fechaInput.value;
    if (!fecha || carrito.length === 0) {
        horasVisualGrid.innerHTML = "<p style='font-size:12px; color:#aaa;'>Selecciona fecha y servicios para ver horarios.</p>";
        return;
    }

    const citasRef = collection(db, "citas");
    const snapshotCitas = await getDocs(citasRef);
    const citasExistentes = snapshotCitas.docs.map(d => ({ ...d.data() }));

    for (const horaApertura of HORAS) {
        let tiempoAnalizado = horaAMinutos(horaApertura);
        let esPosible = true;

        for (const servicio of carrito) {
            const inicioServ = tiempoAnalizado;
            const finServ = inicioServ + servicio.duracion;

            const citasEnTramo = citasExistentes.filter(c => {
                const cInicio = horaAMinutos(c.hora);
                const cFin = cInicio + (c.duracion || 60);
                return c.fecha === fecha && !(finServ <= cInicio || inicioServ >= cFin);
            });

            if (citasEnTramo.length > 0) {
                if (citasEnTramo.some(c => !c.simultaneo) || !servicio.simultaneo || citasEnTramo.length >= 2) {
                    esPosible = false;
                    break;
                }
            }
            tiempoAnalizado = finServ;
        }

        if (esPosible) {
            const btn = document.createElement("div");
            btn.className = "hour-item";
            btn.textContent = horaApertura;
            if (horaSeleccionada === horaApertura) btn.classList.add("selected");

            btn.onclick = () => {
                document.querySelectorAll(".hour-item").forEach(el => el.classList.remove("selected"));
                btn.classList.add("selected");
                horaSeleccionada = horaApertura;
            };
            horasVisualGrid.appendChild(btn);
        }
    }
}

// --- 4. RENDERIZAR RESUMEN (CARRITO) ---
function renderCarrito() {
    carritoDiv.innerHTML = "";
    if (carrito.length === 0) return;

    const badge = document.createElement("div");
    badge.className = "resumen-badge";
    badge.style = "background: #fdfcfb; border: 1px solid #e8e4e1; padding: 20px; border-radius: 15px; margin-top:15px;";
    
    let totalMin = 0;
    let html = `<p style="font-size:11px; letter-spacing:1px; text-transform:uppercase; margin-bottom:10px; color:var(--gold);">Resumen de Selección:</p>`;
    
    carrito.forEach((s) => {
        totalMin += s.duracion;
        html += `<div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:5px;">
                    <span>${s.nombre}</span>
                    <span style="color:#888;">${s.duracion} min</span>
                 </div>`;
    });

    html += `<div style="border-top:1px solid #eee; margin-top:10px; padding-top:10px; display:flex; justify-content:space-between; font-weight:600;">
                <span>Duración Total</span>
                <span>${totalMin} min</span>
             </div>`;
             
    badge.innerHTML = html;
    carritoDiv.appendChild(badge);
}

// --- INICIALIZACIÓN ---
generarCalendario();
cargarServicios();

// Autocompletar (mantiene tu lógica original)
const autocompletar = async (e) => {
    const valor = e.target.value;
    if (!valor) return;
    const q = query(collection(db, "clientes"), where("correo", "==", valor));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const c = snap.docs[0].data();
        nombreInput.value = c.nombre || "";
        apellido1Input.value = c.apellido1 || "";
        apellido2Input.value = c.apellido2 || "";
        correoInput.value = c.correo || "";
        telefonoInput.value = c.telefono || "";
    }
};

correoInput.addEventListener("blur", autocompletar);
telefonoInput.addEventListener("blur", autocompletar);

// --- ENVÍO DE FORMULARIO ---
formReserva.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!fechaInput.value || !horaSeleccionada || carrito.length === 0) {
        return alert("Por favor completa: Fecha, Hora y al menos 1 Servicio.");
    }

    try {
        const idCliente = (correoInput.value || telefonoInput.value).replace(/[.#$[\]]/g,'_');
        await setDoc(doc(db, "clientes", idCliente), {
            nombre: nombreInput.value,
            apellido1: apellido1Input.value,
            apellido2: apellido2Input.value,
            correo: correoInput.value,
            telefono: telefonoInput.value,
            actualizado: Timestamp.now()
        }, { merge: true });

        let tiempoBase = horaAMinutos(horaSeleccionada);
        for (const s of carrito) {
            await addDoc(collection(db, "citas"), {
                clienteId: idCliente,
                servicioId: s.id,
                fecha: fechaInput.value,
                hora: minutosAHora(tiempoBase),
                duracion: s.duracion,
                simultaneo: s.simultaneo,
                creado: Timestamp.now()
            });
            tiempoBase += s.duracion;
        }

        alert("Reserva confirmada. ¡Te esperamos en Anthia!");
        window.location.reload();
    } catch (err) {
        console.error(err);
        alert("Hubo un error al procesar tu cita.");
    }
});

onSnapshot(collection(db, "citas"), () => cargarHorasDisponibles());

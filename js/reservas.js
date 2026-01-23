import { db } from "./firebase.js";
import { 
    collection, addDoc, setDoc, doc, getDocs, query, where, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- SELECTORES ---
const formReserva = document.getElementById("formReserva");
const correoInput = document.getElementById("correo");
const telefonoInput = document.getElementById("telefono");
const nombreInput = document.getElementById("nombre");
const apellido1Input = document.getElementById("apellido1");
const apellido2Input = document.getElementById("apellido2");
const fechaInput = document.getElementById("fecha");
const carritoDiv = document.getElementById("carritoServicios");
const serviciosGrid = document.getElementById("serviciosGrid");
const calendarioContenedor = document.getElementById("calendarioSemanas");
const horasVisualGrid = document.getElementById("horasVisualGrid");

// --- CONFIGURACIÓN Y ESTADO ---
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
let carrito = [];
let horaSeleccionada = "";

// --- UTILIDADES DE TIEMPO ---
function horaAMinutos(hora) {
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
}

function minutosAHora(totalMinutos) {
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
}

// --- LÓGICA DE CALENDARIO ---
function generarCalendario() {
    calendarioContenedor.innerHTML = "";
    const hoy = new Date();
    let diasContados = 0;
    let offset = 0;

    while (diasContados < 7) {
        let d = new Date();
        d.setDate(hoy.getDate() + offset);
        offset++;
        if (d.getDay() === 0) continue; // Domingo libre

        const diaCard = document.createElement("div");
        diaCard.className = "day-item";
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

// --- LÓGICA DE SERVICIOS ---
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
            if (index > -1) { 
                carrito.splice(index, 1); 
                card.classList.remove("selected"); 
            } else { 
                carrito.push({ 
                    id: docSnap.id, 
                    nombre: data.nombre, 
                    duracion: parseInt(data.duracion) || 60, 
                    simultaneo: !!data.simultaneo 
                }); 
                card.classList.add("selected"); 
            }
            renderCarrito();
            cargarHorasDisponibles();
        };
        serviciosGrid.appendChild(card);
    });
}

// --- CARGAR HORAS CON REGLAS ESTRICTAS ---
async function cargarHorasDisponibles() {
    horasVisualGrid.innerHTML = "";
    const fecha = fechaInput.value;
    if (!fecha || carrito.length === 0) {
        horasVisualGrid.innerHTML = "<p style='font-size:12px; color:#aaa;'>Selecciona servicios y fecha.</p>";
        return;
    }

    const q = query(collection(db, "citas"), where("fecha", "==", fecha));
    const snapshotCitas = await getDocs(q);
    const citas = snapshotCitas.docs.map(d => d.data());

    for (const hApertura of HORAS) {
        let tiempoCorriente = horaAMinutos(hApertura);
        let posible = true;

        // Validar ENCADENAMIENTO del carrito
        for (const s of carrito) {
            const inicioR = tiempoCorriente;
            const finR = inicioR + s.duracion;

            // Buscar si hay citas que se solapen con este bloque de tiempo
            const ocupadas = citas.filter(c => {
                const cIni = horaAMinutos(c.hora);
                const cFin = cIni + (c.duracion || 60);
                return (inicioR < cFin && finR > cIni);
            });

            if (ocupadas.length > 0) {
                // REGLA DE ORO: El que ya estaba debe ser simultáneo obligatoriamente
                const elExistentePermite = ocupadas.every(c => c.simultaneo === true);
                const cabinaLlena = ocupadas.length >= 2;

                // Si el que ya estaba no permite, o ya hay 2 personas, se bloquea
                if (!elExistentePermite || cabinaLlena) {
                    posible = false;
                    break;
                }
            }
            // Siguiente servicio del carrito empieza donde termina el actual
            tiempoCorriente = finR;
        }

        if (posible) {
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

function renderCarrito() {
    carritoDiv.innerHTML = "";
    if (carrito.length === 0) return;
    let total = carrito.reduce((sum, s) => sum + s.duracion, 0);
    carritoDiv.innerHTML = `
        <div class="resumen-badge">
            <p>RESUMEN DE SELECCIÓN:</p>
            ${carrito.map(s => `<div class='resumen-item'><span>${s.nombre}</span><span>${s.duracion} min</span></div>`).join('')}
            <div class='resumen-total'><span>Total</span><span>${total} min</span></div>
        </div>`;
}

// --- PROCESAR RESERVA ---
formReserva.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!fechaInput.value || !horaSeleccionada || carrito.length === 0) return alert("Completa los datos");

    try {
        const idClie = (correoInput.value || telefonoInput.value).replace(/[.#$[\]]/g,'_');
        
        // Guardar/Actualizar cliente
        await setDoc(doc(db, "clientes", idClie), { 
            nombre: nombreInput.value, 
            apellido1: apellido1Input.value, 
            correo: correoInput.value, 
            telefono: telefonoInput.value 
        }, { merge: true });

        let t = horaAMinutos(horaSeleccionada);
        
        // Guardar cada cita del encadenamiento
        for (const s of carrito) {
            await addDoc(collection(db, "citas"), { 
                clienteId: idClie, 
                servicioId: s.id, 
                fecha: fechaInput.value, 
                hora: minutosAHora(t), 
                duracion: s.duracion, 
                simultaneo: s.simultaneo, 
                avisoMostrado: false, // Importante para el monitor de premios
                creado: Timestamp.now() 
            });
            t += s.duracion;
        }
        
        alert("¡Reserva exitosa!"); 
        window.location.reload();
    } catch (err) { 
        alert("Error al procesar la reserva"); 
    }
});

// Inicialización
generarCalendario();
cargarServicios();

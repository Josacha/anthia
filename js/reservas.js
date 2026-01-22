import { db } from "./firebase.js";
import { collection, addDoc, setDoc, doc, getDocs, query, where, Timestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
let carrito = [];
let horaSeleccionada = "";

function horaAMinutos(hora) {
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
}

function minutosAHora(totalMinutos) {
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
}

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
            cargarHorasDisponibles(); // Carga inmediata al hacer clic
        };
        calendarioContenedor.appendChild(diaCard);
        diasContados++;
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
            else { carrito.push({ id: docSnap.id, nombre: data.nombre, duracion: parseInt(data.duracion)||60, simultaneo: !!data.simultaneo }); card.classList.add("selected"); }
            renderCarrito();
            cargarHorasDisponibles();
        };
        serviciosGrid.appendChild(card);
    });
}

async function cargarHorasDisponibles() {
    horasVisualGrid.innerHTML = "";
    const fecha = fechaInput.value;
    if (!fecha || carrito.length === 0) {
        horasVisualGrid.innerHTML = "<p style='font-size:12px; color:#aaa;'>Selecciona servicios y fecha.</p>";
        return;
    }

    const snapshotCitas = await getDocs(collection(db, "citas"));
    const citas = snapshotCitas.docs.map(d => d.data());

    for (const hApertura of HORAS) {
        let tiempo = horaAMinutos(hApertura);
        let posible = true;

        for (const s of carrito) {
            const inicio = tiempo;
            const fin = inicio + s.duracion;
            const ocupadas = citas.filter(c => c.fecha === fecha && !(fin <= horaAMinutos(c.hora) || inicio >= (horaAMinutos(c.hora) + (c.duracion||60))));

            if (ocupadas.length > 0) {
                if (ocupadas.some(c => !c.simultaneo) || !s.simultaneo || ocupadas.length >= 2) { posible = false; break; }
            }
            tiempo = fin;
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

generarCalendario();
cargarServicios();

formReserva.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!fechaInput.value || !horaSeleccionada || carrito.length === 0) return alert("Completa los datos");
    try {
        const idClie = (correoInput.value || telefonoInput.value).replace(/[.#$[\]]/g,'_');
        await setDoc(doc(db, "clientes", idClie), { nombre: nombreInput.value, apellido1: apellido1Input.value, correo: correoInput.value, telefono: telefonoInput.value }, { merge: true });
        let t = horaAMinutos(horaSeleccionada);
        for (const s of carrito) {
            await addDoc(collection(db, "citas"), { clienteId: idClie, servicioId: s.id, fecha: fechaInput.value, hora: minutosAHora(t), duracion: s.duracion, simultaneo: s.simultaneo, creado: Timestamp.now() });
            t += s.duracion;
        }
        alert("¡Reserva exitosa!"); window.location.reload();
    } catch (err) { alert("Error"); }
});

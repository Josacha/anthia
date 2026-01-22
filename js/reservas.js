import { db } from "./firebase.js";
import { collection, addDoc, setDoc, doc, getDocs, query, where, Timestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM ORIGINAL
const formReserva = document.getElementById("formReserva");
const correoInput = document.getElementById("correo");
const telefonoInput = document.getElementById("telefono");
const nombreInput = document.getElementById("nombre");
const apellido1Input = document.getElementById("apellido1");
const apellido2Input = document.getElementById("apellido2");
const servicioSelect = document.getElementById("servicio");
const fechaInput = document.getElementById("fecha");
const horaSelect = document.getElementById("hora");
const carritoDiv = document.getElementById("carritoServicios");

// DOM PREMIUM (Contenedores visuales)
const serviciosGrid = document.getElementById("serviciosGrid");
const calendarioContenedor = document.getElementById("calendarioSemanas");
const horasVisualGrid = document.getElementById("horasVisualGrid");

const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
let carrito = [];
let duracionTotal = 0;

function horaAMinutos(hora){
    const [h,m] = hora.split(":").map(Number);
    return h*60 + m;
}

// 1. GENERAR CALENDARIO SEMANAL (Sin domingos)
function generarCalendario() {
    calendarioContenedor.innerHTML = "";
    const hoy = new Date();
    let diasContados = 0;
    let offset = 0;

    while (diasContados < 7) {
        let d = new Date();
        d.setDate(hoy.getDate() + offset);
        offset++;

        if (d.getDay() === 0) continue; // Ignorar domingos

        const diaCard = document.createElement("div");
        diaCard.className = "dia-item";
        const isoFecha = d.toISOString().split('T')[0];

        diaCard.innerHTML = `
            <span class="mes">${d.toLocaleString('es', { weekday: 'short' })}</span>
            <span class="num">${d.getDate()}</span>
            <span class="mes">${d.toLocaleString('es', { month: 'short' })}</span>
        `;

        diaCard.onclick = () => {
            document.querySelectorAll(".dia-item").forEach(el => el.classList.remove("selected"));
            diaCard.classList.add("selected");
            fechaInput.value = isoFecha;
            fechaInput.dispatchEvent(new Event('change'));
        };
        calendarioContenedor.appendChild(diaCard);
        diasContados++;
    }
}

// 2. CARGAR SERVICIOS EN FORMATO CARDS
async function cargarServicios() {
    servicioSelect.innerHTML = '<option value="">Seleccione un servicio</option>';
    serviciosGrid.innerHTML = "";
    const serviciosRef = collection(db, "servicios");
    const snapshot = await getDocs(serviciosRef);

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        
        // Mantener el select oculto actualizado
        const option = document.createElement("option");
        option.value = docSnap.id;
        option.dataset.duracion = data.duracion || 60;
        option.dataset.simultaneo = data.simultaneo || false;
        option.textContent = data.nombre;
        servicioSelect.appendChild(option);

        // Crear la Card Premium
        const card = document.createElement("div");
        card.className = "service-card";
        card.innerHTML = `
            <h4>${data.nombre}</h4>
            <span>₡${data.precio}</span>
            <p style="font-size: 0.75rem; color: #888; margin-top:5px;">${data.duracion || 60} min</p>
        `;
        card.onclick = () => {
            servicioSelect.value = docSnap.id;
            servicioSelect.dispatchEvent(new Event('change'));
            card.classList.toggle("selected");
        };
        serviciosGrid.appendChild(card);
    });
}

// 3. CARGAR HORAS EN FORMATO BOTONES
async function cargarHorasDisponibles() {
    horaSelect.innerHTML = '<option value="">Seleccione hora</option>';
    horasVisualGrid.innerHTML = "";
    const fecha = fechaInput.value;
    if (!fecha || carrito.length === 0) return;

    const citasRef = collection(db, "citas");
    const snapshotCitas = await getDocs(citasRef);
    const citas = snapshotCitas.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const hora of HORAS) {
        const inicio = horaAMinutos(hora);
        const fin = inicio + duracionTotal;
        const citasSolapadas = citas.filter(c => c.fecha === fecha && !(fin <= horaAMinutos(c.hora) || inicio >= horaAMinutos(c.hora) + c.duracion));

        let disponible = true;
        if (citasSolapadas.length > 0) {
            const primera = citasSolapadas[0];
            if (!primera.simultaneo && carrito.some(s => s.simultaneo)) disponible = false;
            if (citasSolapadas.length >= 2) disponible = false;
        }

        if (disponible) {
            const option = document.createElement("option");
            option.value = hora;
            option.textContent = hora;
            horaSelect.appendChild(option);

            const btn = document.createElement("div");
            btn.className = "hora-item";
            btn.textContent = hora;
            btn.onclick = () => {
                document.querySelectorAll(".hora-item").forEach(el => el.classList.remove("selected"));
                btn.classList.add("selected");
                horaSelect.value = hora;
            };
            horasVisualGrid.appendChild(btn);
        }
    }
}

// LOGICA DE CARRITO (Mantenida de tu código)
servicioSelect.addEventListener("change", () => {
    const selected = servicioSelect.selectedOptions[0];
    if (!selected || selected.value === "") return;
    if (carrito.some(s => s.id === selected.value)) return;

    const duracion = parseInt(selected.dataset.duracion);
    const simultaneo = selected.dataset.simultaneo === "true";

    carrito.push({ id: selected.value, nombre: selected.textContent, duracion, simultaneo });
    duracionTotal += duracion;

    renderCarrito();
    cargarHorasDisponibles();
});

function renderCarrito() {
    carritoDiv.innerHTML = `<p style="font-weight:600; margin-bottom:10px;">Resumen:</p>`;
    carrito.forEach((s, i) => {
        const div = document.createElement("div");
        div.style = "display:flex; justify-content:space-between; background:#fff; border:1px solid #eee; padding:10px; border-radius:12px; margin-bottom:8px;";
        div.innerHTML = `<span>${s.nombre}</span> <button type="button" style="color:red; border:none; background:none; cursor:pointer;" data-index="${i}">✕</button>`;
        carritoDiv.appendChild(div);

        div.querySelector("button").addEventListener("click", () => {
            duracionTotal -= s.duracion;
            carrito.splice(i, 1);
            renderCarrito();
            cargarHorasDisponibles();
        });
    });
}

// AUTOCOMPLETAR (Mantenida de tu código)
async function autocompletarCliente(valor) {
    if (!valor) return;
    const clientesRef = collection(db, "clientes");
    let q = query(clientesRef, where("correo", "==", valor));
    let snapshot = await getDocs(q);

    if (snapshot.empty) {
        q = query(clientesRef, where("telefono", "==", valor));
        snapshot = await getDocs(q);
    }

    if (!snapshot.empty) {
        const cliente = snapshot.docs[0].data();
        nombreInput.value = cliente.nombre || "";
        apellido1Input.value = cliente.apellido1 || "";
        apellido2Input.value = cliente.apellido2 || "";
        correoInput.value = cliente.correo || "";
        telefonoInput.value = cliente.telefono || "";
    }
}

// INICIO
generarCalendario();
cargarServicios();

fechaInput.addEventListener("change", cargarHorasDisponibles);
correoInput.addEventListener("blur", () => autocompletarCliente(correoInput.value));
telefonoInput.addEventListener("blur", () => autocompletarCliente(telefonoInput.value));

formReserva.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!fechaInput.value || !horaSelect.value || carrito.length === 0) return alert("Faltan datos.");

    try {
        const clienteId = (correoInput.value || telefonoInput.value || "cl_" + Date.now()).replace(/[.#$[\]]/g,'_');
        const clienteRef = doc(db, "clientes", clienteId);

        await setDoc(clienteRef, {
            nombre: nombreInput.value,
            apellido1: apellido1Input.value,
            apellido2: apellido2Input.value,
            correo: correoInput.value,
            telefono: telefonoInput.value,
            actualizado: Timestamp.now()
        }, { merge: true });

        for (const s of carrito) {
            await addDoc(collection(db, "citas"), {
                clienteId,
                servicioId: s.id,
                fecha: fechaInput.value,
                hora: horaSelect.value,
                duracion: s.duracion,
                simultaneo: s.simultaneo,
                creado: Timestamp.now()
            });
        }

        alert("¡Cita reservada!");
        window.location.reload();
    } catch (e) { console.error(e); }
});

onSnapshot(collection(db, "citas"), () => cargarHorasDisponibles());

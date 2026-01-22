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

// DOM PREMIUM
const serviciosGrid = document.getElementById("serviciosGrid");
const calendarioContenedor = document.getElementById("calendarioSemanas");
const horasVisualGrid = document.getElementById("horasVisualGrid");

const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
let carrito = [];
let duracionTotal = 0;

// FUNCIONES DE APOYO
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

// 1. GENERAR CALENDARIO SEMANAL
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

// 2. CARGAR SERVICIOS
async function cargarServicios() {
    servicioSelect.innerHTML = '<option value="">Seleccione un servicio</option>';
    serviciosGrid.innerHTML = "";
    const serviciosRef = collection(db, "servicios");
    const snapshot = await getDocs(serviciosRef);

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const option = document.createElement("option");
        option.value = docSnap.id;
        option.dataset.duracion = data.duracion || 60;
        option.dataset.simultaneo = data.simultaneo || false;
        option.textContent = data.nombre;
        servicioSelect.appendChild(option);

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

// 3. CARGAR HORAS (Lógica de simultaneidad tramo por tramo)
async function cargarHorasDisponibles() {
    horaSelect.innerHTML = '<option value="">Seleccione hora</option>';
    horasVisualGrid.innerHTML = "";
    const fecha = fechaInput.value;
    if (!fecha || carrito.length === 0) return;

    const citasRef = collection(db, "citas");
    const snapshotCitas = await getDocs(citasRef);
    const citasExistentes = snapshotCitas.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const horaApertura of HORAS) {
        let tiempoAnalizado = horaAMinutos(horaApertura);
        let esPosibleAgendarTodoElCarrito = true;

        for (const servicio of carrito) {
            const inicioServ = tiempoAnalizado;
            const finServ = inicioServ + servicio.duracion;

            const citasEnTramo = citasExistentes.filter(c => {
                const cInicio = horaAMinutos(c.hora);
                const cFin = cInicio + c.duracion;
                return c.fecha === fecha && !(finServ <= cInicio || inicioServ >= cFin);
            });

            if (citasEnTramo.length > 0) {
                const hayCitaBloqueante = citasEnTramo.some(c => c.simultaneo === false);
                if (hayCitaBloqueante) {
                    esPosibleAgendarTodoElCarrito = false;
                    break;
                }
                if (!servicio.simultaneo && citasEnTramo.length > 0) {
                    esPosibleAgendarTodoElCarrito = false;
                    break;
                }
                if (citasEnTramo.length >= 2) {
                    esPosibleAgendarTodoElCarrito = false;
                    break;
                }
            }
            tiempoAnalizado = finServ;
        }

        if (esPosibleAgendarTodoElCarrito) {
            const option = document.createElement("option");
            option.value = horaApertura;
            option.textContent = horaApertura;
            horaSelect.appendChild(option);

            const btn = document.createElement("div");
            btn.className = "hora-item";
            btn.textContent = horaApertura;
            btn.onclick = () => {
                document.querySelectorAll(".hora-item").forEach(el => el.classList.remove("selected"));
                btn.classList.add("selected");
                horaSelect.value = horaApertura;
            };
            horasVisualGrid.appendChild(btn);
        }
    }
}

// LÓGICA DE CARRITO
servicioSelect.addEventListener("change", () => {
    const selected = servicioSelect.selectedOptions[0];
    if (!selected || selected.value === "") return;
    if (carrito.some(s => s.id === selected.value)) return;

    const duracion = parseInt(selected.dataset.duracion);
    const simultaneo = selected.dataset.simultaneo === "true";

    carrito.push({ id: selected.value, nombre: selected.textContent, duracion, simultaneo });
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
            carrito.splice(i, 1);
            renderCarrito();
            cargarHorasDisponibles();
        });
    });
}

// AUTOCOMPLETAR CLIENTE
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

// INICIALIZACIÓN Y EVENTOS
generarCalendario();
cargarServicios();

fechaInput.addEventListener("change", cargarHorasDisponibles);
correoInput.addEventListener("blur", () => autocompletarCliente(correoInput.value));
telefonoInput.addEventListener("blur", () => autocompletarCliente(telefonoInput.value));

// FORM SUBMIT
formReserva.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!fechaInput.value || !horaSelect.value || carrito.length === 0) {
        return alert("Por favor, seleccione fecha, hora y servicios.");
    }

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

        let minutosCorrientes = horaAMinutos(horaSelect.value);

        for (const s of carrito) {
            const horaServicioTexto = minutosAHora(minutosCorrientes);

            await addDoc(collection(db, "citas"), {
                clienteId: clienteId,
                servicioId: s.id,
                fecha: fechaInput.value,
                hora: horaServicioTexto,
                duracion: Number(s.duracion),
                simultaneo: Boolean(s.simultaneo),
                creado: Timestamp.now()
            });

            minutosCorrientes += s.duracion;
        }

        alert("¡Cita reservada con éxito!");
        window.location.reload();

    } catch (error) {
        console.error("Error:", error);
        alert("Error al procesar la reserva.");
    }
});

onSnapshot(collection(db, "citas"), () => cargarHorasDisponibles());

import { db } from "./firebase.js";
import { collection, addDoc, setDoc, doc, getDocs, query, where, Timestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM
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

// HORAS DISPONIBLES
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

let carrito = [];
let duracionTotal = 0;

// UTIL: convertir hora "HH:MM" a minutos desde medianoche
function horaAMinutos(hora){
    const [h,m] = hora.split(":").map(Number);
    return h*60 + m;
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
    } else {
        nombreInput.value = "";
        apellido1Input.value = "";
        apellido2Input.value = "";
    }
}

correoInput.addEventListener("blur", () => autocompletarCliente(correoInput.value));
telefonoInput.addEventListener("blur", () => autocompletarCliente(telefonoInput.value));

// CARGAR SERVICIOS
async function cargarServicios() {
    servicioSelect.innerHTML = '<option value="">Seleccione un servicio</option>';
    const serviciosRef = collection(db, "servicios");
    const snapshot = await getDocs(serviciosRef);

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const option = document.createElement("option");
        option.value = docSnap.id;
        option.dataset.duracion = data.duracion || 60;
        option.dataset.simultaneo = data.simultaneo || false;
        option.textContent = `${data.nombre} - ₡${data.precio} (${data.duracion || 60} min)`;
        servicioSelect.appendChild(option);
    });
}

document.addEventListener("DOMContentLoaded", cargarServicios);

// CARRITO
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
    carritoDiv.innerHTML = `<h3>Carrito de servicios</h3>`;
    carrito.forEach((s, i) => {
        const div = document.createElement("div");
        div.innerHTML = `<span>${s.nombre}</span> <button data-index="${i}">Eliminar</button>`;
        carritoDiv.appendChild(div);

        div.querySelector("button").addEventListener("click", () => {
            duracionTotal -= s.duracion;
            carrito.splice(i, 1);
            renderCarrito();
            cargarHorasDisponibles();
        });
    });

    if (carrito.length > 0) {
        const total = document.createElement("p");
        total.textContent = `Duración total: ${duracionTotal} min`;
        carritoDiv.appendChild(total);
    }
}

// HORAS DISPONIBLES (control de minutos y reglas simultáneas)
async function cargarHorasDisponibles() {
    horaSelect.innerHTML = '<option value="">Seleccione hora</option>';
    const fecha = fechaInput.value;
    if (!fecha || carrito.length === 0) return;

    const citasRef = collection(db, "citas");
    const snapshotCitas = await getDocs(citasRef);
    const citas = snapshotCitas.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const hora of HORAS) {
        const inicio = horaAMinutos(hora);
        const fin = inicio + duracionTotal;

        // Filtrar citas del mismo día que se solapen
        const citasSolapadas = citas.filter(c => c.fecha === fecha && !(fin <= horaAMinutos(c.hora) || inicio >= horaAMinutos(c.hora) + c.duracion));

        let disponible = true;

        if (citasSolapadas.length > 0) {
            const primera = citasSolapadas[0];

            // Regla simultáneo: si la primera cita del rango no es simultánea, no se puede agregar simultáneo
            if (!primera.simultaneo && carrito.some(s => s.simultaneo)) {
                disponible = false;
            }

            // Máximo 2 citas aunque sean simultáneas
            if (citasSolapadas.length >= 2) disponible = false;
        }

        // Si no hay citas en este rango, la primera cita puede ser simultánea
        if (disponible) {
            const option = document.createElement("option");
            option.value = hora;
            option.textContent = hora;
            horaSelect.appendChild(option);
        }
    }
}

fechaInput.addEventListener("change", cargarHorasDisponibles);

// GUARDAR RESERVA
formReserva.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!fechaInput.value || !horaSelect.value || carrito.length === 0) return alert("Seleccione fecha, hora y servicio(s).");

    try {
        const clienteId = (correoInput.value || telefonoInput.value || "cliente_" + Date.now()).replace(/[.#$[\]]/g,'_');
        const clienteRef = doc(db, "clientes", clienteId);

        // Guardar cliente
        await setDoc(clienteRef, {
            nombre: nombreInput.value,
            apellido1: apellido1Input.value,
            apellido2: apellido2Input.value,
            correo: correoInput.value,
            telefono: telefonoInput.value,
            actualizado: Timestamp.now()
        }, { merge: true });

        const fecha = fechaInput.value;
        let horaInicio = horaAMinutos(horaSelect.value);

        // Validaciones antes de agregar
        const citasRef = collection(db, "citas");
        const snapshotCitas = await getDocs(citasRef);
        const citas = snapshotCitas.docs.map(d => ({ id: d.id, ...d.data() }));

        const fin = horaInicio + duracionTotal;
        const citasSolapadas = citas.filter(c => c.fecha === fecha && !(fin <= horaAMinutos(c.hora) || horaInicio >= horaAMinutos(c.hora) + c.duracion));

        if (citasSolapadas.length > 0) {
            const primera = citasSolapadas[0];
            if (!primera.simultaneo && carrito.some(s => s.simultaneo))
                return alert("No puedes agregar un servicio simultáneo porque la primera cita no lo permite");
            if (citasSolapadas.length >= 2) return alert("Máximo 2 citas en este periodo");
        }

        // Guardar citas
        for (const s of carrito) {
            await addDoc(collection(db, "citas"), {
                clienteId,
                servicioId: s.id,
                fecha,
                hora: horaSelect.value,
                duracion: s.duracion,
                simultaneo: s.simultaneo,
                creado: Timestamp.now()
            });
            horaInicio += s.duracion;
        }

        alert("¡Cita reservada con éxito!");
        formReserva.reset();
        carrito = [];
        duracionTotal = 0;
        carritoDiv.innerHTML = "";
        horaSelect.innerHTML = '<option value="">Seleccione hora</option>';

    } catch (error) {
        console.error(error);
        alert("Hubo un error al guardar la cita. Ver consola.");
    }
});

// Actualizar horas si hay nuevas reservas en tiempo real
onSnapshot(collection(db, "citas"), snapshot => cargarHorasDisponibles());

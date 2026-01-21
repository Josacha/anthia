import { db } from "./firebase.js";
import { collection, addDoc, setDoc, doc, getDocs, query, where, Timestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ... todos los elementos del DOM, carrito, HORAS, etc., igual que antes ...

// Guardar reserva
formReserva.addEventListener("submit", async e => {
    e.preventDefault();
    if(!fechaInput.value || !horaSelect.value || carrito.length===0) return alert("Seleccione fecha, hora y servicio(s)");
    
    try {
        const clienteId = (correoInput.value || telefonoInput.value || "cliente_" + Date.now()).replace(/[.#$[\]]/g,'_');
        await setDoc(doc(db,"clientes",clienteId),{
            nombre:nombreInput.value,
            apellido1:apellido1Input.value,
            apellido2:apellido2Input.value,
            correo:correoInput.value,
            telefono:telefonoInput.value,
            actualizado:Timestamp.now()
        },{merge:true});

        let horaIndex = HORAS.indexOf(horaSelect.value);
        for(const s of carrito){
            await addDoc(collection(db,"citas"),{
                clienteId,
                servicioId: s.id,
                fecha: fechaInput.value,
                hora: HORAS[horaIndex],
                duracion: s.duracion,
                simultaneo: s.simultaneo,
                creado: Timestamp.now()
            });
            horaIndex += Math.ceil(s.duracion/60);
        }

        alert("¡Cita reservada!");
        formReserva.reset();
        carrito = [];
        duracionTotal = 0;
        carritoDiv.innerHTML = "";
        horaSelect.innerHTML = '<option value="">Seleccione hora</option>';
    } catch(err){ console.error(err); alert("Error al guardar cita"); }
});

// OPCIONAL: escuchar cambios en citas y recargar horas
onSnapshot(collection(db,"citas"), snapshot => {
    cargarHorasDisponibles();
});

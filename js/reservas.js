import { db } from "./firebase.js";
import { collection, addDoc, doc, getDoc, setDoc, Timestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const formReserva = document.getElementById("formReserva");
const correoInput = document.getElementById("correo");
const telefonoInput = document.getElementById("telefono");
const nombreInput = document.getElementById("nombre");
const apellido1Input = document.getElementById("apellido1");
const apellido2Input = document.getElementById("apellido2");

// Función para autocompletar si ya existe el cliente
async function autocompletarCliente(valor) {
  const clientesRef = collection(db, "clientes");
  
  // Buscar por correo o teléfono
  const q = query(clientesRef, 
                  where("correo", "==", valor));
  let snapshot = await getDocs(q);

  if (snapshot.empty) {
    // Si no hay por correo, buscar por teléfono
    const q2 = query(clientesRef, 
                    where("telefono", "==", valor));
    snapshot = await getDocs(q2);
  }

  if (!snapshot.empty) {
    const cliente = snapshot.docs[0].data();
    nombreInput.value = cliente.nombre || "";
    apellido1Input.value = cliente.apellido1 || "";
    apellido2Input.value = cliente.apellido2 || "";
    correoInput.value = cliente.correo || "";
    telefonoInput.value = cliente.telefono || "";
  } else {
    // Si no existe, limpiar campos excepto correo/teléfono
    nombreInput.value = "";
    apellido1Input.value = "";
    apellido2Input.value = "";
  }
}

// Llamar autocompletar al cambiar correo o teléfono
correoInput.addEventListener("blur", () => autocompletarCliente(correoInput.value));
telefonoInput.addEventListener("blur", () => autocompletarCliente(telefonoInput.value));


// Función para crear reserva
formReserva.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    // Crear/actualizar cliente en Firestore
    const clienteId = correoInput.value || telefonoInput.value; // ID único
    const clienteRef = doc(db, "clientes", clienteId);

    await setDoc(clienteRef, {
      nombre: nombreInput.value,
      apellido1: apellido1Input.value,
      apellido2: apellido2Input.value,
      correo: correoInput.value,
      telefono: telefonoInput.value,
      actualizado: Timestamp.now()
    }, { merge: true }); // merge:true para no borrar datos existentes

    // Crear la cita
    await addDoc(collection(db, "citas"), {
      servicio: document.getElementById("servicio").value,
      fecha: document.getElementById("fecha").value,
      hora: document.getElementById("hora").value,
      clienteId: clienteId,
      creado: Timestamp.now()
    });

    alert("¡Cita reservada con éxito!");
    formReserva.reset();

  } catch (error) {
    console.error("Error al crear la reserva:", error);
    alert("Hubo un error al guardar la cita. Intente nuevamente.");
  }
});

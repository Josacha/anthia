document.addEventListener("DOMContentLoaded", () => {

  const contactoInput = document.getElementById("contacto");
  const nombreInput = document.getElementById("nombre");
  const apellido1Input = document.getElementById("apellido1");
  const apellido2Input = document.getElementById("apellido2");

  let timeout = null;

  // AUTOCOMPLETAR CLIENTE
  contactoInput.addEventListener("input", () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      buscarCliente(contactoInput.value.trim());
    }, 600);
  });

  async function buscarCliente(valor) {
    if (!valor) {
      limpiarCampos();
      return;
    }

    let cliente = null;

    // Buscar por correo
    if (valor.includes("@")) {
      const clientesRef = collection(db, "clientes");
      const q = query(clientesRef, where("correo", "==", valor));
      const snap = await getDocs(q);
      if (!snap.empty) cliente = snap.docs[0].data();
    } else {
      // Buscar por teléfono
      const clientesRef = collection(db, "clientes");
      const q = query(clientesRef, where("telefono", "==", valor));
      const snap = await getDocs(q);
      if (!snap.empty) cliente = snap.docs[0].data();
    }

    if (cliente) {
      nombreInput.value = cliente.nombre || "";
      apellido1Input.value = cliente.apellido1 || "";
      apellido2Input.value = cliente.apellido2 || "";

      nombreInput.classList.add("auto");
      apellido1Input.classList.add("auto");
      apellido2Input.classList.add("auto");
    } else {
      limpiarCampos();
    }
  }

  function limpiarCampos() {
    nombreInput.value = "";
    apellido1Input.value = "";
    apellido2Input.value = "";

    nombreInput.classList.remove("auto");
    apellido1Input.classList.remove("auto");
    apellido2Input.classList.remove("auto");
  }

});

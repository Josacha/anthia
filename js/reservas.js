// HORAS DISPONIBLES CON REGLAS AJUSTADAS
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
            // Hay al menos una cita en este rango
            const primera = citasSolapadas[0];
            if (!primera.simultaneo && carrito.some(s => s.simultaneo)) {
                // No se puede agregar simultáneo si la primera cita no lo permite
                disponible = false;
            } 
            // Máximo 2 citas aunque sean simultáneas
            if (citasSolapadas.length >= 2) disponible = false;
        }
        // Si no hay citas en este rango, la primera cita simultánea sí se permite

        if (disponible) {
            const option = document.createElement("option");
            option.value = hora;
            option.textContent = hora;
            horaSelect.appendChild(option);
        }
    }
}

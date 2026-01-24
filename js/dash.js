import { db, auth } from './firebase.js';
import { collection, query, where, getDocs, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function initDashboard() {
    try {
        const hoy = new Date();
        const lunes = new Date(hoy.setDate(hoy.getDate() - hoy.getDay() + 1));
        lunes.setHours(0,0,0,0);

        // 1. Contar citas para la barra de progreso
        const qStats = query(collection(db, "citas"), where("fecha", ">=", lunes.toISOString()));
        const snapshotStats = await getDocs(qStats);
        actualizarBarra(snapshotStats.size);

        // 2. Mostrar las 3 próximas citas
        const qRecent = query(
            collection(db, "citas"), 
            where("fecha", ">=", new Date().toISOString()),
            orderBy("fecha", "asc"),
            limit(3)
        );
        const snapshotRecent = await getDocs(qRecent);
        renderRecentList(snapshotRecent);

        // 3. Actualizar el nombre del día
        const opciones = { weekday: 'long' };
        document.getElementById('current-day-name').innerText = new Intl.DateTimeFormat('es-ES', opciones).format(new Date());

    } catch (e) {
        console.error("Error", e);
    }
}

function actualizarBarra(total) {
    const porcentaje = Math.min(Math.round((total / 20) * 100), 100);
    document.getElementById('progress-fill').style.width = `${porcentaje}%`;
    document.getElementById('ocupacion-porcentaje').innerText = `${porcentaje}%`;
    document.getElementById('stat-detalle').innerText = `${total} citas agendadas de 20 disponibles esta semana.`;
}

function renderRecentList(snapshot) {
    const list = document.getElementById('recent-list');
    list.innerHTML = '';

    if(snapshot.empty) {
        list.innerHTML = '<div class="recent-item">No hay citas próximas</div>';
        return;
    }

    snapshot.forEach(doc => {
        const cita = doc.data();
        const fechaCita = new Date(cita.fecha);
        const hora = fechaCita.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        list.innerHTML += `
            <div class="recent-item">
                <div>
                    <span class="c-name">${cita.nombreCliente || 'Cliente'}</span>
                    <span class="c-service">${cita.servicio || 'Servicio'}</span>
                </div>
                <span class="c-time">${hora}</span>
            </div>
        `;
    });
}

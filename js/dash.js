import { db, auth } from './firebase.js';
import { collection, query, where, getDocs, limit, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Escuchar el estado de autenticación (ESTO ES LO QUE FALTA)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Si hay usuario, saludamos e iniciamos el dashboard
        document.getElementById('welcome-title').innerText = `Bienvenida, ${user.displayName || 'Andre'}`;
        initDashboard();
    } else {
        // Si no está logueado, lo sacamos al login
        window.location.href = '../login.html';
    }
});

async function initDashboard() {
    try {
        const hoy = new Date();
        // Ajuste para obtener el lunes de esta semana
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - (hoy.getDay() === 0 ? 6 : hoy.getDay() - 1));
        lunes.setHours(0, 0, 0, 0);

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
        console.error("Error cargando datos:", e);
    }
}

function actualizarBarra(total) {
    const cupoMaximo = 20;
    const porcentaje = Math.min(Math.round((total / cupoMaximo) * 100), 100);
    
    const fill = document.getElementById('progress-fill');
    const porcTxt = document.getElementById('ocupacion-porcentaje');
    const detTxt = document.getElementById('stat-detalle');

    if(fill) fill.style.width = `${porcentaje}%`;
    if(porcTxt) porcTxt.innerText = `${porcentaje}%`;
    if(detTxt) detTxt.innerText = `${total} citas agendadas de ${cupoMaximo} disponibles esta semana.`;
}

function renderRecentList(snapshot) {
    const list = document.getElementById('recent-list');
    if(!list) return;
    
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

// Lógica del botón cerrar sesión
document.getElementById('btnLogout')?.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = '../login.html';
    });
});

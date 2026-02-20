import { db, auth } from './firebase.js';
import { 
    collection, query, where, limit, orderBy, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- ESTADO DE AUTENTICACIÓN ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        const welcomeTitle = document.getElementById('welcome-title');
        if (welcomeTitle) welcomeTitle.innerText = `Bienvenida, ${user.displayName || 'Andre'}`;
        initDashboard();
    } else {
        window.location.href = '../login.html';
    }
});

// --- LÓGICA PRINCIPAL DEL DASHBOARD (TIEMPO REAL) ---
async function initDashboard() {
    try {
        const hoy = new Date();
        
        // 1. Calcular el lunes de esta semana
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - (hoy.getDay() === 0 ? 6 : hoy.getDay() - 1));
        const fechaLunesISO = lunes.toISOString().split('T')[0];

        // 2. ESCUCHADOR EN TIEMPO REAL: Estadísticas y Barra de Progreso
        const qStats = query(collection(db, "citas"), where("fecha", ">=", fechaLunesISO));
        
        onSnapshot(qStats, (snapshot) => {
            let horasOcupadas = 0;
            let ingresosFijosSemana = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                
                // Cálculo de tiempo
                const duracionMinutos = Number(data.duracion) || 60;
                horasOcupadas += (duracionMinutos / 60);
                
                // Suma de inversión fija
                ingresosFijosSemana += Number(data.inversionFija || 0);
            });

            const CAPACIDAD_SEMANAL = 60; 
            actualizarBarra(horasOcupadas, CAPACIDAD_SEMANAL);
            
            const txtIngresos = document.getElementById('stat-ingresos');
            if(txtIngresos) txtIngresos.innerText = `₡${ingresosFijosSemana.toLocaleString()}`;
        });

        // 3. ESCUCHADOR EN TIEMPO REAL: Próximas 3 citas
        const hoyISO = hoy.toISOString().split('T')[0];
        const qRecent = query(
            collection(db, "citas"), 
            where("fecha", ">=", hoyISO),
            orderBy("fecha", "asc"),
            limit(3)
        );

        onSnapshot(qRecent, (snapshot) => {
            renderRecentList(snapshot);
        });

        // 4. Nombre del día actual
        const opciones = { weekday: 'long' };
        const dayNameEl = document.getElementById('current-day-name');
        if (dayNameEl) {
            dayNameEl.innerText = new Intl.DateTimeFormat('es-ES', opciones).format(hoy);
        }

    } catch (e) {
        console.error("Error cargando datos del dashboard:", e);
    }
}

// --- ACTUALIZACIÓN VISUAL DE LA BARRA DE PROGRESO ---
function actualizarBarra(ocupadas, total) {
    const porcentaje = Math.min(Math.round((ocupadas / total) * 100), 100);
    
    const fill = document.getElementById('progress-fill');
    const porcTxt = document.getElementById('ocupacion-porcentaje');
    const detTxt = document.getElementById('stat-detalle');

    if(fill) {
        fill.style.width = `${porcentaje}%`;
        // Colores según carga
        if(porcentaje < 50) fill.style.backgroundColor = "#2ecc71"; // Verde
        else if(porcentaje < 85) fill.style.backgroundColor = "#f1c40f"; // Amarillo
        else fill.style.backgroundColor = "#e74c3c"; // Rojo
    }
    
    if(porcTxt) porcTxt.innerText = `${porcentaje}%`;
    if(detTxt) {
        detTxt.innerHTML = `
            Has ocupado <strong>${ocupadas.toFixed(1)}h</strong> de las <strong>${total}h</strong> disponibles esta semana.
        `;
    }
}

// --- RENDERIZADO DE CITAS RECIENTES ---
function renderRecentList(snapshot) {
    const list = document.getElementById('recent-list');
    if(!list) return;
    
    list.innerHTML = '';

    if(snapshot.empty) {
        list.innerHTML = '<div class="recent-item">No hay citas para los próximos días</div>';
        return;
    }

    snapshot.forEach(doc => {
        const cita = doc.data();
        const cliente = cita.nombreCliente || "Cliente"; 
        const servicio = cita.nombresServicios || cita.nombreServicio || "Servicio";
        const hora = cita.hora || "--:--";
        const fechaStr = cita.fecha;

        list.innerHTML += `
            <div class="recent-item">
                <div>
                    <span class="c-name">${cliente}</span>
                    <span class="c-service">${servicio}</span>
                    <small style="display:block; color:#888; font-size: 11px;">${fechaStr}</small>
                </div>
                <span class="c-time">${hora}</span>
            </div>
        `;
    });
}

// --- CERRAR SESIÓN ---
document.getElementById('btnLogout')?.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = '../login.html';
    });
});

import { db, auth } from './firebase.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Configuración: Cupo máximo de Andre a la semana
const MAX_CITAS_SEMANA = 20; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. Control de acceso
    onAuthStateChanged(auth, (user) => {
        if (user) {
            document.getElementById('welcome-title').innerText = `Bienvenida, ${user.displayName || 'Andre'}`;
            initDashboard();
        } else {
            window.location.href = '../login.html';
        }
    });

    // 2. Botón Logout
    document.getElementById('btnLogout')?.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = '../login.html');
    });
});

async function initDashboard() {
    try {
        // Obtener citas de la semana
        const hoy = new Date();
        const lunes = new Date(hoy.setDate(hoy.getDate() - hoy.getDay() + 1));
        lunes.setHours(0,0,0,0);

        const q = query(collection(db, "citas"), where("fecha", ">=", lunes.toISOString()));
        const snapshot = await getDocs(q);
        const totalCitas = snapshot.size;

        // Calcular porcentaje
        const porcentaje = Math.min(Math.round((totalCitas / MAX_CITAS_SEMANA) * 100), 100);

        // Actualizar Interfaz con animación
        const fill = document.getElementById('progress-fill');
        const txt = document.getElementById('ocupacion-porcentaje');
        const det = document.getElementById('stat-detalle');

        setTimeout(() => {
            fill.style.width = `${porcentaje}%`;
            txt.innerText = `${porcentaje}%`;
            det.innerText = `${totalCitas} citas agendadas de ${MAX_CITAS_SEMANA} espacios disponibles esta semana.`;
        }, 300);

    } catch (e) {
        console.error("Error cargando dashboard", e);
    }
}

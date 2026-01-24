import { db, auth } from './firebase.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Configuración de Andre Arias
const CAPACIDAD_SEMANAL = 25; // 5 citas diarias x 5 días

document.addEventListener('DOMContentLoaded', () => {
    checkUser();
    cargarEstadisticasSemanales();
});

// 1. Verificar Autenticación
function checkUser() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const name = user.displayName || "Andre";
            document.getElementById('welcome-title').textContent = `Bienvenida, ${name}`;
        } else {
            // Si no hay usuario, redirigir al login
            window.location.href = "../login.html";
        }
    });
}

// 2. Lógica de Estadísticas Semanales
async function cargarEstadisticasSemanales() {
    try {
        const hoy = new Date();
        const inicioSemana = new Date(hoy.setDate(hoy.getDate() - hoy.getDay() + 1)); // Lunes
        inicioSemana.setHours(0,0,0,0);

        const q = query(
            collection(db, "reservas"), 
            where("fecha", ">=", inicioSemana.toISOString())
        );

        const querySnapshot = await getDocs(q);
        const totalCitas = querySnapshot.size;

        actualizarUI(totalCitas);
    } catch (error) {
        console.error("Error al obtener estadísticas:", error);
    }
}

// 3. Animación y Actualización de Interfaz
function actualizarUI(citas) {
    const porcentaje = Math.min(Math.round((citas / CAPACIDAD_SEMANAL) * 100), 100);
    const barra = document.getElementById('progress-fill');
    const textoPorcentaje = document.getElementById('ocupacion-porcentaje');
    const detalle = document.getElementById('stat-detalle');

    // Efecto de carga suave
    setTimeout(() => {
        barra.style.width = `${porcentaje}%`;
        textoPorcentaje.textContent = `${porcentaje}%`;
        detalle.textContent = `${citas} de ${CAPACIDAD_SEMANAL} espacios reservados esta semana`;
        
        // Cambio de color si está casi lleno
        if(porcentaje > 80) {
            barra.style.background = "linear-gradient(90deg, #c5a059, #ff4d4d)";
        }
    }, 500);
}

// 4. Botón de Cerrar Sesión
document.getElementById('btnLogout')?.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = "../login.html";
    });
});

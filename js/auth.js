import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =========================
   CONTROL DE SESIÓN
========================= */
onAuthStateChanged(auth, (user) => {
  const path = window.location.pathname;
  const esLogin = path.endsWith("login.html");
  const enViews = path.includes("/views/");

  if (!user && !esLogin) {
    // Si no está logueado:
    // Desde /admin/views/agenda.html -> necesita salir de views con "../login.html"
    // Desde /admin/dashboard.html    -> login.html está en la misma carpeta "admin"
    window.location.href = enViews ? "../login.html" : "login.html";
  }

  if (user && esLogin) {
    // Si ya está logueado y entra al login, va al dashboard (están al mismo nivel)
    window.location.href = "dashboard.html";
  }
});

/* =========================
   LOGIN
========================= */
const formLogin = document.getElementById("formLogin");
if (formLogin) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // El dashboard está en la misma carpeta que el login (/admin/)
      window.location.href = "dashboard.html";
    } catch (error) {
      const errorDiv = document.getElementById("errorMsg");
      if (errorDiv) errorDiv.textContent = "Correo o contraseña incorrectos";
    }
  });
}

/* =========================
   LOGOUT
========================= */
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    try {
      await signOut(auth);
      const enViews = window.location.pathname.includes("/views/");
      // Redirección inteligente al salir
      window.location.href = enViews ? "../login.html" : "login.html";
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  });
}

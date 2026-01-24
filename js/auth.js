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

  const esLogin = path.includes("/admin/login.html");

  // ❌ NO logueado y NO está en login → mandar a login
  if (!user && !esLogin) {
    window.location.href = "/anthia/admin/login.html";
  }

  // ✅ Logueado y está en login → mandar a dashboard
  if (user && esLogin) {
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
      window.location.href = "dashboard.html";
    } catch (error) {
      document.getElementById("errorMsg").textContent =
        "Correo o contraseña incorrectos";
    }
  });
}

/* =========================
   LOGOUT
========================= */
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

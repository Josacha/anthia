import { auth } from './firebase.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const formLogin = document.getElementById('formLogin');
const errorMsg = document.getElementById('errorMsg');

formLogin.addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // Redirigir a dashboard
    window.location.href = 'dashboard.html';
  } catch (error) {
    console.error(error);
    errorMsg.textContent = 'Correo o contraseña incorrectos.';
  }
});

// Detectar si ya hay sesión activa
onAuthStateChanged(auth, user => {
  if (user) {
    window.location.href = 'dashboard.html';
  }
});


import { auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, user => {
  if (!user) {
    // No hay usuario logueado → redirigir al login
    window.location.href = '../login.html';
  }
});

// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Analytics es opcional
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCpLE36u3xpQUZiUUBGHZTgcuTTAMiHybY",
  authDomain: "anthia-salon.firebaseapp.com",
  projectId: "anthia-salon",
  storageBucket: "anthia-salon.firebasestorage.app",
  messagingSenderId: "1013724768884",
  appId: "1:1013724768884:web:e10c0cc47ac854704c3f21",
  measurementId: "G-X53ET2LTGM"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Servicios principales
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics (solo si el navegador lo soporta)
let analytics;
isSupported().then((yes) => {
  if (yes) {
    analytics = getAnalytics(app);
  }
});

export { analytics };


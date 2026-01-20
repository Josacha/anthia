import { db } from "./firebase.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById("formConfiguracion");

async function cargarConfig(){
  const docRef = doc(db, "config", "general");
  const docSnap = await getDoc(docRef);
  if(docSnap.exists()){
    const c = docSnap.data();
    form.inicioHorario.value = c.inicio || "";
    form.finHorario.value = c.fin || "";
    form.intervaloCitas.value = c.intervalo || "";
    form.maxCitas.value = c.maxCitas || "";
  }
}

form.addEventListener("submit", async e=>{
  e.preventDefault();
  await setDoc(doc(db, "config", "general"), {
    inicio: form.inicioHorario.value,
    fin: form.finHorario.value,
    intervalo: parseInt(form.intervaloCitas.value),
    maxCitas: parseInt(form.maxCitas.value)
  });
  alert("Configuración guardada");
});

cargarConfig();


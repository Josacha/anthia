import { db } from "./firebase.js";
import { collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const menuData = {
    "Tratamientos Capilares (Fibra)": ["💧 Hidratación", "🥑 Nutrición", "🧬 Reparación / Botox capilar", "✨ Alaciados / Control de volumen"],
    "Tratamientos de Cuero Cabelludo (Raíz)": ["🧴 Caspa", "🌱 Caída / Crecimiento", "⚖️ Exceso de grasa", "🌸 Dermo-sensibilidad / Irritación"],
    "Servicios de Color": ["🎨 Color completo", "👵 Cubrimiento de canas", "🖌️ Diseño de color (Balayage/Mechas)"],
    "Servicios de Corte": ["✂️ Corte de puntas", "💇‍♀️ Corte cabello largo", "🌀 Corte cabello rizado", "🧼 Corte bordado"],
    "Tratamientos Faciales": ["🫧 Limpieza Facial Profunda", "✨ Facial Renovador", "💧 Facial Hidratante", "🛡️ Facial Antioxidante", "⚖️ Tratamiento Despigmentante", "⏳ Tratamiento Antiage"],
    "Depilación y Cejas": ["🧵 Depilación facial con hilo", "📐 Diseño de cejas", "🎨 Diseño de cejas con henna"],
    "Maquillaje y Peinado Eventos": ["💄 Maquillaje evento social", "💇‍♀️ Peinado evento social"],
    "Maquillaje Fantasía": ["🎨 Maquillaje de fantasía", "👺 Caracterización de personajes"]
};

const catSelect = document.getElementById("categoriaServicio");
const subSelect = document.getElementById("subcategoriaServicio");
const form = document.getElementById("formServicios");
const tbody = document.querySelector("#tablaServicios tbody");
const buscador = document.getElementById("busquedaServicio");

// Lógica de selectores dinámicos
catSelect.addEventListener("change", (e) => {
    const seleccion = e.target.value;
    subSelect.innerHTML = '<option value="">Seleccione subcategoría...</option>';
    
    if (seleccion && menuData[seleccion]) {
        subSelect.disabled = false;
        menuData[seleccion].forEach(sub => {
            const opt = document.createElement("option");
            opt.value = sub;
            opt.textContent = sub;
            subSelect.appendChild(opt);
        });
    } else {
        subSelect.disabled = true;
    }
});

function renderFila(id, data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>
            <span class="badge-cat" style="color:var(--gold); font-size:9px; display:block; text-transform:uppercase;">${data.categoria}</span>
            <span style="font-size:11px; font-weight:600; color:#555;">${data.subcategoria}</span>
        </td>
        <td style="font-weight: 600;">${data.nombre}</td>
        <td>${data.duracion} min</td>
        <td>₡${Number(data.precio).toLocaleString()}</td>
        <td style="text-align:center;">${data.simultaneo ? '✨' : '🔒'}</td>
        <td>
            <button class="btn-eliminar" onclick="window.eliminarServicio('${id}', '${data.nombre}')">🗑️</button>
        </td>
    `;
    return tr;
}

window.eliminarServicio = async (id, nombre) => {
    if (confirm(`¿Eliminar el servicio "${nombre}"?`)) {
        await deleteDoc(doc(db, "servicios", id));
    }
};

onSnapshot(collection(db, "servicios"), (snap) => {
    tbody.innerHTML = "";
    let lista = [];
    snap.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
    lista.sort((a, b) => a.categoria.localeCompare(b.categoria));
    lista.forEach(item => tbody.appendChild(renderFila(item.id, item)));
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nuevo = {
        categoria: catSelect.value,
        subcategoria: subSelect.value,
        nombre: document.getElementById("nombreServicio").value,
        duracion: Number(document.getElementById("duracionServicio").value),
        precio: Number(document.getElementById("precioServicio").value),
        simultaneo: document.getElementById("simultaneoServicio").checked
    };
    await addDoc(collection(db, "servicios"), nuevo);
    form.reset();
    subSelect.disabled = true;
});

buscador.addEventListener("input", (e) => {
    const t = e.target.value.toLowerCase();
    const filas = tbody.querySelectorAll("tr");
    filas.forEach(f => f.style.display = f.textContent.toLowerCase().includes(t) ? "" : "none");
});

import { db } from "./firebase.js";
import { collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Estructura oficial de Andre Arias
const menuData = {
    "Tratamientos Capilares (Fibra)": ["💧 Hidratación", "🥑 Nutrición", "🧬 Reparación / Botox capilar", "✨ Alaciados / Control de volumen"],
    "Tratamientos de Cuero Cabelludo (Raíz)": ["🧴 Caspa", "🌱 Caída / Crecimiento", "⚖️ Exceso de grasa", "🌸 Dermo-sensibilidad / Irritación"],
    "Tratamientos Faciales": ["✨ Limpieza Facial Profunda", "✨ Facial Renovador", "✨ Facial Hidratante", "✨ Facial Antioxidante", "✨ Tratamiento Despigmentante", "✨ Tratamiento Antiage"],
    "Depilación y Cejas": ["🌿 Depilación facial con hilo", "🌿 Diseño de cejas", "🌿 Diseño de cejas con henna"]
};

const catSelect = document.getElementById("categoriaServicio");
const subSelect = document.getElementById("subcategoriaServicio");
const form = document.getElementById("formServicios");
const tbody = document.querySelector("#tablaServicios tbody");
const buscador = document.getElementById("busquedaServicio");

// Lógica de selectores dependientes
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
            <span class="badge-cat" style="color:var(--gold); font-size:9px; display:block;">${data.categoria}</span>
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

// Carga de datos en tiempo real
onSnapshot(collection(db, "servicios"), (snap) => {
    tbody.innerHTML = "";
    let lista = [];
    snap.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
    
    // Ordenar por categoría principal
    lista.sort((a, b) => a.categoria.localeCompare(b.categoria));
    
    lista.forEach(item => tbody.appendChild(renderFila(item.id, item)));
});

// Guardar nuevo servicio
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

// Buscador dinámico
buscador.addEventListener("input", (e) => {
    const t = e.target.value.toLowerCase();
    const filas = tbody.querySelectorAll("tr");
    filas.forEach(f => f.style.display = f.textContent.toLowerCase().includes(t) ? "" : "none");
});

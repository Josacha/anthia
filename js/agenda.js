import { db } from "./firebase.js";
import { collection, doc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ELEMENTOS DEL DOM
const fechaInput = document.getElementById("fechaAgenda");
const tbody = document.querySelector("#tablaAgenda tbody");
const modal = document.getElementById("modalCita");
const btnNuevaCita = document.getElementById("btnNuevaCita");
const guardarCita = document.getElementById("guardarCita");
const cancelarModal = document.getElementById("cancelarModal");
const clienteNombre = document.getElementById("clienteNombre");
const servicioSelect = document.getElementById("servicioSelect");
const simultaneoCheck = document.getElementById("simultaneo");

// CARRITO
let carrito = [];
let horaSeleccionada = null;

// HORAS
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

// FECHA HOY
function hoyISO(){ return new Date().toISOString().split("T")[0]; }

// ----------------------
// CARGAR SERVICIOS
// ----------------------
async function cargarServicios() {
    servicioSelect.innerHTML = "";
    const snap = await getDocs(collection(db,"servicios"));
    snap.forEach(d=>{
        const s=d.data();
        const opt=document.createElement("option");
        opt.value=s.nombre;
        opt.dataset.simultaneo=s.simultaneo || false;
        opt.dataset.duracion=s.duracion || 60;
        opt.textContent=`${s.nombre} (${s.duracion || 60} min)`;
        servicioSelect.appendChild(opt);
    });
}

// ----------------------
// CARRITO EN MODAL
// ----------------------
function actualizarCarrito(){
    const existente=document.getElementById("carritoServicios");
    if(existente) existente.remove();
    const div=document.createElement("div");
    div.id="carritoServicios";
    div.style.marginTop="10px";
    div.innerHTML=carrito.map((s,i)=>`
        <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span>${s.nombre} (${s.duracion} min)</span>
            <button type="button" data-index="${i}">❌</button>
        </div>
    `).join("");
    modal.querySelector(".acciones").before(div);
    div.querySelectorAll("button").forEach(b=>{
        b.addEventListener("click",()=>{ carrito.splice(b.dataset.index,1); actualizarCarrito(); });
    });
}

// Añadir servicio
servicioSelect.addEventListener("change", ()=>{
    const opt = servicioSelect.selectedOptions[0];
    if(opt){
        carrito.push({ nombre: opt.value, duracion: parseInt(opt.dataset.duracion), simultaneo: opt.dataset.simultaneo==="true" });
        actualizarCarrito();
    }
});

// ----------------------
// AGENDA EN TIEMPO REAL
// ----------------------
function cargarAgendaRealtime(fecha){
    tbody.innerHTML="";
    const citasRef = collection(db,"citas");
    onSnapshot(citasRef, snapshot=>{
        const citas = snapshot.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.fecha===fecha);

        const bloquesOcupados={};
        HORAS.forEach(h=> bloquesOcupados[h]=[]);
        citas.forEach(c=>{
            const dur = (c.servicios||[]).reduce((a,s)=>a+(s.duracion||0),0);
            const bloques = Math.ceil(dur/60) || 1;
            const inicio = HORAS.indexOf(c.hora);
            for(let i=0;i<bloques;i++){
                const h=HORAS[inicio+i];
                if(h) bloquesOcupados[h].push(c);
            }
        });

        tbody.innerHTML="";
        HORAS.forEach(h=>{
            const tr=document.createElement("tr");
            const citasHora=bloquesOcupados[h]||[];
            let ocupado = citasHora.length>=2 && !citasHora.some(c=>c.simultaneo);
            let cita=citasHora[0];
            tr.innerHTML=`
                <td>${h}</td>
                <td>${cita?.clienteNombre||"-"}</td>
                <td>${cita ? (cita.servicios||[]).map(s=>s.nombre).join(", ") : "-"}</td>
                <td>${ocupado?"Ocupado":"Disponible"}</td>
                <td>${cita ? `<button class="editar" data-id="${cita.id}">✏️</button>
                              <button class="eliminar" data-id="${cita.id}">🗑️</button>` : ""}</td>
            `;
            if(!ocupado){
                tr.addEventListener("click", ()=>{
                    horaSeleccionada=h;
                    modal.classList.add("active");
                    carrito=[];
                    actualizarCarrito();
                });
            }
            tbody.appendChild(tr);
        });

        // EDITAR
        document.querySelectorAll(".editar").forEach(btn=>{
            btn.onclick=async ()=>{
                const c=citas.find(ci=>ci.id===btn.dataset.id);
                horaSeleccionada=c.hora;
                clienteNombre.value=c.clienteNombre;
                carrito=Array.isArray(c.servicios)?c.servicios.slice():[];
                actualizarCarrito();
                modal.classList.add("active");
                guardarCita.onclick=async ()=>{
                    await updateDoc(doc(db,"citas",c.id),{clienteNombre:clienteNombre.value, servicios:carrito});
                    modal.classList.remove("active");
                };
            };
        });

        // ELIMINAR
        document.querySelectorAll(".eliminar").forEach(btn=>{
            btn.onclick=async ()=>{
                if(confirm("¿Eliminar esta cita?")) await deleteDoc(doc(db,"citas",btn.dataset.id));
            };
        });
    });
}

// ----------------------
// NUEVA CITA
// ----------------------
guardarCita.onclick=async ()=>{
    if(!horaSeleccionada) return alert("Selecciona una hora");
    await addDoc(collection(db,"citas"),{
        fecha:fechaInput.value,
        hora:horaSeleccionada,
        clienteNombre:clienteNombre.value,
        servicios:carrito,
        simultaneo:simultaneoCheck.checked
    });
    modal.classList.remove("active");
    clienteNombre.value="";
    carrito=[];
    actualizarCarrito();
};

cancelarModal.onclick=()=>modal.classList.remove("active");
btnNuevaCita.onclick=()=>{
    horaSeleccionada=null;
    clienteNombre.value="";
    carrito=[];
    actualizarCarrito();
    modal.classList.add("active");
};

// ----------------------
// INIT
// ----------------------
document.addEventListener("DOMContentLoaded", async ()=>{
    fechaInput.value=hoyISO();
    await cargarServicios();
    cargarAgendaRealtime(fechaInput.value);
});

fechaInput.addEventListener("change", ()=>cargarAgendaRealtime(fechaInput.value));

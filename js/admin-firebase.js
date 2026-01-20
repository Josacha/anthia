// Import Firebase
import { db } from './firebase.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ===================
// FUNCIONES DE CARGA DE DATOS
// ===================
export async function cargarServicios() {
  const tabla = document.getElementById('tablaServicios');
  if (!tabla) return;
  tabla.innerHTML = '';
  const querySnapshot = await getDocs(collection(db, 'servicios'));
  querySnapshot.forEach(docu => {
    const data = docu.data();
    tabla.innerHTML += `
      <tr>
        <td>${data.nombre}</td>
        <td>${data.duracion}</td>
        <td>${data.precio}</td>
        <td>${data.simultaneo ? 'Sí' : 'No'}</td>
        <td>
          <button onclick="editarDocumento('servicios','${docu.id}')">Editar</button>
          <button onclick="eliminarDocumento('servicios','${docu.id}')">Eliminar</button>
        </td>
      </tr>
    `;
  });
}

export async function cargarContactos() {
  const tabla = document.getElementById('tablaContactos');
  if (!tabla) return;
  tabla.innerHTML = '';
  const querySnapshot = await getDocs(collection(db, 'clientes'));
  querySnapshot.forEach(docu => {
    const data = docu.data();
    tabla.innerHTML += `
      <tr>
        <td>${data.nombre} ${data.apellido1} ${data.apellido2 || ''}</td>
        <td>${data.correo}</td>
        <td>${data.telefono}</td>
        <td>${data.historial?.length || 0}</td>
        <td>
          <button onclick="editarDocumento('clientes','${docu.id}')">Editar</button>
          <button onclick="eliminarDocumento('clientes','${docu.id}')">Eliminar</button>
        </td>
      </tr>
    `;
  });
}

export async function cargarInventario() {
  const tabla = document.getElementById('tablaInventario');
  if (!tabla) return;
  tabla.innerHTML = '';
  const querySnapshot = await getDocs(collection(db, 'inventario'));
  querySnapshot.forEach(docu => {
    const data = docu.data();
    tabla.innerHTML += `
      <tr>
        <td>${data.nombre}</td>
        <td>${data.cantidad}</td>
        <td>${data.alerta ? 'Sí' : 'No'}</td>
        <td>
          <button onclick="editarDocumento('inventario','${docu.id}')">Editar</button>
          <button onclick="eliminarDocumento('inventario','${docu.id}')">Eliminar</button>
        </td>
      </tr>
    `;
  });
}

export async function cargarAgenda() {
  const tabla = document.getElementById('tablaAgenda');
  if (!tabla) return;
  tabla.innerHTML = '';
  const querySnapshot = await getDocs(collection(db, 'citas'));
  querySnapshot.forEach(docu => {
    const data = docu.data();
    tabla.innerHTML += `
      <tr>
        <td>${data.nombre} ${data.apellido1} ${data.apellido2 || ''}</td>
        <td>${data.servicio}</td>
        <td>${data.fecha}</td>
        <td>${data.hora}</td>
        <td>${data.estado}</td>
        <td>
          <button onclick="editarDocumento('citas','${docu.id}')">Editar</button>
          <button onclick="eliminarDocumento('citas','${docu.id}')">Eliminar</button>
        </td>
      </tr>
    `;
  });
}

export async function cargarBloqueos() {
  const tabla = document.getElementById('tablaBloqueos');
  if (!tabla) return;
  tabla.innerHTML = '';
  const querySnapshot = await getDocs(collection(db, 'bloqueos'));
  querySnapshot.forEach(docu => {
    const data = docu.data();
    tabla.innerHTML += `
      <tr>
        <td>${data.fecha}</td>
        <td>${data.horaInicio || '-'}</td>
        <td>${data.horaFin || '-'}</td>
        <td>${data.tipo}</td>
        <td>
          <button onclick="editarDocumento('bloqueos','${docu.id}')">Editar</button>
          <button onclick="eliminarDocumento('bloqueos','${docu.id}')">Eliminar</button>
        </td>
      </tr>
    `;
  });
}

// ===================
// FUNCIONES DE AGREGAR NUEVOS REGISTROS
// ===================
document.addEventListener('DOMContentLoaded', () => {

  // Servicios
  const formServicio = document.getElementById('formNuevoServicio');
  if(formServicio){
    formServicio.addEventListener('submit', async e=>{
      e.preventDefault();
      const nombre = document.getElementById('nuevoServicioNombre').value.trim();
      const duracion = parseInt(document.getElementById('nuevoServicioDuracion').value);
      const precio = parseFloat(document.getElementById('nuevoServicioPrecio').value);
      const simultaneo = document.getElementById('nuevoServicioSimultaneo').checked;
      await addDoc(collection(db,'servicios'),{nombre,duracion,precio,simultaneo});
      formServicio.reset();
      cargarServicios();
    });
  }

  // Clientes
  const formCliente = document.getElementById('formNuevoCliente');
  if(formCliente){
    formCliente.addEventListener('submit', async e=>{
      e.preventDefault();
      const nombre = document.getElementById('nuevoClienteNombre').value.trim();
      const apellido1 = document.getElementById('nuevoClienteApellido1').value.trim();
      const apellido2 = document.getElementById('nuevoClienteApellido2').value.trim();
      const correo = document.getElementById('nuevoClienteCorreo').value.trim();
      const telefono = document.getElementById('nuevoClienteTelefono').value.trim();
      await addDoc(collection(db,'clientes'),{nombre,apellido1,apellido2,correo,telefono,historial:[]});
      formCliente.reset();
      cargarContactos();
    });
  }

  // Inventario
  const formProducto = document.getElementById('formNuevoProducto');
  if(formProducto){
    formProducto.addEventListener('submit', async e=>{
      e.preventDefault();
      const nombre = document.getElementById('nuevoProductoNombre').value.trim();
      const cantidad = parseInt(document.getElementById('nuevoProductoCantidad').value);
      const alerta = document.getElementById('nuevoProductoAlerta').checked;
      await addDoc(collection(db,'inventario'),{nombre,cantidad,alerta});
      formProducto.reset();
      cargarInventario();
    });
  }

  // Citas (Agenda)
  const formCita = document.getElementById('formNuevaCita');
  if(formCita){
    formCita.addEventListener('submit', async e=>{
      e.preventDefault();
      const nombre = document.getElementById('citaNombre').value.trim();
      const apellido1 = document.getElementById('citaApellido1').value.trim();
      const apellido2 = document.getElementById('citaApellido2').value.trim();
      const servicio = document.getElementById('citaServicio').value;
      const fecha = document.getElementById('citaFecha').value;
      const hora = document.getElementById('citaHora').value;
      await addDoc(collection(db,'citas'),{nombre,apellido1,apellido2,servicio,fecha,hora,estado:'Pendiente'});
      formCita.reset();
      cargarAgenda();
    });
  }

  // Bloqueos
  const formBloqueo = document.getElementById('formBloqueo');
  if(formBloqueo){
    formBloqueo.addEventListener('submit', async e=>{
      e.preventDefault();
      const fecha = document.getElementById('bloqueoFecha').value;
      const horaInicio = document.getElementById('bloqueoHoraInicio').value || null;
      const horaFin = document.getElementById('bloqueoHoraFin').value || null;
      const tipo = document.getElementById('tipoBloqueo').value;
      await addDoc(collection(db,'bloqueos'),{fecha,horaInicio,horaFin,tipo});
      formBloqueo.reset();
      cargarBloqueos();
    });
  }

  // Configuración
  const formConfig = document.getElementById('formConfiguracion');
  if(formConfig){
    formConfig.addEventListener('submit', async e=>{
      e.preventDefault();
      const apertura = document.getElementById('horaApertura').value;
      const cierre = document.getElementById('horaCierre').value;
      const intervalo = parseInt(document.getElementById('intervaloCitas').value);
      const maxCitas = parseInt(document.getElementById('maxCitas').value);
      const configRef = doc(db,'configuracion','agenda');
      await updateDoc(configRef,{apertura,cierre,intervalo,maxCitas}).catch(async()=>{
        await setDoc(configRef,{apertura,cierre,intervalo,maxCitas});
      });
      alert('Configuración guardada');
    });
  }

});

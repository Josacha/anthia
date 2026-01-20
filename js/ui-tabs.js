// js/ui-tabs.js
const tabs = document.querySelectorAll('.sidebar li');
const mainContent = document.getElementById('main-content');

// Función para cargar una vista HTML en mainContent
async function cargarVista(tabName) {
  try {
    const response = await fetch(`views/${tabName}.html`);
    const html = await response.text();
    const temp = document.createElement('div');
temp.innerHTML = html;

const tpl = temp.querySelector('template');

mainContent.innerHTML = '';
mainContent.appendChild(tpl.content.cloneNode(true));


    // Ejecutar JS específico de cada vista
    switch(tabName) {
      case 'agenda':
        import('../js/agenda.js').then(module => module.initAgenda());
        break;
      case 'contactos':
        import('../js/contactos.js').then(module => module.initContactos());
        break;
      case 'servicios':
        import('../js/servicios.js').then(module => module.initServicios());
        break;
      case 'inventario':
        import('../js/inventario.js').then(module => module.initInventario());
        break;
      case 'bloqueos':
        import('../js/bloqueos.js').then(module => module.initBloqueos());
        break;
      case 'configuracion':
        import('../js/configuracion.js').then(module => module.initConfiguracion());
        break;
    }

  } catch(err) {
    mainContent.innerHTML = `<p style="color:red;">Error al cargar la vista ${tabName}</p>`;
    console.error(err);
  }
}

// Activar la primera vista al cargar
cargarVista('agenda');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    cargarVista(tab.dataset.tab);
  });
});

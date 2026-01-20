const tabs = document.querySelectorAll('.sidebar li');
const mainContent = document.getElementById('main-content');

// Cargar una vista HTML dentro del main
async function cargarVista(tabName) {
  try {
    const response = await fetch(`views/${tabName}.html`);
    const html = await response.text();

    // Inyectar HTML
    mainContent.innerHTML = html;

    // Ejecutar JS específico
    switch (tabName) {
      case 'agenda':
        import('../js/agenda.js')
          .then(m => m.initAgenda());
        break;

      case 'contactos':
        import('../js/contactos.js')
          .then(m => m.initContactos());
        break;

      case 'servicios':
        import('../js/servicios.js')
          .then(m => m.initServicios());
        break;

      case 'inventario':
        import('../js/inventario.js')
          .then(m => m.initInventario());
        break;

      case 'bloqueos':
        import('../js/bloqueos.js')
          .then(m => m.initBloqueos());
        break;

      case 'configuracion':
        import('../js/configuracion.js')
          .then(m => m.initConfiguracion());
        break;
    }

  } catch (err) {
    console.error(err);
    mainContent.innerHTML = `
      <p style="color:red;">
        Error al cargar la vista ${tabName}
      </p>
    `;
  }
}

// Vista inicial
cargarVista('agenda');

// Click en tabs
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    cargarVista(tab.dataset.tab);
  });
});

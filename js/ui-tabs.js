const tabs = document.querySelectorAll('.sidebar li');
const mainContent = document.getElementById('main-content');

async function cargarVista(tabName) {
  try {
    const response = await fetch(`views/${tabName}.html`);
    const html = await response.text();
    mainContent.innerHTML = html;

    // Ejecutar JS específico
    switch(tabName) {
      case 'agenda': import('./agenda.js'); break;
      case 'contactos': import('./contactos.js'); break;
      case 'servicios': import('./servicios.js'); break;
      case 'inventario': import('./inventario.js'); break;
      case 'bloqueos': import('./bloqueos.js'); break;
      case 'configuracion': import('./configuracion.js'); break;
    }
  } catch(err) {
    mainContent.innerHTML = `<p>Error al cargar la vista ${tabName}</p>`;
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

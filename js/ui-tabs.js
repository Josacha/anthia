const tabs = document.querySelectorAll('.sidebar li');
const mainContent = document.getElementById('main-content');

tabs.forEach(tab => {
  tab.addEventListener('click', async () => {
    // Resaltar pestaña activa
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Cargar vista correspondiente
    const tabName = tab.dataset.tab;
    try {
      const response = await fetch(`views/${tabName}.html`);
      const html = await response.text();
      mainContent.innerHTML = html;

      // Ejecutar el JS correspondiente a esa vista
      switch(tabName) {
        case 'agenda':
          import('./agenda.js');
          break;
        case 'contactos':
          import('./contactos.js');
          break;
        case 'servicios':
          import('./servicios.js');
          break;
        case 'inventario':
          import('./inventario.js');
          break;
        case 'bloqueos':
          import('./bloqueos.js');
          break;
        case 'configuracion':
          import('./configuracion.js');
          break;
      }
    } catch (err) {
      console.error(`Error al cargar ${tabName}.html:`, err);
    }
  });
});

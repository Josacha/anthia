// Tabs internas
const tabs = document.querySelectorAll('.sidebar li');
const contents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', async () => {
    // Quitar active de todos los tabs
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Ocultar todos los contenidos
    contents.forEach(c => c.classList.remove('active'));

    // Mostrar el contenido correspondiente
    const tabName = tab.dataset.tab;
    const tabContent = document.getElementById(`tab-${tabName}`);
    tabContent.classList.add('active');

    // Importar JS correspondiente a la vista
    try {
      switch(tabName) {
        case 'agenda':
          await import('./agenda.js');
          break;
        case 'contactos':
          await import('./contactos.js');
          break;
        case 'servicios':
          await import('./servicios.js');
          break;
        case 'inventario':
          await import('./inventario.js');
          break;
        case 'bloqueos':
          await import('./bloqueos.js');
          break;
        case 'configuracion':
          await import('./configuracion.js');
          break;
      }
    } catch(err) {
      console.error(`Error al cargar la vista ${tabName}:`, err);
    }
  });
});

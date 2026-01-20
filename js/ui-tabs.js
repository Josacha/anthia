// Cambiar vistas en el dashboard
const tabs = document.querySelectorAll('.sidebar a');
const mainContent = document.getElementById('main-content');

tabs.forEach(tab => {
  tab.addEventListener('click', async (e) => {
    e.preventDefault();
    const tabName = tab.dataset.tab;
    const response = await fetch(`../views/${tabName}.html`);
    const html = await response.text();
    mainContent.innerHTML = html;

    // Después de cargar la vista, ejecutamos la lógica de Firebase
    import('./admin-firebase.js');
  });
});

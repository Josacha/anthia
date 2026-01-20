// Tabs internas
const tabs = document.querySelectorAll('.sidebar li');
const contents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // Quitar active de todos los tabs
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Mostrar solo el tab correspondiente
    contents.forEach(c => c.classList.remove('active'));
    const tabName = tab.dataset.tab;
    document.getElementById(`tab-${tabName}`).classList.add('active');
  });
});

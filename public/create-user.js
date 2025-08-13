// public/create-user.js
const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  // 1) Tema
  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
  }

  // 2) Cache de elementos
  const form      = document.getElementById('create-user-form');
  const title     = document.getElementById('form-title');
  const idField   = document.getElementById('user-id');
  const btnCreate = document.getElementById('btn-create');
  const btnDelete = document.getElementById('delete-btn');
  const feedback  = document.getElementById('feedback');

  // garante que delete comece oculto
  btnDelete.style.display = 'none';

  // 3) Edição
  ipcRenderer.on('load-user', (_evt, user) => {
    if (user && user.id) {
      document.body.classList.add('edit-mode');
      title.textContent       = 'Editar Usuário';
      btnCreate.textContent   = 'Salvar';
      idField.value           = user.id;
      form.username.value     = user.username;
      form.password.value     = '';
      btnDelete.style.display = 'inline-block';
    }
  });

  // 4) Previne qualquer submit nativo
  form.addEventListener('submit', e => e.preventDefault());

  // 5) Criação / Atualização
  btnCreate.addEventListener('click', e => {
    e.preventDefault();

    // evita múltiplos cliques antes de fechar
    if (btnCreate.disabled) return;
    btnCreate.disabled = true;

    const data = {
      id:       idField.value || null,
      username: form.username.value.trim(),
      password: form.password.value
    };

    const channel = data.id ? 'update-user' : 'create-user';
    ipcRenderer.send(channel, data);
  });

  // 6) Exclusão
  btnDelete.addEventListener('click', () => {
    if (!idField.value) return;
    if (confirm('Deseja realmente excluir este usuário?')) {
      ipcRenderer.send('delete-user', { id: idField.value });
    }
  });

  // 7) Feedback visual
  function showFeedback({ success, message }) {
    feedback.textContent = message;
    feedback.style.color = success ? 'green' : 'red';

    if (success) {
      setTimeout(() => window.close(), 800);
    } else {
      // reabilita botão para tentar de novo
      btnCreate.disabled = false;
    }
  }

  ipcRenderer.on('create-user-reply',  (_e, resp) => showFeedback(resp));
  ipcRenderer.on('update-user-reply',  (_e, resp) => showFeedback(resp));
  ipcRenderer.on('delete-user-reply',  (_e, resp) => showFeedback(resp));
});
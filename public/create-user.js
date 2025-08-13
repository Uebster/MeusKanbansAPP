// public/create-user.js

const { send, on } = window.electronAPI;

document.addEventListener('DOMContentLoaded', () => {
  // 1) Aplica tema
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

  // Começa com o botão de delete oculto
  btnDelete.style.display = 'none';

  // 3) Preenche formulário para edição
  on('load-user', user => {
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

  // 4) Impede submit nativo
  form.addEventListener('submit', e => e.preventDefault());

  // 5) Cria ou atualiza usuário
  btnCreate.addEventListener('click', e => {
    e.preventDefault();
    if (btnCreate.disabled) return;

    btnCreate.disabled = true;
    const rawId = idField.value.trim();
    const data = {
      id:       rawId ? Number(rawId) : null,
      username: form.username.value.trim(),
      password: form.password.value
    };
    const channel = data.id ? 'update-user' : 'create-user';
    send(channel, data);
  });

  // 6) Exclui usuário
  btnDelete.addEventListener('click', () => {
    const rawId = idField.value.trim();
    if (!rawId) return;
    if (confirm('Deseja realmente excluir este usuário?')) {
      send('delete-user', { id: Number(rawId) });
    }
  });

  // 7) Feedback visual
  function showFeedback({ success, message }) {
    feedback.textContent = message;
    feedback.style.color = success ? 'green' : 'red';

    if (success) {
      setTimeout(() => window.close(), 800);
    } else {
      btnCreate.disabled = false;
    }
  }

  on('create-user-reply', showFeedback);
  on('update-user-reply', showFeedback);
  on('delete-user-reply', showFeedback);
});
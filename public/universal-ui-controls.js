;(function() {
// 👇 ADICIONAR ISSO UMA ÚNICA VEZ NO TOPO
const isFormField = el =>
  !!el && (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ||
    el.isContentEditable
  );

const hasActiveModal = () =>
  !!(document.querySelector('dialog[open]') ||
     document.querySelector('.modal.is-open, [data-modal-open="true"]'));

  // Helpers (primeiro bloco)
  const getOpenDialog = () => document.querySelector('dialog[open]');
  const getCreateModal = () => document.getElementById('create-user-modal');
  const getOpenMenu = () =>
    document.querySelector(
      '#user-menu:not(.hidden), .column-menu:not(.hidden), .card-menu:not(.hidden)'
    );

  // 1) Tecla Enter → aciona CONFIRMAR
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== 'Escape') return;

  // Só ignorar digitação se NÃO houver modal ativo
  if (!hasActiveModal() && isFormField(e.target)) return;

    if (e.key !== 'Enter') return;

    // 1.1) Diálogo <dialog>
    const dialog = getOpenDialog();
    if (dialog) {
      e.preventDefault();
      const saveBtn =
        dialog.querySelector('button[id$="-save-btn"]') ||
        dialog.querySelector('button[type="submit"]');
      if (saveBtn) saveBtn.click();
      return;
    }

    // 1.2) Modal de criar/editar usuário
    const createModal = getCreateModal();
    if (createModal && createModal.contains(document.activeElement)) {
      e.preventDefault();
      const createBtn = document.getElementById('btn-create');
      if (createBtn) createBtn.click();
      return;
    }

    // 1.3) Tela de listagem (Login)
    const confirmUser = document.getElementById('confirm-user');
    if (confirmUser && !confirmUser.disabled) {
      e.preventDefault();
      confirmUser.click();
    }
  });

  // 2) Tecla Escape → aciona CANCELAR
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== 'Escape') return;

  // Só ignorar digitação se NÃO houver modal ativo
  if (!hasActiveModal() && isFormField(e.target)) return;


    // 2.1) Diálogo <dialog>
    const dialog = getOpenDialog();
    if (dialog) {
      e.preventDefault();
      const cancelBtn = dialog.querySelector('button[id$="-cancel-btn"]');
      if (cancelBtn) cancelBtn.click();
      else dialog.close();
      return;
    }

    // 2.2) Modal criar/editar usuário
    const createModal = getCreateModal();
    if (createModal) {
      e.preventDefault();
      const cancelBtn = document.getElementById('cancel-btn');
      if (cancelBtn) cancelBtn.click();
      return;
    }

    // 2.3) Qualquer menu suspenso
    const menu = getOpenMenu();
    if (menu) {
      e.preventDefault();
      menu.classList.add('hidden');
    }
  });

  // 3) Botão direito → também CANCELA
  document.addEventListener('contextmenu', e => {
    // 3.1) Dentro de <dialog>
    const dialog = getOpenDialog();
    if (dialog && dialog.contains(e.target)) {
      e.preventDefault();
      const cancelBtn = dialog.querySelector('button[id$="-cancel-btn"]');
      if (cancelBtn) cancelBtn.click();
      else dialog.close();
      return;
    }

    // 3.2) Dentro de modal criar/editar usuário
    const createModal = getCreateModal();
    if (createModal && createModal.contains(e.target)) {
      e.preventDefault();
      const cancelBtn = document.getElementById('cancel-btn');
      if (cancelBtn) cancelBtn.click();
      return;
    }

    // 3.3) Em qualquer menu ativo → fecha sem ação
    const menu = getOpenMenu();
    if (menu) {
      e.preventDefault();
      menu.classList.add('hidden');
    }
  });

  // 4) Clique fora → fecha menus e diálogos
  document.addEventListener('mousedown', e => {
    // 4.1) Dialog <dialog>
    const dialog = getOpenDialog();
    if (dialog && !dialog.contains(e.target)) {
      const cancelBtn = dialog.querySelector('button[id$="-cancel-btn"]');
      if (cancelBtn) cancelBtn.click();
      else dialog.close();
      return;
    }

    // 4.2) Modal criar/editar usuário
    const createModal = getCreateModal();
    if (createModal && !createModal.contains(e.target)) {
      const cancelBtn = document.getElementById('cancel-btn');
      if (cancelBtn) cancelBtn.click();
      return;
    }

    // 4.3) Menus de contexto
    const menu = getOpenMenu();
    if (
      menu &&
      !menu.contains(e.target) &&
      !e.target.closest('#sidebar-user-name')
    ) {
      menu.classList.add('hidden');
    }
  });
})();

// universal-ui-controls.js (segundo bloco original, preservado e corrigido)
;(function() {
  document.addEventListener('DOMContentLoaded', () => {
    // Cache dos modais customizados (podem não existir em algumas telas)
    const loginModal       = document.getElementById('login-modal') || null;
    const deleteModal      = document.getElementById('delete-modal') || null;
    const loginConfirmBtn  = document.getElementById('confirm-login') || null;
    const loginCancelBtn   = document.getElementById('cancel-login') || null;
    const deleteConfirmBtn = document.getElementById('confirm-delete') || null;
    const deleteCancelBtn  = document.getElementById('cancel-delete') || null;

// Helpers
const getOpenDialog = () => {
  const dialogs = Array.from(document.querySelectorAll('dialog'));
  return dialogs.find(d => d.open === true) || null;
};
const getCreateModal = () => document.getElementById('create-user-modal');
const isFormField = el =>
  !!el && (
    ['INPUT','TEXTAREA','SELECT'].includes(el.tagName) || el.isContentEditable
  );
const isFlexVisible = el =>
  !!el && getComputedStyle(el).display === 'flex';
const getOpenMenu = () =>
  document.querySelector(
    '#user-menu:not(.hidden), .column-menu:not(.hidden), .card-menu:not(.hidden)'
  );

// 1) ENTER/ESC → CONFIRMAR/CANCELAR (ordem de prioridade: dialog > login > delete > create-user > list-users)
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== 'Escape') return;

  const dialog     = getOpenDialog();
  const loginOpen  = isFlexVisible(loginModal);
  const deleteOpen = isFlexVisible(deleteModal);

  // Se não há modal/dialog aberto, não intercepta campos de formulário
  if (!dialog && !loginOpen && !deleteOpen) {
    if (isFormField(e.target)) return;
  }

  // 1.1) Dialog <dialog> nativo
  if (dialog) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const saveBtn =
        dialog.querySelector('button[id$="-save-btn"]') ||
        dialog.querySelector('button[type="submit"]');
      saveBtn?.click();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      const cancelBtn = dialog.querySelector('button[id$="-cancel-btn"]');
      cancelBtn ? cancelBtn.click() : dialog.close();
      return;
    }
  }

  // daqui pra baixo continuam os casos loginModal, deleteModal, etc...

      // Login Modal aberto?
      if (loginModal && getComputedStyle(loginModal).display === 'flex') {
        if (e.key === 'Enter') { e.preventDefault(); loginConfirmBtn?.click(); return; }
        if (e.key === 'Escape') { e.preventDefault(); loginCancelBtn?.click();  return; }
      }

      // Delete Modal aberto?
      if (deleteModal && getComputedStyle(deleteModal).display === 'flex') {
        if (e.key === 'Enter') { e.preventDefault(); deleteConfirmBtn?.click(); return; }
        if (e.key === 'Escape') { e.preventDefault(); deleteCancelBtn?.click();  return; }
      }

      // Create-user
      const createModal = getCreateModal();
      if (createModal && createModal.contains(document.activeElement)) {
        if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btn-create')?.click(); return; }
        if (e.key === 'Escape') { e.preventDefault(); document.getElementById('cancel-btn')?.click(); return; }
        if (isFormField(e.target)) return;
      }

      // Tela de list-users (botão “Login”), só se não houver login modal aberto
      const confirmUser = document.getElementById('confirm-user');
      if (
        e.key === 'Enter' &&
        confirmUser &&
        !confirmUser.disabled &&
        !(loginModal && getComputedStyle(loginModal).display === 'flex')
      ) {
        e.preventDefault();
        confirmUser.click();
      }
    });

    // 2) CLICK DIREITO
    document.addEventListener('contextmenu', e => {
      // Login Modal
      if (loginModal && getComputedStyle(loginModal).display === 'flex' && loginModal.contains(e.target)) {
        e.preventDefault(); loginCancelBtn?.click(); return;
      }

      // Delete Modal
      if (deleteModal && getComputedStyle(deleteModal).display === 'flex' && deleteModal.contains(e.target)) {
        e.preventDefault(); deleteCancelBtn?.click(); return;
      }

      // Dialog nativo
      const dialog = getOpenDialog();
      if (dialog && dialog.contains(e.target)) {
        e.preventDefault();
        const cancelBtn = dialog.querySelector('button[id$="-cancel-btn"]');
        cancelBtn ? cancelBtn.click() : dialog.close();
        return;
      }

      // Create-user
      const createModal = getCreateModal();
      if (createModal && createModal.contains(e.target)) {
        e.preventDefault();
        document.getElementById('cancel-btn')?.click();
        return;
      }

      // Menu suspenso
      const menu = getOpenMenu();
      if (menu && menu.contains(e.target)) {
        e.preventDefault();
        menu.classList.add('hidden');
      }
    });

    // 3) CLIQUE FORA
    document.addEventListener('mousedown', e => {
      // Login Modal
      if (loginModal && getComputedStyle(loginModal).display === 'flex' && !e.target.closest('.modal-box')) {
        loginCancelBtn?.click(); return;
      }

      // Delete Modal
      if (deleteModal && getComputedStyle(deleteModal).display === 'flex' && !e.target.closest('.modal-box')) {
        deleteCancelBtn?.click(); return;
      }

      // Dialog nativo
      const dialog = getOpenDialog();
      if (dialog && !dialog.contains(e.target)) {
        const cancelBtn = dialog.querySelector('button[id$="-cancel-btn"]');
        cancelBtn ? cancelBtn.click() : dialog.close();
        return;
      }

      // Create-user
      const createModal = getCreateModal();
      if (createModal && !createModal.contains(e.target)) {
        document.getElementById('cancel-btn')?.click();
        return;
      }

      // Menus de contexto
      const menu = getOpenMenu();
      if (menu && !menu.contains(e.target) && !e.target.closest('#sidebar-user-name')) {
        menu.classList.add('hidden');
      }
    });
  });
})();
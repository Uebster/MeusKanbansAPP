// public/list-users.js
const { ipcRenderer } = require('electron');
const MASTER_PASSWORD = "87654"; // ← ajuste para a sua senha master

// ===== MODAL DE LOGIN =====
const loginModal = document.createElement("div");
loginModal.id = "login-modal";
Object.assign(loginModal.style, {
  display:         "none",          // só aparece quando usarmos loginModal.style.display = 'flex'
  position:        "fixed",
  top:             "0",
  left:            "0",
  right:           "0",
  bottom:          "0",
  alignItems:      "center",
  justifyContent:  "center",
  backgroundColor: "transparent",
  zIndex:          "1000",
});
loginModal.innerHTML = `
  <div class="modal-box">
    <p>Digite sua senha para entrar:</p>
    <input id="login-password" type="password" />
    <div>
      <button id="confirm-login">Login</button>
      <button id="cancel-login">Cancelar</button>
    </div>
    <p id="login-feedback" style="color:red; margin-top:0.5rem;"></p>
  </div>`;
document.body.appendChild(loginModal);

// ===== MODAL DE EXCLUSÃO =====
const deleteModal = document.createElement("div");
deleteModal.id = "delete-modal";
Object.assign(deleteModal.style, {
  display:         "none",
  position:        "fixed",
  top:             "0",
  left:            "0",
  right:           "0",
  bottom:          "0",
  alignItems:      "center",
  justifyContent:  "center",
  backgroundColor: "transparent",
  zIndex:          "1000",
});
deleteModal.innerHTML = `
  <div class="modal-box">
    <p>Deseja realmente excluir este usuário?<br/>Digite a senha para confirmar:</p>
    <input id="delete-password" type="password" />
    <div>
      <button id="confirm-delete">Confirmar</button>
      <button id="cancel-delete">Cancelar</button>
    </div>
    <p id="delete-feedback" style="color:red; margin-top:0.5rem;"></p>
  </div>`;
document.body.appendChild(deleteModal);

document.addEventListener("DOMContentLoaded", () => {
  // cache elementos dos modais
  const inputLogin     = document.getElementById("login-password");
  const btnConfirmLogin = document.getElementById("confirm-login");
  const btnCancelLogin  = document.getElementById("cancel-login");
  const loginFeedback   = document.getElementById("login-feedback");

  const inputDelete    = document.getElementById("delete-password");
  const btnConfirmDel  = document.getElementById("confirm-delete");
  const btnCancelDel   = document.getElementById("cancel-delete");
  const deleteFeedback = document.getElementById("delete-feedback");

  let selectedUserId   = null;
  let userToDeleteId   = null;
  let userToEditId     = null;

  // FECHAR / CANCELAR modais
  btnCancelLogin.addEventListener("click", () => {
    loginModal.style.display = "none";
    inputLogin.value = "";
    loginFeedback.textContent = "";
  });
  btnCancelDel.addEventListener("click", () => {
    deleteModal.style.display = "none";
    inputDelete.value = "";
    deleteFeedback.textContent = "";
  });

  // CONFIRMAR LOGIN
btnConfirmLogin.addEventListener("click", async () => {
  const pwd = inputLogin.value.trim();
  if (!pwd) {
    loginFeedback.textContent = "Digite a senha.";
    return;
  }
  try {
    // escolhe o ID certo conforme o modo
    const idToCheck = loginModal.dataset.mode === "edit"
      ? userToEditId
      : selectedUserId;

    const user = await ipcRenderer.invoke("get-user", idToCheck);

    // permite também usar MASTER_PASSWORD para override
    if (pwd === user.password || pwd === MASTER_PASSWORD) {
      loginModal.style.display = "none";
      inputLogin.value = "";
      loginFeedback.textContent = "";

      if (loginModal.dataset.mode === "edit") {
        // abre a janela de edição
        ipcRenderer.send("open-create-user", { id: userToEditId });
        userToEditId = null;
      } else {
        // fluxo normal de login para Kanban
        ipcRenderer.send("user-selected", selectedUserId);
      }
      loginModal.dataset.mode = "";
    } else {
      loginFeedback.textContent = "Senha incorreta. Tente novamente.";
      inputLogin.value = "";
    }
  } catch (err) {
    loginFeedback.textContent = "Erro ao validar usuário.";
    console.error(err);
  }
});

  // CONFIRMAR EXCLUSÃO
  btnConfirmDel.addEventListener("click", async () => {
    const pwd = inputDelete.value.trim();
    if (!pwd) {
      deleteFeedback.textContent = "Digite a senha.";
      return;
    }
    try {
      const user = await ipcRenderer.invoke("get-user", userToDeleteId);
      if (pwd === user.password || pwd === MASTER_PASSWORD) {
        ipcRenderer.send("delete-user", { id: userToDeleteId });
        deleteModal.style.display = "none";
        inputDelete.value = "";
      } else {
        deleteFeedback.textContent = "Senha incorreta. Tente novamente.";
        inputDelete.value = "";
      }
    } catch (err) {
      deleteFeedback.textContent = "Erro ao validar senha.";
      console.error(err);
    }
  });

  // ELEMENTOS PRINCIPAIS
  const btnNewUser  = document.getElementById("btn-new-user");
  const tableBody   = document.querySelector("#users-table tbody");
  const feedback    = document.getElementById("feedback");
  const toggleBtn   = document.getElementById("toggleTheme");
  const confirmBtn  = document.getElementById("confirm-user");

  // Aplica tema salvo
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-mode");
  }
  toggleBtn.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-mode");
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });

  // Função para limpar seleção
  const resetSelection = () => {
    const sel = tableBody.querySelector("tr.selected");
    if (sel) sel.classList.remove("selected");
    selectedUserId = null;
    confirmBtn.disabled = true;
  };

  // Reset ao clicar fora
  document.addEventListener("click", e => {
    const ignore = e.target.closest("#users-table")
                || e.target.closest("#login-modal .modal-box")
                || e.target.closest("#delete-modal .modal-box")
                || e.target.closest("#confirm-user");
    if (!ignore) resetSelection();
  });
  document.addEventListener("contextmenu", e => {
    const ignore = e.target.closest("#users-table")
                || e.target.closest("#login-modal .modal-box")
                || e.target.closest("#delete-modal .modal-box")
                || e.target.closest("#confirm-user");
    if (!ignore) resetSelection();
  });

  // Carrega usuários
  ipcRenderer.send("get-all-users");
  ipcRenderer.on("get-all-users-reply", (_e, users) => {
    tableBody.innerHTML = "";
    resetSelection();

    if (!users || users.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 3;
      td.textContent = "Nenhum usuário cadastrado.";
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    users.forEach(user => {
      const tr = document.createElement("tr");

      // ID
      const tdId = document.createElement("td");
      tdId.textContent = user.id;
      tr.appendChild(tdId);

      // Usuário (seleção)
      const tdUser = document.createElement("td");
      tdUser.textContent = user.username;
      tdUser.style.cursor = "pointer";
      tdUser.addEventListener("click", () => {
        const prev = tableBody.querySelector("tr.selected");
        if (prev) prev.classList.remove("selected");
        tr.classList.add("selected");
        selectedUserId = user.id;
        confirmBtn.disabled = false;
      });
      tr.appendChild(tdUser);

      // Ações (✏️ 🗑️)
      const tdActions = document.createElement("td");
      const btnEdit   = document.createElement("button");
      const btnDelete = document.createElement("button");

      btnEdit.textContent = "Editar";
      btnEdit.classList.add("action-button");
btnEdit.addEventListener("click", () => {
  // agenda a edição e requer senha antes de abrir
  userToEditId = user.id;
  loginModal.dataset.mode   = "edit";
  loginFeedback.textContent = "";
  loginModal.style.display  = "flex";
  inputLogin.focus();
});

      btnDelete.textContent = "Excluir";
      btnDelete.classList.add("action-button");
      btnDelete.addEventListener("click", () => {
        userToDeleteId = user.id;
        deleteModal.style.display = "flex";
        inputDelete.focus();
      });

      tdActions.append(btnEdit, btnDelete);
      tr.appendChild(tdActions);
      tableBody.appendChild(tr);
    });
  });

  // Novo usuário
  btnNewUser.addEventListener("click", () => {
    ipcRenderer.send("open-create-user", { id: null });
  });

  // Abre modal de login
  confirmBtn.addEventListener("click", () => {
    if (!selectedUserId) {
      feedback.textContent = "Selecione um usuário.";
      setTimeout(() => (feedback.textContent = ""), 2000);
      return;
    }
    loginModal.style.display = "flex";
    inputLogin.focus();
  });

  // Feedback de CRUD
  function showFeedback({ success, message }) {
    feedback.textContent = message;
    feedback.style.color = success ? "green" : "red";
    if (success) {
      setTimeout(() => {
        ipcRenderer.send("get-all-users");
        feedback.textContent = "";
      }, 500);
    }
  }
  ipcRenderer.on("create-user-reply",  (_e, resp) => showFeedback(resp));
  ipcRenderer.on("update-user-reply",  (_e, resp) => showFeedback(resp));
  ipcRenderer.on("delete-user-reply",  (_e, resp) => showFeedback(resp));
});
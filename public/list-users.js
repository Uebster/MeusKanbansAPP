// public/list-users.js

const { send, on, invoke } = window.electronAPI;
const MASTER_PASSWORD = "87654"; // ajuste para a sua senha master

// ===== MODAL DE LOGIN =====
const loginModal = document.createElement("div");
loginModal.id = "login-modal";
Object.assign(loginModal.style, {
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
  // Cache modais
  const inputLogin      = document.getElementById("login-password");
  const btnConfirmLogin = document.getElementById("confirm-login");
  const btnCancelLogin  = document.getElementById("cancel-login");
  const loginFeedback   = document.getElementById("login-feedback");

  const inputDelete     = document.getElementById("delete-password");
  const btnConfirmDel   = document.getElementById("confirm-delete");
  const btnCancelDel    = document.getElementById("cancel-delete");
  const deleteFeedback  = document.getElementById("delete-feedback");

  let selectedUserId = null;
  let userToDeleteId = null;
  let userToEditId   = null;
  let loginEmAndamento = false;

  // Fechar / cancelar modais
  btnCancelLogin.addEventListener("click", () => {
  loginModal.style.display = "none";
  inputLogin.value = "";
  loginFeedback.textContent = "";
  loginEmAndamento = false;        // ⬅️ reset
  btnConfirmLogin.disabled = false; // ⬅️ reset
});
  btnCancelDel.addEventListener("click", () => {
    deleteModal.style.display = "none";
    inputDelete.value = "";
    deleteFeedback.textContent = "";
  });

  // Confirmar LOGIN
btnConfirmLogin.addEventListener("click", async () => {
  if (loginEmAndamento) return;
  loginEmAndamento = true;
  btnConfirmLogin.disabled = true;

  const pwd = inputLogin.value.trim();
  if (!pwd) {
    loginFeedback.textContent = "Digite a senha.";
    loginEmAndamento = false;
    btnConfirmLogin.disabled = false;
    return;
  }
  try {
    const idToCheck = loginModal.dataset.mode === "edit" ? userToEditId : selectedUserId;
    const user = await invoke("get-user", idToCheck);

    if ((user && pwd === user.password) || pwd === MASTER_PASSWORD) {
      loginModal.style.display = "none";
      inputLogin.value = "";
      loginFeedback.textContent = "";
      if (loginModal.dataset.mode === "edit") {
        send("open-create-user", { id: userToEditId });
        userToEditId = null;
      } else {
        send("user-selected", selectedUserId);
      }
      loginModal.dataset.mode = "";
      // não reabilita — vamos trocar de janela
    } else {
      loginFeedback.textContent = "Senha incorreta. Tente novamente.";
      inputLogin.value = "";
      loginEmAndamento = false;
      btnConfirmLogin.disabled = false;
    }
  } catch (err) {
    loginFeedback.textContent = "Erro ao validar usuário.";
    console.error(err);
    loginEmAndamento = false;
    btnConfirmLogin.disabled = false;
  }
});

  // Confirmar EXCLUSÃO
  btnConfirmDel.addEventListener("click", async () => {
    const pwd = inputDelete.value.trim();
    if (!pwd) {
      deleteFeedback.textContent = "Digite a senha.";
      return;
    }
    try {
      const user = await invoke("get-user", userToDeleteId);
      if (pwd === user.password || pwd === MASTER_PASSWORD) {
        send("delete-user", { id: userToDeleteId });
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

  // Elementos principais
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

  // Reseta seleção
  const resetSelection = () => {
    const sel = tableBody.querySelector("tr.selected");
    if (sel) sel.classList.remove("selected");
    selectedUserId = null;
    confirmBtn.disabled = true;
  };
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

  // Carrega lista de usuários
// Carrega lista de usuários
send("get-all-users");
on("get-all-users-reply", users => {
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

      // Usuário
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

      // Ações
      const tdActions = document.createElement("td");
      const btnEdit   = document.createElement("button");
      const btnDelete = document.createElement("button");

      btnEdit.textContent = "Editar";
      btnEdit.classList.add("action-button");
      btnEdit.addEventListener("click", () => {
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
    send("open-create-user", { id: null });
  });

  // Confirma seleção
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
        send("get-all-users");
        feedback.textContent = "";
      }, 500);
    }
  }
  on("create-user-reply", showFeedback);
  on("update-user-reply", showFeedback);
  on("delete-user-reply", showFeedback);
});
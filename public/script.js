// public/script.js — COMPLETO

const { send, on, invoke } = window.electronAPI;

// Captura userId da query string
let userId = null;

// — Estado Global —
let boards        = [];
let needsBackup   = false; // controla se precisa fazer backup ao fechar
let activeBoardId = null;
let fileInput     = null;
let lastUsedCardColor   = localStorage.getItem("lastUsedCardColor")   || "#858585";
let lastUsedColumnColor = localStorage.getItem("lastUsedColumnColor") || "#ffffff";
let lastUsedTextColor   = localStorage.getItem("lastUsedTextColor")   || "#3d3d3d";

// — Histórico para desfazer —
let history = [];
function saveState() {
  try {
    const snapshot = JSON.stringify(boards);
    history.push(snapshot);
    if (history.length > 100) history.shift();
  } catch (err) {
    console.error("Erro ao salvar estado:", err);
  }
}
function undo() {
  if (!history.length) return;
  try {
    const last = history.pop();
    boards = JSON.parse(last);
    if (!boards.find(b => b.id === activeBoardId)) {
      activeBoardId = boards[0]?.id || null;
    }
    renderUI();
    saveBoards();
    showMessage("Ação desfeita com sucesso.");
  } catch (err) {
    console.error("Erro ao desfazer:", err);
    showMessage("Não foi possível desfazer.", true);
  }
}

// — Elementos de contexto (menus etc.) —
let cardMenuEl   = null;
let columnMenuEl = null;
let menuContext  = {};

// — Templates de diálogos e menus —
const tBoardDialog  = document.getElementById("board-dialog");
const tColumnDialog = document.getElementById("column-dialog");
const tCardDialog   = document.getElementById("card-dialog");
const tCardMenu     = document.getElementById("card-menu");
const tColumnMenu   = document.getElementById("column-menu");

// — Inicialização após DOM carregado —
document.addEventListener("DOMContentLoaded", async () => {
  userId = new URLSearchParams(location.search).get("userId");
  if (!userId) {
    console.error("userId não encontrado na URL");
    return;
  }

  const user = await invoke("get-user", userId);
  document.getElementById("sidebar-user-name").textContent =
    `👤 ${user?.username || ""}`;

  // input oculto pra import
  fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json";
  fileInput.hidden = true;
  fileInput.addEventListener("change", handleImport);
  document.body.appendChild(fileInput);

  // botões da sidebar
  bindSidebarButtons();

  // carregar boards do main (uma vez só)
  console.log("Enviando load-boards com userId:", userId);
  send("load-boards", userId);

  // preload passa só args, sem 'event'
  on("load-result", (loaded) => {
    console.log("Recebido do main:", loaded);
    boards = Array.isArray(loaded) ? loaded : [];
    if (!activeBoardId && boards.length) {
      activeBoardId = boards[0].id;
    }
    history = []; // limpa histórico ao carregar do disco
    renderUI();
  });

  // fechar menus ao clicar fora
  document.body.addEventListener("click", e => {
    if (cardMenuEl && !cardMenuEl.contains(e.target)) closeCardMenu();
    if (columnMenuEl && !columnMenuEl.contains(e.target)) closeColumnMenu();
  });

  // desfazer com Ctrl+Z
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    }
  });
});

// — Configuração de botões com validações e handlers —
function bindSidebarButtons() {
  // Novo quadro
  document.getElementById("add-board-btn")
    .addEventListener("click", () => openBoardDialog());

  // Nova coluna
  document.getElementById("add-column-btn")
    .addEventListener("click", () => {
      if (!boards.length) {
        return showMessage("Necessário criar quadro primeiro", true);
      }
      openColumnDialog();
    });

  // Novo cartão
  document.getElementById("add-card-btn")
    .addEventListener("click", () => {
      const board = boards.find(b => b.id === activeBoardId);
      if (!board || !board.columns.length) {
        return showMessage("Necessário criar ao menos uma coluna", true);
      }
      openCardDialog();
    });

  // Salvar alterações
  document.getElementById("save-btn")
    .addEventListener("click", () => {
      send("save-boards", boards, userId);
    });

  // Exportar JSON
  document.getElementById("export-btn")
    .addEventListener("click", exportData);

  // Importar JSON
  document.getElementById("import-btn")
    .addEventListener("click", () => fileInput.click());

  // Exportar Imagem
  document.getElementById("exportImageBtn")
    .addEventListener("click", exportImage);

  // Imprimir
  document.getElementById("print-btn")
    .addEventListener("click", printWithFooter);

  // Alternar tema
  document.getElementById("theme-toggle-btn")
    .addEventListener("click", toggleTheme);

  // Sair do app
  document.getElementById("exit-btn")
    .addEventListener("click", () => window.close());

  // Select de quadros
  document.getElementById("board-select")
    .addEventListener("change", e => {
      activeBoardId = e.target.value;
      renderUI();
    });

  // Editar quadro
  document.getElementById("edit-board-btn")
    .addEventListener("click", () => {
      if (!boards.length) return showMessage("Nenhum quadro para editar", true);
      openBoardDialog(activeBoardId);
    });

  // Excluir quadro
  document.getElementById("delete-board-btn")
    .addEventListener("click", () => {
      if (!boards.length) return showMessage("Nenhum quadro para excluir", true);
      deleteBoard(activeBoardId);
    });

  // Feedback de save
  on("save-result", (ok) => {
    showMessage(ok ? "Alterações salvas com sucesso" : "Erro ao salvar", !ok);
  });
}

// — Toast Messages —
function showMessage(text, isError = false) {
  const cont = document.getElementById("message-container");
  const div  = document.createElement("div");
  div.className   = `message${isError ? " error" : ""}`;
  div.textContent = text;
  cont.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// — Exportação JSON —
function exportData() {
  const blob = new Blob([JSON.stringify(boards, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = "kanban-boards.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// — Importação JSON —
function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error();
      boards = data;
      activeBoardId = boards[0]?.id || null;
      history = []; // novo conjunto, limpa histórico
      needsBackup = true;
      send("set-needs-backup", true);
      send("save-boards", boards, userId);
      renderUI();
    } catch {
      showMessage("JSON inválido", true);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

// — Tema persistente —
function toggleTheme() {
  const isLight = document.body.classList.toggle("light-mode");
  localStorage.setItem("theme", isLight ? "light" : "dark");
}
(function applySavedTheme() {
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-mode");
  }
})();

// — BACKUP localStorage —
function backupStore(state) {
  const key    = 'kanbanBackups';
  const stored = localStorage.getItem(key);
  const arr    = stored ? JSON.parse(stored) : [];
  arr.push(JSON.stringify(state));
  if (arr.length > 1000) arr.shift();
  localStorage.setItem(key, JSON.stringify(arr));
}

// — SALVAR com backup e notificação via IPC —
function saveBoards() {
  console.log("Salvando boards:", boards);
  if (!userId) {
    console.error("userId está indefinido");
    return;
  }
  if (!Array.isArray(boards)) {
    console.error("boards não é um array");
    return;
  }
  backupStore(boards);
  send("save-boards", boards, userId);
}

function openConfirmDialog({ title = "Confirmar ação", message = "Tem certeza?", variant = "default" } = {}) {
  return new Promise((resolve) => {
    const tpl = document.getElementById("confirm-dialog");
    const dlg = tpl.content.cloneNode(true).querySelector("dialog");

    dlg.querySelector("#confirm-title").textContent = title;
    dlg.querySelector("#confirm-message").textContent = message;

    const okBtn     = dlg.querySelector("#confirm-ok-btn");
    const cancelBtn = dlg.querySelector("#confirm-cancel-btn");

    okBtn.addEventListener("click", () => {
      dlg.close();
      dlg.remove();
      resolve(true);
    });

    cancelBtn.addEventListener("click", () => {
      dlg.close();
      dlg.remove();
      resolve(false);
    });

    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      dlg.close();
      dlg.remove();
      resolve(false);
    });

    document.body.appendChild(dlg);
    dlg.showModal();
    requestAnimationFrame(() => okBtn.focus());
  });
}

// — RENDERIZAÇÃO —
function renderUI() {
  // Fecha e remove qualquer dialog aberto (previne backdrop zumbi)
  document.querySelectorAll("dialog[open]").forEach(d => {
    try { d.close(); } catch {}
    d.remove();
  });

  renderBoardSelect();
  renderSidebarIndex();
  renderBoard();
}

function forceFocusUnlock() {
  // Fecha e remove qualquer dialog “aberto” que tenha ficado preso
  document.querySelectorAll("dialog[open]").forEach(d => {
    try { d.close(); } catch {}
    d.remove();
  });

  // Destrava ponteiro/teclado no body/app por 1 frame
  const app = document.getElementById("app");
  const prevBodyPE = document.body.style.pointerEvents;
  const prevAppPE  = app?.style.pointerEvents;
  document.body.style.pointerEvents = "auto";
  if (app) app.style.pointerEvents = "auto";

  // Pequena pausa para o layout assentar, depois força foco num alvo certo
  requestAnimationFrame(() => {
    // tenta focar o select de quadros
    const select = document.getElementById("board-select");
    if (select) {
      select.focus();
    } else {
      const addBoardBtn = document.getElementById("add-board-btn");
      addBoardBtn?.focus();
    }

    // restaura pointer-events no próximo frame (só para evitar efeitos colaterais)
    requestAnimationFrame(() => {
      document.body.style.pointerEvents = prevBodyPE || "";
      if (app) app.style.pointerEvents = prevAppPE || "";
    });
  });
}

// — Select de quadros —
function renderBoardSelect() {
  const sel = document.getElementById("board-select");
  sel.innerHTML = "";
  const ph = document.createElement("option");
  ph.value    = "";
  ph.textContent = boards.length
    ? "Selecione um quadro..."
    : "Nenhum quadro";
  ph.disabled = true;
  ph.selected = !activeBoardId;
  sel.appendChild(ph);

  boards.forEach(b => {
    const opt = document.createElement("option");
    opt.value       = b.id;
    opt.textContent = b.title;
    if (b.id === activeBoardId) opt.selected = true;
    sel.appendChild(opt);
  });
}

// — Índice lateral —
function renderSidebarIndex() {
  const ul = document.getElementById("index-list");
  ul.innerHTML = "";
  if (!boards.length) {
    const li = document.createElement("li");
    li.textContent = "Nenhum quadro criado";
    ul.appendChild(li);
    return;
  }
  boards.forEach(b => {
    const li = document.createElement("li");
    li.dataset.boardId = b.id;
    li.innerHTML = `
      <span class="idx-board-title${b.id === activeBoardId ? " active" : ""}">
        ${b.title}
      </span>
      <ul>
        ${b.columns.map(c => `<li>${c.title}</li>`).join("")}
      </ul>`;
    li.querySelector(".idx-board-title")
      .addEventListener("click", () => {
        activeBoardId = b.id;
        renderUI();
      });
    ul.appendChild(li);
  });
}

// — Monta colunas e cartões —
function renderBoard() {
  // Garantia extra: nenhum dialog modal deve estar aberto agora
  document.querySelectorAll("dialog[open]").forEach(d => {
    try { d.close(); } catch {}
    d.remove();
  });

  const container = document.getElementById("columns-container");
  container.innerHTML = "";

  const board = boards.find(b => b.id === activeBoardId);
  if (!board) {
    container.innerHTML =
      '<p class="no-results">Selecione ou crie um quadro</p>';
    return;
  }

  board.columns.forEach(col => {
    const colEl = document.createElement("div");
    colEl.className        = "column";
    colEl.dataset.columnId = col.id;
    colEl.style.background = col.color;

    colEl.innerHTML = `
      <div class="column-header"><h3>${col.title}</h3></div>
      <div class="cards-container"></div>
      <div class="column-footer">
        <button class="add-card-btn">+ Adicionar Cartão</button>
      </div>
    `;

    const hdr = colEl.querySelector(".column-header");
    hdr.draggable = true;
    hdr.addEventListener("dragstart", ev => {
      ev.dataTransfer.setData(
        "application/json",
        JSON.stringify({ columnId: col.id })
      );
    });

    hdr.addEventListener("click", ev => {
      ev.stopPropagation();
      openColumnMenu(colEl, activeBoardId, col.id);
    });

    colEl.querySelector(".add-card-btn")
      .addEventListener("click", () => openCardDialog(col.id));

    const cardsC = colEl.querySelector(".cards-container");
    col.tasks.forEach(task => {
      const card = document.createElement("div");
      card.className        = "card";
      card.dataset.cardId   = task.id;
      card.dataset.columnId = col.id;
      card.textContent      = task.title;

      if (task.color) card.style.backgroundColor = task.color;
      if (task.textColor) card.style.color = task.textColor;

      card.draggable = true;
      card.addEventListener("dragstart", ev => {
        ev.dataTransfer.setData(
          "application/json",
          JSON.stringify({
            boardId:  activeBoardId,
            columnId: col.id,
            cardId:   task.id
          })
        );
      });

      card.addEventListener("click", ev => {
        ev.stopPropagation();
        openCardMenu(card, activeBoardId, col.id, task.id);
      });

      cardsC.appendChild(card);
    });

    cardsC.addEventListener("dragover", ev => ev.preventDefault());
    cardsC.addEventListener("drop", handleCardDrop);

    container.appendChild(colEl);
  });

  const colsWrapper = document.getElementById("columns-container");
  colsWrapper.addEventListener("dragover", ev => ev.preventDefault());
  colsWrapper.addEventListener("drop", handleColumnDrop);
}

// — Drag & drop cartões —
function handleCardDrop(e) {
  e.preventDefault();
  const data = JSON.parse(e.dataTransfer.getData("application/json"));
  if (!data.cardId) return;

  const toColId = e.currentTarget.closest(".column").dataset.columnId;
  const board   = boards.find(b => b.id === data.boardId);
  const fromCol = board.columns.find(c => c.id === data.columnId);
  const toCol   = board.columns.find(c => c.id === toColId);

  const idx = fromCol.tasks.findIndex(t => t.id === data.cardId);

  saveState(); // snapshot antes de mover
  const [tsk] = fromCol.tasks.splice(idx, 1);

  // posição vertical
  const cardsElems = Array.from(e.currentTarget.children);
  let pos = toCol.tasks.length;
  for (let i = 0; i < cardsElems.length; i++) {
    const rc = cardsElems[i].getBoundingClientRect();
    if (e.clientY < rc.top + rc.height / 2) {
      pos = i;
      break;
    }
  }
  toCol.tasks.splice(pos, 0, tsk);

  saveBoards();
  renderBoard(); // só redesenha as colunas
}

// — Drag & drop colunas —
function handleColumnDrop(e) {
  e.preventDefault();
  let data;
  try {
    data = JSON.parse(e.dataTransfer.getData("application/json"));
  } catch {
    return;
  }
  if (!data.columnId || data.cardId) return;

  const board = boards.find(b => b.id === activeBoardId);
  if (!board) return;

  const cols  = board.columns;
  const fromI = cols.findIndex(c => c.id === data.columnId);
  if (fromI < 0) return;

  let toI = cols.length;
  document
    .querySelectorAll("#columns-container .column")
    .forEach((el, idx) => {
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2 && toI > idx) toI = idx;
    });
  if (toI > fromI) toI--;

  saveState(); // snapshot antes de mover coluna
  const [moved] = cols.splice(fromI, 1);
  cols.splice(toI, 0, moved);

  needsBackup = true;
  send("set-needs-backup", true);
  saveBoards();
  renderBoard(); // redesenha só as colunas
}

// — MENU de contexto de CARTÃO —
function openCardMenu(cardEl, bId, cId, tId) {
  closeCardMenu();
  closeColumnMenu();
  menuContext = { boardId: bId, columnId: cId, cardId: tId };

  const menu = tCardMenu.content.cloneNode(true).querySelector(".card-menu");
  const r = cardEl.getBoundingClientRect();
const menuHeight = 120; // ajuste conforme altura média do menu
const menuWidth  = 180; // ajuste conforme largura média do menu

let top = r.bottom + 5;
if (r.bottom + menuHeight > window.innerHeight) {
  top = r.top - menuHeight - 5;
  if (top < 0) top = 10;
}

let left = r.left;
if (r.left + menuWidth > window.innerWidth) {
  left = window.innerWidth - menuWidth - 10;
}

menu.style.top  = `${top}px`;
menu.style.left = `${left}px`;

  menu.addEventListener("click", ev => ev.stopPropagation());

  menu.querySelector("#card-edit-btn")
      .addEventListener("click", () => {
        openCardDialog(cId, tId);
        closeCardMenu();
      });

  menu.querySelector("#card-delete-btn")
  .addEventListener("click", async () => {
    const ok = await openConfirmDialog({
      title: "Excluir cartão",
      message: "Deseja mesmo excluir este cartão? Esta ação não pode ser desfeita."
    });
    if (ok) removeCurrentTask();
    closeCardMenu();
  });

  document.body.appendChild(menu);
  cardMenuEl = menu;
}
function closeCardMenu() {
  if (cardMenuEl) cardMenuEl.remove();
  cardMenuEl = null;
}

// — MENU de contexto de COLUNA —
function openColumnMenu(colEl, bId, cId) {
  closeCardMenu();
  closeColumnMenu();
  const menu = tColumnMenu.content.cloneNode(true).querySelector(".column-menu");
  const r = colEl.getBoundingClientRect();
const menuHeight = 120;
const menuWidth  = 180;

let top = r.bottom + 5;
if (r.bottom + menuHeight > window.innerHeight) {
  top = r.top - menuHeight - 5;
  if (top < 0) top = 10;
}

let left = r.left;
if (r.left + menuWidth > window.innerWidth) {
  left = window.innerWidth - menuWidth - 10;
}

menu.style.top  = `${top}px`;
menu.style.left = `${left}px`;
  menu.addEventListener("click", ev => ev.stopPropagation());

  menu.querySelector("#column-edit-btn")
      .addEventListener("click", () => {
        openColumnDialog(cId);
        closeColumnMenu();
      });

  menu.querySelector("#column-delete-btn")
  .addEventListener("click", async () => {
    const ok = await openConfirmDialog({
      title: "Excluir coluna",
      message: "Tem certeza que deseja excluir esta coluna e todos os seus cartões?"
    });
    if (!ok) { closeColumnMenu(); return; }

    const openDlg = document.querySelector("dialog[open]");
    if (openDlg) {
      try { openDlg.close(); } catch {}
      openDlg.remove();
    }

    const bd = boards.find(b => b.id === bId);
    if (!bd) { closeColumnMenu(); return; }

    saveState(); // snapshot antes de excluir coluna
    bd.columns = bd.columns.filter(c => c.id !== cId);
    needsBackup = true;
    send("set-needs-backup", true);
    saveBoards();
    renderBoard();
    closeColumnMenu();
    forceFocusUnlock();
  });

  document.body.appendChild(menu);
  columnMenuEl = menu;
}
function closeColumnMenu() {
  if (columnMenuEl) columnMenuEl.remove();
  columnMenuEl = null;
}

// — REMOVER CARTÃO via menu —
function removeCurrentTask() {
  // Se um dialog estiver aberto, feche-o antes de mexer no DOM
  const openDlg = document.querySelector("dialog[open]");
  if (openDlg) {
    try { openDlg.close(); } catch {}
    openDlg.remove();
  }

  if (!boards.length) return;
  const { boardId, columnId, cardId } = menuContext;
  const bd  = boards.find(b => b.id === boardId);
  if (!bd) return;
  const col = bd.columns.find(c => c.id === columnId);
  if (!col) return;

  saveState(); // snapshot antes de excluir cartão
  col.tasks = col.tasks.filter(t => t.id !== cardId);
  saveBoards();
  renderBoard(); // só colunas/cartões
  forceFocusUnlock();
}

// — DELETAR QUADRO INTEIRO —
async function deleteBoard(bId) {
  if (!boards.length) return;
  const ok = await openConfirmDialog({
    title: "Excluir quadro",
    message: "Tem certeza que deseja excluir este quadro e todo o seu conteúdo?"
  });
  if (!ok) return;

  // Fecha e remove qualquer dialog aberto antes do render
  const openDlg = document.querySelector("dialog[open]");
  if (openDlg) {
    try { openDlg.close(); } catch {}
    openDlg.remove();
  }

  saveState(); // snapshot antes de deletar quadro
  boards = boards.filter(b => b.id !== bId);
  activeBoardId = boards[0]?.id || null;

  needsBackup = true;
  send("set-needs-backup", true);
  saveBoards();

  // Se ainda houver algum dialog (por timing), render só colunas
  if (document.querySelector("dialog[open]")) {
    renderBoard();
  } else {
    renderUI(); // select + índice + colunas
  }
}

// — DIÁLOGO: Criar/Editar QUADRO —
function openBoardDialog(boardId = null) {
  const dlg   = tBoardDialog.content.cloneNode(true).querySelector("dialog");
  const input = dlg.querySelector("#board-title-input");
  if (boardId) input.value = boards.find(b => b.id === boardId)?.title || "";

  dlg.style.fontSize = "1.2em";
  dlg.style.padding  = "1em";

  dlg.querySelector("#board-save-btn")
     .addEventListener("click", () => {
       const v = input.value.trim();
       if (!v) return;

       saveState(); // snapshot antes de editar/criar quadro

       if (boardId) {
         const b = boards.find(b => b.id === boardId);
         if (!b) return;
         b.title = v;
       } else {
         if (!Array.isArray(boards)) boards = [];
         boards.push({ id: `${Date.now()}`, title: v, columns: [] });
         activeBoardId = boards.at(-1).id;
       }
       needsBackup = true;
       send("set-needs-backup", true);
       saveBoards();
       renderUI();
       dlg.close();
       dlg.remove();
     });

  dlg.querySelector("#board-cancel-btn")
     .addEventListener("click", () => {
       dlg.close();
       dlg.remove();
     });

  document.body.appendChild(dlg);
  dlg.showModal();
  // reforço de foco no próximo frame
  requestAnimationFrame(() => input?.focus());
}

// — DIÁLOGO: Criar/Editar COLUNA —
function openColumnDialog(columnId = null) {
  const dlg    = tColumnDialog.content.cloneNode(true).querySelector("dialog");
  const titleI = dlg.querySelector("#column-title-input");
  const colorI = dlg.querySelector("#column-color-input");
  const delBtn = dlg.querySelector("#column-delete-btn");
  const bd     = boards.find(b => b.id === activeBoardId);

  if (columnId) {
    const col = bd?.columns.find(c => c.id === columnId);
    if (col) {
      titleI.value = col.title;
      colorI.value = col.color;
    }
  } else {
    colorI.value = lastUsedColumnColor;
    delBtn?.remove();
  }

  dlg.addEventListener("cancel", e => {
    e.preventDefault();
    dlg.close();
  });
  dlg.addEventListener("close", () => dlg.remove());

  dlg.querySelector("#column-save-btn")
     .addEventListener("click", () => {
       const t = titleI.value.trim();
       const c = colorI.value;
       if (!t || !bd) return;

       saveState(); // snapshot antes de editar/criar coluna

       if (columnId) {
         const col = bd.columns.find(c => c.id === columnId);
         if (!col) return;
         col.title = t;
         col.color = c;
       } else {
         bd.columns.push({
           id: `${Date.now()}`,
           title: t,
           color: c,
           tasks: []
         });
       }
       lastUsedColumnColor = c;
       localStorage.setItem("lastUsedColumnColor", c);

       needsBackup = true;
       send("set-needs-backup", true);
       saveBoards();
       renderBoard(); // só colunas
       dlg.close();
     });

  // Excluir coluna (se existir)
  delBtn?.addEventListener("click", async () => {
    const ok = await openConfirmDialog({
      title: "Excluir coluna",
      message: "Tem certeza que deseja excluir esta coluna e todos os seus cartões?"
    });
    if (!ok) return;

    // Fecha este dialog antes de render para não deixar backdrop preso
    try { dlg.close(); } catch {}
    dlg.remove();

    const bd = boards.find(b => b.id === activeBoardId);
    if (!bd) return;

    saveState(); // snapshot antes de excluir coluna
    bd.columns = bd.columns.filter(c => c.id !== columnId);

    needsBackup = true;
    send("set-needs-backup", true);
    saveBoards();
    renderBoard();
  });

  dlg.querySelector("#column-cancel-btn")
     .addEventListener("click", () => dlg.close());

  document.body.appendChild(dlg);
  dlg.showModal();
  requestAnimationFrame(() => titleI?.focus());
}

// — DIÁLOGO: Criar/Editar CARTÃO —
function openCardDialog(columnId = null, cardId = null) {
  const dlg        = tCardDialog.content.cloneNode(true).querySelector("dialog");
  const sel        = dlg.querySelector("#card-column-select");
  const titleI     = dlg.querySelector("#card-title-input");
  const colorI     = dlg.querySelector("#card-color-input");
  const textColorI = dlg.querySelector("#card-text-color-input");
  const bd         = boards.find(b => b.id === activeBoardId);
  if (!bd) return;

  // popula select de colunas
  const ph = new Option("Selecione coluna...", "", true, false);
  ph.disabled = true;
  sel.appendChild(ph);
  bd.columns.forEach(c => sel.appendChild(new Option(c.title, c.id)));
  if (columnId) sel.value = columnId;

  if (cardId) {
    const oc = bd.columns.find(c => c.tasks.some(t => t.id === cardId));
    const t  = oc?.tasks.find(t => t.id === cardId);
    if (oc && t) {
      sel.value        = oc.id;
      titleI.value     = t.title;
      colorI.value     = t.color;
      textColorI.value = t.textColor || lastUsedTextColor;
    }
  } else {
    // novo cartão
    colorI.value     = lastUsedCardColor;
    textColorI.value = lastUsedTextColor;
  }

  dlg.addEventListener("cancel", e => {
    e.preventDefault();
    dlg.close();
  });
  dlg.addEventListener("close", () => dlg.remove());

  dlg.querySelector("#card-save-btn")
     .addEventListener("click", () => {
       const colId    = sel.value;
       const txt      = titleI.value.trim();
       const colObj   = bd.columns.find(c => c.id === colId);
       const colr     = colorI.value;
       const txtColor = textColorI.value;
       if (!txt || !colObj) return;

       saveState(); // snapshot antes de editar/criar cartão

       if (cardId) {
         // mover/editar
         const source = bd.columns.find(c => c.tasks.some(t => t.id === cardId));
         const idx    = source?.tasks.findIndex(t => t.id === cardId);
         if (source && idx >= 0) {
           const [tsk] = source.tasks.splice(idx, 1);
           tsk.title     = txt;
           tsk.color     = colr;
           tsk.textColor = txtColor;
           colObj.tasks.splice(colObj.tasks.length, 0, tsk);
         }
       } else {
         // novo
         colObj.tasks.push({
           id:        `${Date.now()}`,
           title:     txt,
           color:     colr,
           textColor: txtColor
         });
       }

       lastUsedCardColor = colr;
       localStorage.setItem("lastUsedCardColor", colr);
       lastUsedTextColor = txtColor;
       localStorage.setItem("lastUsedTextColor", txtColor);

       saveBoards();
       renderBoard(); // só colunas/cartões
       dlg.close();
     });

  dlg.querySelector("#card-cancel-btn")
     .addEventListener("click", () => dlg.close());

  document.body.appendChild(dlg);
  dlg.showModal();
  requestAnimationFrame(() => titleI?.focus());
}

// — IMPRESSÃO: captura imagem + footer + print dialog —
async function printWithFooter(orientation = "portrait") {
  const user    = userId ? await invoke("get-user", userId) : { username: "" };
  const now     = new Date().toLocaleString();
  const footerTxt = `${user.username} — ${now}`;

  const style = document.createElement("style");
  style.id = "print-style";
  style.textContent = `
    @page { size: A4 ${orientation}; margin: 1cm; }
    @media print {
      body.printing > *:not(#print-container):not(#print-footer) {
        display: none !important;
      }
      #print-container {
        display: block !important; width: 100% !important;
        margin: 0 !important; padding: 0 !important;
      }
      #print-container img {
        display: block !important; width: 100% !important;
        height: auto !important; margin: 0 !important;
      }
      #print-footer {
        display: block !important; position: fixed !important;
        bottom: 1cm !important; width: 100% !important;
        text-align: right !important;
        padding: 0.5em 1em !important;
        font-size: 0.8em !important;
        background: white !important; border-top: 1px solid #ccc !important;
        z-index: 1000 !important;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.classList.add("printing");

  const main = document.getElementById("main-area");
  if (!main) throw new Error("#main-area não encontrado");
  const printContainer = document.createElement("div");
  printContainer.id = "print-container";
  document.body.appendChild(printContainer);

  const canvas = await html2canvas(main, { backgroundColor: "#fff", scale: 1 });

  const img = new Image();
  img.src           = canvas.toDataURL("image/png");
  img.style.display = "block";
  img.style.width   = "100%";
  printContainer.appendChild(img);

  const footer = document.createElement("div");
  footer.id          = "print-footer";
  footer.textContent = footerTxt;
  document.body.appendChild(footer);

  await new Promise((resolve, reject) => {
    img.onload  = () => resolve();
    img.onerror = () => reject(new Error("Falha ao carregar imagem para impressão"));
  });

  return new Promise(resolve => {
    window.onafterprint = () => {
      footer.remove();
      printContainer.remove();
      document.head.removeChild(style);
      document.body.classList.remove("printing");
      window.onafterprint = null;
      resolve();
    };
    window.print();
  });
}

// — EXPORTAR IMAGEM stand-alone —
function exportImage() {
  const mainArea = document.getElementById("main-area");
  const isLight  = document.body.classList.contains("light-mode");
  const bgColor  = isLight ? "#ffffff" : "#1e1e1e";
  html2canvas(mainArea, { backgroundColor: bgColor, scale: 1 }).then(
    canvas => {
      const link = document.createElement("a");
      link.download = "kanban.png";
      link.href     = canvas.toDataURL();
      link.click();
    }
  );
}

// — Busca de cards —
const search = document.getElementById("searchInput");
search.addEventListener("input", () => {
  const term      = search.value.trim().toLowerCase();
  const container = document.getElementById("columns-container");

  if (term === "") {
    renderBoard();
    return;
  }

  container.innerHTML = "";
  let matchCount = 0;

  boards.forEach(board => {
    board.columns.forEach(col => {
      const hits = col.tasks.filter(t => t.title.toLowerCase().includes(term));
      if (!hits.length) return;

      const colEl = document.createElement("div");
      colEl.className = "column";
      colEl.innerHTML = `
        <div class="column-header"><h3>${col.title}</h3></div>
        <div class="cards-container"></div>
      `;

      const cardsC = colEl.querySelector(".cards-container");
      hits.forEach(task => {
        const card = document.createElement("div");
        card.className   = "card";
        card.textContent = task.title;

        if (task.color) card.style.backgroundColor = task.color;
        if (task.textColor) card.style.color = task.textColor;

        cardsC.appendChild(card);
        matchCount++;
      });

      container.appendChild(colEl);
    });
  });

  document.querySelector(".no-results")?.remove();
  if (matchCount === 0) {
    const msg = document.createElement("div");
    msg.className   = "no-results";
    msg.textContent = "Nenhum cartão encontrado.";
    container.appendChild(msg);
  }
});

// — Menu de usuário e troca de sessão —
const userName      = document.getElementById("sidebar-user-name");
const userMenu      = document.getElementById("user-menu");
const switchUserBtn = document.getElementById("switch-user");

// 1) abre/fecha ao clicar (botão esquerdo)
userName.addEventListener("click", e => {
  e.stopPropagation();
  userMenu.classList.toggle("hidden");
});

// 2) abre/fecha ao clicar com o botão direito
userName.addEventListener("contextmenu", e => {
  e.preventDefault();
  e.stopPropagation();
  userMenu.classList.toggle("hidden");
});

// 3) fecha ao clicar em “Trocar Usuário”
switchUserBtn.addEventListener("click", e => {
  e.stopPropagation();
  userMenu.classList.add("hidden");
  send("switch-user");
});

// 4) fecha ao clicar fora (botão esquerdo)
document.addEventListener("click", e => {
  if (!e.target.closest("#sidebar-user-name") && !e.target.closest("#user-menu")) {
    userMenu.classList.add("hidden");
  }
});

// 5) fecha ao clicar fora (botão direito)
document.addEventListener("contextmenu", e => {
  if (!e.target.closest("#sidebar-user-name") && !e.target.closest("#user-menu")) {
    userMenu.classList.add("hidden");
  }
});

// 6) opcional: fecha com Esc
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    userMenu.classList.add("hidden");
  }
});

// — Tipografia: fontes e tamanho —
const windowsFonts = [
  "Arial", "Arial Black", "Bahnschrift", "Bahnschrift Light", "Calibri", "Cambria", "Cambria Math",
  "Candara", "Comic Sans MS", "Consolas", "Constantia", "Corbel", "Courier New", "Ebrima",
  "Franklin Gothic Medium", "Gabriola", "Gadugi", "Georgia", "Impact", "Lucida Console",
  "Lucida Sans Unicode", "Malgun Gothic", "Marlett", "Microsoft Himalaya", "Microsoft JhengHei",
  "Microsoft JhengHei UI", "Microsoft New Tai Lue", "Microsoft PhagsPa", "Microsoft Sans Serif",
  "Microsoft Tai Le", "Microsoft YaHei", "Microsoft YaHei UI", "Microsoft Yi Baiti", "MingLiU-ExtB",
  "MingLiU_HKSCS-ExtB", "Myanmar Text", "Nirmala UI", "Palatino Linotype", "Segoe MDL2 Assets",
  "Segoe Print", "Segoe Script", "Segoe UI", "Segoe UI Historic", "Segoe UI Emoji", "Segoe UI Symbol",
  "SimSun", "SimSun-ExtB", "Sitka", "Sylfaen", "Symbol", "Tahoma", "Times New Roman", "Trebuchet MS",
  "Verdana", "Webdings", "Wingdings", "Wingdings 2", "Wingdings 3", "Yu Gothic", "Yu Gothic UI"
];

const fontToggleBtn = document.getElementById('font-toggle-btn');
const fontSelect = document.getElementById('font-select');

windowsFonts.forEach(font => {
  const option = document.createElement("option");
  option.value = font;
  option.textContent = font;
  option.style.fontFamily = `"${font}", sans-serif`;
  fontSelect.appendChild(option);
});

fontToggleBtn.addEventListener('click', () => {
  const isOpen = fontSelect.classList.toggle('show');
  fontSelect.classList.toggle('hidden', !isOpen);
  fontToggleBtn.setAttribute('aria-expanded', isOpen);
  if (isOpen) fontSelect.focus();
});

document.addEventListener('click', (e) => {
  if (!fontToggleBtn.contains(e.target) && !fontSelect.contains(e.target)) {
    fontSelect.classList.add('hidden');
    fontSelect.classList.remove('show');
    fontToggleBtn.setAttribute('aria-expanded', 'false');
  }
});

const savedFont = localStorage.getItem("appFontFamily");
if (savedFont) {
  document.documentElement.style.setProperty("--app-font-family", `"${savedFont}", sans-serif`);
  fontSelect.value = savedFont;
}

fontSelect.addEventListener("change", (e) => {
  const selected = e.target.value || "Segoe UI";
  const finalFont = `"${selected}", sans-serif`;
  document.documentElement.style.setProperty("--app-font-family", finalFont);
  localStorage.setItem("appFontFamily", selected);
});

// — Font size controls —
const sizeBtn     = document.getElementById('font-size-toggle-btn');
const sizeInput   = document.getElementById('font-size-input');
const sizeDisplay = document.getElementById('font-size-display');

const savedSize = localStorage.getItem('appFontSize');
if (savedSize) {
  document.documentElement.style.setProperty('--app-font-size', savedSize);
  sizeInput.value = parseInt(savedSize, 10);
  sizeDisplay.textContent = savedSize;
}

sizeBtn.addEventListener('click', () => {
  const isOpen = sizeInput.classList.toggle('show');
  sizeDisplay.classList.toggle('show', isOpen);
  sizeInput.classList.toggle('hidden', !isOpen);
  sizeDisplay.classList.toggle('hidden', !isOpen);
  sizeBtn.setAttribute('aria-expanded', isOpen);
  if (isOpen) sizeInput.focus();
});

sizeInput.addEventListener('input', e => {
  const px = `${e.target.value}px`;
  document.documentElement.style.setProperty('--app-font-size', px);
  sizeDisplay.textContent = px;
  localStorage.setItem('appFontSize', px);
});
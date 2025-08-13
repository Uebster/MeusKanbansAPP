// public/script.js

const { ipcRenderer } = require("electron");

// Captura userId da query string
const params = new URLSearchParams(window.location.search);
const userId = params.get("userId");

// — Estado Global —
let boards        = [];
let activeBoardId = null;
let fileInput     = null;
let lastUsedCardColor = localStorage.getItem("lastUsedCardColor") || "#858585";
let lastUsedColumnColor = localStorage.getItem("lastUsedColumnColor") || "#ffffff";
let lastUsedTextColor = localStorage.getItem("lastUsedTextColor") || "#3d3d3d";

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
  // 1) Injetar nome do usuário no sidebar
  if (userId) {
    const user = await ipcRenderer.invoke("get-user", userId);
    document.getElementById("sidebar-user-name")
            .textContent = `👤 ${user.username}`;
  }

  // 2) Criar input oculto para import JSON
  fileInput = document.createElement("input");
  fileInput.type    = "file";
  fileInput.accept  = "application/json";
  fileInput.hidden  = true;
  fileInput.addEventListener("change", handleImport);
  document.body.appendChild(fileInput);

  // 3) Configurar botões da sidebar
  bindSidebarButtons();

  // 4) Request inicial de boards ao main (inclui userId)
  ipcRenderer.send("load-boards", userId);
  ipcRenderer.on("load-result", (_e, loaded) => {
    boards = loaded;
    if (!activeBoardId && boards.length) {
      activeBoardId = boards[0].id;
    }
    renderUI();
  });

  // 5) Fechar menus de contexto ao clicar fora
  document.body.addEventListener("click", e => {
    if (cardMenuEl && !cardMenuEl.contains(e.target)) closeCardMenu();
    if (columnMenuEl && !columnMenuEl.contains(e.target)) closeColumnMenu();
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

  // Salvar alterações (agora inclui userId)
  document.getElementById("save-btn")
    .addEventListener("click", () => {
      ipcRenderer.send("save-boards", boards, userId);
    });

  // Exportar JSON
  document.getElementById("export-btn")
    .addEventListener("click", exportData);

  // Importar JSON
  document.getElementById("import-btn")
    .addEventListener("click", () => fileInput.click());

  // Exportar Imagem (HTML2Canvas)
  document.getElementById("exportImageBtn")
    .addEventListener("click", exportImage);

  // Imprimir (rodapé + print dialog)
  document.getElementById("print-btn")
    .addEventListener("click", printWithFooter);

  // Alternar tema
  document.getElementById("theme-toggle-btn")
    .addEventListener("click", toggleTheme);

  // Sair do app
  document.getElementById("exit-btn")
    .addEventListener("click", () => ipcRenderer.send("app-close"));

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
  ipcRenderer.on("save-result", (_e, ok) => {
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
      ipcRenderer.send("save-boards", boards, userId);
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

// — BACKUP em localStorage (até 30 versões) —
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
  backupStore(boards);
  ipcRenderer.send("save-boards", boards, userId);
}

// — RENDERIZAÇÃO GERAL —
function renderUI() {
  renderBoardSelect();
  renderSidebarIndex();
  renderBoard();
}

// — POPULA <select> de quadros —
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

// — ÍNDICE LATERAL —
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
      <span class="idx-board-title${
        b.id === activeBoardId ? " active" : ""
      }">${b.title}</span>
      <ul>
        ${b.columns.map(c => `<li>${c.title}</li>`).join("")}
      </ul>`;
    li
      .querySelector(".idx-board-title")
      .addEventListener("click", () => {
        activeBoardId = b.id;
        renderUI();
      });
    ul.appendChild(li);
  });
}

// — MONTA COLUNAS e CARTÕES —
function renderBoard() {
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

// — MOVIMENTA CARTÃO entre colunas —
function handleCardDrop(e) {
  e.preventDefault();
  const data = JSON.parse(e.dataTransfer.getData("application/json"));
  if (!data.cardId) return;

  const toColId = e.currentTarget.closest(".column").dataset.columnId;
  const board   = boards.find(b => b.id === data.boardId);
  const fromCol = board.columns.find(c => c.id === data.columnId);
  const toCol   = board.columns.find(c => c.id === toColId);

  const idx = fromCol.tasks.findIndex(t => t.id === data.cardId);
  const [tsk] = fromCol.tasks.splice(idx, 1);

  // Insere na posição certa verticalmente
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
  renderUI();
}

// — RE‐ORDER de COLUNA via drag na área —
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

  const [moved] = cols.splice(fromI, 1);
  cols.splice(toI, 0, moved);

  saveBoards();
  renderUI();
}

// — MENU de contexto de CARTÃO —
function openCardMenu(cardEl, bId, cId, tId) {
  closeCardMenu();
  closeColumnMenu();
  menuContext = { boardId: bId, columnId: cId, cardId: tId };

  const menu = tCardMenu.content
    .cloneNode(true)
    .querySelector(".card-menu");
  const r    = cardEl.getBoundingClientRect();
  menu.style.top  = `${r.bottom + 5}px`;
  menu.style.left = `${r.left}px`;
  menu.addEventListener("click", ev => ev.stopPropagation());

  menu
    .querySelector("#card-edit-btn")
    .addEventListener("click", () => {
      openCardDialog(cId, tId);
      closeCardMenu();
    });
  menu
    .querySelector("#card-delete-btn")
    .addEventListener("click", () => {
      if (confirm("Excluir cartão?")) removeCurrentTask();
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
  const menu = tColumnMenu.content
    .cloneNode(true)
    .querySelector(".column-menu");
  const r    = colEl.getBoundingClientRect();
  menu.style.top  = `${r.bottom + 5}px`;
  menu.style.left = `${r.left}px`;
  menu.addEventListener("click", ev => ev.stopPropagation());

  menu
    .querySelector("#column-edit-btn")
    .addEventListener("click", () => {
      openColumnDialog(cId);
      closeColumnMenu();
    });
  menu
    .querySelector("#column-delete-btn")
    .addEventListener("click", () => {
      if (confirm("Excluir coluna?")) {
        const bd = boards.find(b => b.id === bId);
        bd.columns = bd.columns.filter(c => c.id !== cId);
        saveBoards();
        renderUI();
      }
      closeColumnMenu();
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
  const { boardId, columnId, cardId } = menuContext;
  const bd  = boards.find(b => b.id === boardId);
  const col = bd.columns.find(c => c.id === columnId);
  col.tasks = col.tasks.filter(t => t.id !== cardId);
  saveBoards();
  renderUI();
}

// — DELETAR QUADRO INTEIRO —
function deleteBoard(bId) {
  if (!confirm("Excluir quadro e todo o conteúdo?")) return;
  boards = boards.filter(b => b.id !== bId);
  activeBoardId = boards[0]?.id || null;
  saveBoards();
  renderUI();
}

// — DIÁLOGO: Criar/Editar QUADRO —
function openBoardDialog(boardId = null) {
  const dlg   = tBoardDialog.content
    .cloneNode(true)
    .querySelector("dialog");
  const input = dlg.querySelector("#board-title-input");
  if (boardId) input.value = boards.find(b => b.id === boardId).title;

  dlg.style.fontSize = "1.2em";
  dlg.style.padding  = "1em";
  dlg
    .querySelector("#board-save-btn")
    .addEventListener("click", () => {
      const v = input.value.trim();
      if (!v) return;
      if (boardId) {
        const b = boards.find(b => b.id === boardId);
        b.title = v;
      } else {
        boards.push({ id: `${Date.now()}`, title: v, columns: [] });
        activeBoardId = boards.at(-1).id;
      }
      saveBoards();
      renderUI();
      dlg.close();
      dlg.remove();
    });
  dlg
    .querySelector("#board-cancel-btn")
    .addEventListener("click", () => {
      dlg.close();
      dlg.remove();
    });

  document.body.appendChild(dlg);
  dlg.showModal();
}

// — DIÁLOGO: Criar/Editar COLUNA —
function openColumnDialog(columnId = null) {
  const dlg    = tColumnDialog.content
                    .cloneNode(true)
                    .querySelector("dialog");
  const titleI = dlg.querySelector("#column-title-input");
  const colorI = dlg.querySelector("#column-color-input");
  const delBtn = dlg.querySelector("#column-delete-btn");
  const bd     = boards.find(b => b.id === activeBoardId);

  if (columnId) {
    const col = bd.columns.find(c => c.id === columnId);
    titleI.value = col.title;
    colorI.value = col.color;
  } else {
    colorI.value = lastUsedColumnColor;
    delBtn.remove();
  }

  // Impede que Esc “trave” o foco
  dlg.addEventListener("cancel", e => {
    e.preventDefault();
    dlg.close();
  });

  // Remove do DOM sempre que fechar
  dlg.addEventListener("close", () => dlg.remove());

  // Salvar coluna
  dlg.querySelector("#column-save-btn")
     .addEventListener("click", () => {
       const t = titleI.value.trim();
       const c = colorI.value;
       if (!t) return;
       if (columnId) {
         const col = bd.columns.find(c => c.id === columnId);
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
       saveBoards();
       renderUI();
       dlg.close();
     });

  // Excluir coluna (se existir)
  delBtn?.addEventListener("click", () => {
    if (confirm("Excluir coluna?")) {
      bd.columns = bd.columns.filter(c => c.id !== columnId);
      saveBoards();
      renderUI();
      dlg.close();
    }
  });

  // Cancelar
  dlg.querySelector("#column-cancel-btn")
     .addEventListener("click", () => dlg.close());

  document.body.appendChild(dlg);
  dlg.showModal();
  titleI.focus();
}

// — DIÁLOGO: Criar/Editar CARTÃO —
function openCardDialog(columnId = null, cardId = null) {
  const dlg        = tCardDialog.content
                         .cloneNode(true)
                         .querySelector("dialog");
  const sel        = dlg.querySelector("#card-column-select");
  const titleI     = dlg.querySelector("#card-title-input");
  const colorI     = dlg.querySelector("#card-color-input");
  const textColorI = dlg.querySelector("#card-text-color-input");
  const bd         = boards.find(b => b.id === activeBoardId);

  // popula select de colunas
  const ph = new Option("Selecione coluna...", "", true, false);
  ph.disabled = true;
  sel.appendChild(ph);
  bd.columns.forEach(c => sel.appendChild(new Option(c.title, c.id)));
  if (columnId) sel.value = columnId;

  if (cardId) {
    // edição
    const oc = bd.columns.find(c => c.tasks.some(t => t.id === cardId));
    const t  = oc.tasks.find(t => t.id === cardId);
    sel.value        = oc.id;
    titleI.value     = t.title;
    colorI.value     = t.color;
    textColorI.value = t.textColor || lastUsedTextColor;
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

  // Salvar cartão
  dlg.querySelector("#card-save-btn")
     .addEventListener("click", () => {
       const colId    = sel.value;
       const txt      = titleI.value.trim();
       const colObj   = bd.columns.find(c => c.id === colId);
       const colr     = colorI.value;
       const txtColor = textColorI.value;
       if (!txt) return;

       if (cardId) {
         // mover/editar
         const source = bd.columns.find(c => c.tasks.some(t => t.id === cardId));
         const idx    = source.tasks.findIndex(t => t.id === cardId);
         const [tsk]  = source.tasks.splice(idx, 1);
         tsk.title     = txt;
         tsk.color     = colr;
         tsk.textColor = txtColor;
         colObj.tasks.push(tsk);
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
       renderUI();
       dlg.close();
     });

  // Cancelar
  dlg.querySelector("#card-cancel-btn")
     .addEventListener("click", () => dlg.close());

  document.body.appendChild(dlg);
  dlg.showModal();
  titleI.focus();
}

// — IMPRESSÃO: captura imagem + footer + print dialog —
async function printWithFooter(orientation = "portrait") {
  const user    = userId
    ? await ipcRenderer.invoke("get-user", userId)
    : { username: "" };
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

  const canvas = await html2canvas(main, {
    backgroundColor: "#fff",
    scale: 1
  });

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
    img.onerror = () =>
      reject(new Error("Falha ao carregar imagem para impressão"));
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
    renderUI();
    return;
  }

  container.innerHTML = "";
  let matchCount = 0;

  boards.forEach(board => {
    board.columns.forEach(col => {
      const hits = col.tasks.filter(t =>
        t.title.toLowerCase().includes(term)
      );
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
  e.preventDefault();    // evita abrir o menu padrão do browser
  e.stopPropagation();
  userMenu.classList.toggle("hidden");
});

// 3) fecha ao clicar em “Trocar Usuário”
switchUserBtn.addEventListener("click", e => {
  e.stopPropagation();
  userMenu.classList.add("hidden");
  window.location.href = "list-users.html";
});

// 4) fecha ao clicar fora (botão esquerdo)
document.addEventListener("click", e => {
  if (!e.target.closest("#sidebar-user-name") 
      && !e.target.closest("#user-menu")) {
    userMenu.classList.add("hidden");
  }
});

// 5) fecha ao clicar fora (botão direito)
document.addEventListener("contextmenu", e => {
  if (!e.target.closest("#sidebar-user-name") 
      && !e.target.closest("#user-menu")) {
    userMenu.classList.add("hidden");
  }
});

// 6) opcional: fecha com Esc
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    userMenu.classList.add("hidden");
  }
});

// **Saída do app**
  document.getElementById("exit-btn")
    .addEventListener("click", () => window.close());

  document.getElementById("board-select")
    .addEventListener("change", e => {
      activeBoardId = e.target.value;
      renderUI();
    });

  document.getElementById("edit-board-btn")
    .addEventListener("click", () => {
      if (!boards.length) return showMessage("Nenhum quadro para editar", true);
      openBoardDialog(activeBoardId);
    });

  document.getElementById("delete-board-btn")
    .addEventListener("click", () => {
      if (!boards.length) return showMessage("Nenhum quadro para excluir", true);
      deleteBoard(activeBoardId);
    });

  ipcRenderer.on("save-result", (_e, ok) => {
    showMessage(ok ? "Alterações salvas" : "Erro ao salvar", !ok);
  });

// 🎨 Lista de fontes do Windows
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

// 🔤 Font selector toggle
const fontToggleBtn = document.getElementById('font-toggle-btn');
const fontSelect = document.getElementById('font-select');

// Preenche o seletor com as fontes
windowsFonts.forEach(font => {
  const option = document.createElement("option");
  option.value = font;
  option.textContent = font;
  option.style.fontFamily = `"${font}", sans-serif`;
  fontSelect.appendChild(option);
});

// Toggle de visibilidade do seletor
fontToggleBtn.addEventListener('click', () => {
  const isOpen = fontSelect.classList.toggle('show');
  fontSelect.classList.toggle('hidden', !isOpen);
  fontToggleBtn.setAttribute('aria-expanded', isOpen);
  if (isOpen) fontSelect.focus();
});

// Fecha seletor ao clicar fora
document.addEventListener('click', (e) => {
  if (!fontToggleBtn.contains(e.target) && !fontSelect.contains(e.target)) {
    fontSelect.classList.add('hidden');
    fontSelect.classList.remove('show');
    fontToggleBtn.setAttribute('aria-expanded', 'false');
  }
});

// Aplica fonte salva
const savedFont = localStorage.getItem("appFontFamily");
if (savedFont) {
  document.documentElement.style.setProperty("--app-font-family", `"${savedFont}", sans-serif`);
  fontSelect.value = savedFont;
}

// Aplica nova fonte ao mudar
fontSelect.addEventListener("change", (e) => {
  const selected = e.target.value || "Segoe UI";
  const finalFont = `"${selected}", sans-serif`;
  document.documentElement.style.setProperty("--app-font-family", finalFont);
  localStorage.setItem("appFontFamily", selected);
});

// 🔠 Font size controls
const sizeBtn     = document.getElementById('font-size-toggle-btn');
const sizeInput   = document.getElementById('font-size-input');
const sizeDisplay = document.getElementById('font-size-display');

// Carrega tamanho salvo
const savedSize = localStorage.getItem('appFontSize');
if (savedSize) {
  document.documentElement.style.setProperty('--app-font-size', savedSize);
  sizeInput.value = parseInt(savedSize, 10);
  sizeDisplay.textContent = savedSize;
}

// Toggle de visibilidade do controle de tamanho
sizeBtn.addEventListener('click', () => {
  const isOpen = sizeInput.classList.toggle('show');
  sizeDisplay.classList.toggle('show', isOpen);
  sizeInput.classList.toggle('hidden', !isOpen);
  sizeDisplay.classList.toggle('hidden', !isOpen);
  sizeBtn.setAttribute('aria-expanded', isOpen);
  if (isOpen) sizeInput.focus();
});

// Atualiza tamanho ao mover slider
sizeInput.addEventListener('input', e => {
  const px = `${e.target.value}px`;
  document.documentElement.style.setProperty('--app-font-size', px);
  sizeDisplay.textContent = px;
  localStorage.setItem('appFontSize', px);
});

// Fecha controle de tamanho ao clicar fora
document.addEventListener('click', e => {
  if (!sizeBtn.contains(e.target) && !sizeInput.contains(e.target)) {
    sizeInput.classList.add('hidden');
    sizeDisplay.classList.add('hidden');
    sizeInput.classList.remove('show');
    sizeDisplay.classList.remove('show');
    sizeBtn.setAttribute('aria-expanded', 'false');
  }
});

// 7) confirmar com Enter quando o menu estiver aberto
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && !userMenu.classList.contains("hidden")) {
    e.preventDefault();            // evita qualquer outro comportamento
    switchUserBtn.click();         // dispara a ação de confirmar
  }
});

// 8) cancelar com botão direito enquanto o menu estiver aberto
userMenu.addEventListener("contextmenu", e => {
  e.preventDefault();              // suprime o menu nativo
  userMenu.classList.add("hidden"); // fecha o menu customizado
});
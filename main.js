// main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path    = require("path");
const storage = require("./storage.js");

let listWindow  = null;
let userWindow  = null;
let indexWindow = null;

/**
 * Janela de listagem de usuários (public/list-users.html)
 */
function createListWindow() {
  listWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  listWindow.loadFile(
    path.join(__dirname, "public", "list-users.html")
  );

  listWindow.on("closed", () => (listWindow = null));
}

/**
 * Janela modal de criação/edição de usuário
 */
function createUserWindow(userId = null) {
  if (userWindow) {
    userWindow.focus();
    return;
  }

  userWindow = new BrowserWindow({
    width: 400,
    height: 500,
    parent: listWindow,
    modal: true,
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  userWindow.loadFile(
    path.join(__dirname, "public", "create-user.html")
  );

  userWindow.webContents.once("did-finish-load", async () => {
    let user = null;
    if (userId) {
      try {
        user = await storage.getUserById(userId);
      } catch (err) {
        console.error("Erro ao carregar usuário:", err);
      }
    }
    userWindow.webContents.send("load-user", user);
  });

  userWindow.on("closed", () => (userWindow = null));
}

/**
 * Janela principal do Kanban (public/index.html)
 * Recebe userId via query string
 */
function createIndexWindow(selectedUserId) {
  indexWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  indexWindow.loadFile(
    path.join(__dirname, "public", "index.html"),
    { query: { userId: selectedUserId } }
  );
  indexWindow.maximize();
  indexWindow.on("closed", () => (indexWindow = null));
}

// Ciclo de vida da aplicação
app.whenReady().then(createListWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createListWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// --- IPC: Fluxo de Usuários ---
ipcMain.on("open-create-user", (_evt, { id }) => {
  createUserWindow(id);
});

ipcMain.on("get-all-users", async event => {
  try {
    const users = await storage.getAllUsers();
    event.reply("get-all-users-reply", users);
  } catch {
    event.reply("get-all-users-reply", []);
  }
});

ipcMain.on("create-user", async (event, data) => {
  try {
    await storage.insertUser(data);
    event.reply("create-user-reply", { success: true, message: "Criado com sucesso." });
    if (listWindow) {
      const users = await storage.getAllUsers();
      listWindow.webContents.send("get-all-users-reply", users);
    }
  } catch (err) {
    event.reply("create-user-reply", { success: false, message: err.message });
  }
});

ipcMain.on("update-user", async (event, data) => {
  try {
    await storage.updateUser(data);
    event.reply("update-user-reply", { success: true, message: "Atualizado com sucesso." });
    if (listWindow) {
      const users = await storage.getAllUsers();
      listWindow.webContents.send("get-all-users-reply", users);
    }
  } catch (err) {
    event.reply("update-user-reply", { success: false, message: err.message });
  }
});

ipcMain.on("delete-user", async (event, { id }) => {
  try {
    await storage.deleteUser(id);
    event.reply("delete-user-reply", { success: true, message: "Excluído com sucesso." });
    if (listWindow) {
      const users = await storage.getAllUsers();
      listWindow.webContents.send("get-all-users-reply", users);
    }
  } catch (err) {
    event.reply("delete-user-reply", { success: false, message: err.message });
  }
});

// Após selecionar usuário na lista, fecha essa janela e abre o Kanban
ipcMain.on("user-selected", (_evt, userId) => {
  if (listWindow) {
    listWindow.close();
    listWindow = null;
  }
  createIndexWindow(userId);
});

// --- Novo handler para expor dados do usuário ao renderer ---
ipcMain.handle("get-user", async (_evt, userId) => {
  try {
    const user = await storage.getUserById(userId);
    return user || { username: "Desconhecido" };
  } catch {
    return { username: "Desconhecido" };
  }
});

// --- IPC: Fluxo de Kanban ORIGINAL ---
// Mantido para referência, mas estes podem ser comentados para evitar dupla chamada:
//
// ipcMain.on("load-boards", async event => {
//   try {
//     const boards = await storage.getAllBoards();
//     event.reply("load-result", boards);
//   } catch {
//     event.reply("load-result", []);
//   }
// });
//
// ipcMain.on("save-boards", async (event, boards) => {
//   try {
//     if (typeof storage.backupBoards === "function") {
//       await storage.backupBoards();
//     }
//     await storage.saveBoards(boards);
//     event.reply("save-result", true);
//   } catch (err) {
//     console.error("Erro ao salvar quadros:", err);
//     event.reply("save-result", false);
//   }
// });

// --- IPC: Fluxo de Kanban AJUSTADO por usuário ---
ipcMain.on("load-boards", async (event, userId) => {
  try {
    const boards = await storage.getBoardsByUser(userId);
    event.reply("load-result", boards);
  } catch {
    event.reply("load-result", []);
  }
});

ipcMain.on("save-boards", async (event, boards, userId) => {
  try {
    if (typeof storage.backupBoards === "function") {
      await storage.backupBoards();
    }
    await storage.saveBoardsByUser(userId, boards);
    event.reply("save-result", true);
  } catch (err) {
    console.error("Erro ao salvar quadros:", err);
    event.reply("save-result", false);
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'assets', 'MeusKanbans.ico')
  });

  win.loadFile('index.html');
}

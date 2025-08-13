const { app, BrowserWindow, ipcMain } = require("electron");
const path    = require("path");
const storage = require("./storage.js");

let listWindow  = null;
let userWindow  = null;
let indexWindow = null;
let needsBackup = false;         // usado pelos renderers
let loginProcessando = false;    // blindagem contra duplo login

// Configurações comuns — compatíveis com preload.js e window.electronAPI
const webPrefs = {
  preload: path.join(__dirname, "preload.js"),
  nodeIntegration: false,
  contextIsolation: true
};

function createListWindow() {
  listWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: webPrefs
  });
  listWindow.loadFile(path.join(__dirname, "public", "list-users.html"));
  listWindow.on("closed", () => (listWindow = null));
}

function createUserWindow(userId = null) {
  if (userWindow) { userWindow.focus(); return; }

  userWindow = new BrowserWindow({
    width: 400,
    height: 500,
    parent: listWindow || indexWindow || null,
    modal: true,
    autoHideMenuBar: true,
    webPreferences: webPrefs
  });

  userWindow.loadFile(path.join(__dirname, "public", "create-user.html"));

  userWindow.webContents.once("did-finish-load", async () => {
    let user = null;
    if (userId) {
      try { user = await storage.getUserById(userId); }
      catch (err) { console.error("Erro ao carregar usuário:", err); }
    }
    userWindow.webContents.send("load-user", user);
  });

  userWindow.on("closed", () => (userWindow = null));
}

function createIndexWindow(selectedUserId) {
  indexWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: webPrefs
  });

  indexWindow.loadFile(
    path.join(__dirname, "public", "index.html"),
    { query: { userId: selectedUserId } }
  );
  indexWindow.maximize();

  // Sempre que a janela principal fechar, zera a flag de login
  indexWindow.on("closed", () => {
    indexWindow = null;
    loginProcessando = false;
  });
}

app.whenReady().then(createListWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createListWindow();
});

app.on("before-quit", async () => {
  if (needsBackup) {
    try {
      await storage.backupBoards();
      console.log("Backup feito antes de sair.");
    } catch (err) {
      console.error("Erro no backup ao sair:", err);
    }
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// --- IPC: Usuários ---
ipcMain.on("open-create-user", (_evt, { id }) => createUserWindow(id));

ipcMain.on("get-all-users", async (event) => {
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

// Seleção de usuário — fecha list e abre index (com blindagem)
ipcMain.on("user-selected", (_evt, userId) => {
  if (loginProcessando) return;
  loginProcessando = true;

  if (listWindow) { listWindow.close(); listWindow = null; }
  createIndexWindow(userId);

  // Se por algum motivo a janela não existir, libera a flag
  if (!indexWindow) loginProcessando = false;
});

// Trocar usuário vindo do index — fecha index e reabre list
ipcMain.on("switch-user", () => {
  if (indexWindow) {
    indexWindow.close(); // on('closed') já zera loginProcessando
    indexWindow = null;
  }
  createListWindow();
});

// --- IPC: Dados do usuário ao renderer ---
ipcMain.handle("get-user", async (_evt, userId) => {
  try { return await storage.getUserById(userId); }
  catch { return null; }
});

// --- IPC: Quadros por usuário ---
ipcMain.on("load-boards", async (event, userId) => {
  try {
    const boards = await storage.getBoardsByUser(userId);
    event.reply("load-result", boards);
  } catch (err) {
    console.error("Erro em load-boards:", err);
    event.reply("load-result", []);
  }
});

ipcMain.on("save-boards", async (event, boards, userId) => {
  try {
    await storage.backupBoards();
    await storage.saveBoardsByUser(userId, boards);
    event.reply("save-result", true);
  } catch (err) {
    console.error("Erro ao salvar quadros:", err);
    event.reply("save-result", false);
  }
});

ipcMain.on("set-needs-backup", (_e, val) => {
  needsBackup = !!val;
});
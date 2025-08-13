// storage.js

const path = require("path");
const fs   = require("fs");

// Diretório onde ficam os arquivos de dados
const DATA_DIR     = path.join(__dirname, "data");
const BACKUP_DIR   = path.join(DATA_DIR, "backups");
const STORE_USERS  = path.join(DATA_DIR, "users.json");
const STORE_BOARDS = path.join(DATA_DIR, "boards.json");

// Garante que as pastas data/ e data/backups/ existam
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Lê um JSON de qualquer caminho, retornando [] em caso de falha.
 */
function readJsonArray(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw  = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`Erro ao ler ${path.basename(filePath)}:`, err);
    return [];
  }
}

/**
 * Grava um array em JSON num arquivo, retornando { success, error }.
 */
function writeJsonArray(filePath, arr) {
  try {
    const json = JSON.stringify(arr, null, 2);
    fs.writeFileSync(filePath, json, "utf-8");
    return { success: true };
  } catch (err) {
    console.error(`Erro ao salvar ${path.basename(filePath)}:`, err);
    return { success: false, error: err };
  }
}

/**
 * Faz backup de STORE_BOARDS antes de sobrescrever.
 * Gera um arquivo em data/backups/boards-YYYY-MM-DDTHH-mm-ss.json
 * Mantém apenas as 1000 versões mais recentes.
 */
async function backupBoards() {
  try {
    if (!fs.existsSync(STORE_BOARDS)) {
      return;
    }

    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

    const backupName = `boards-${ts}.json`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    fs.copyFileSync(STORE_BOARDS, backupPath);

    let files = fs
      .readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith(".json"))
      .sort();

    const excess = files.length - 1000;
    if (excess > 0) {
      for (let i = 0; i < excess; i++) {
        fs.unlinkSync(path.join(BACKUP_DIR, files[i]));
      }
    }
  } catch (err) {
    console.error("Erro no backup de quadros:", err);
  }
}

// ===========================
// Funções para manipulação de usuários
// ===========================
async function getAllUsers() {
  return readJsonArray(STORE_USERS);
}

async function getUserById(id) {
  const users = readJsonArray(STORE_USERS);
  return users.find(u => u.id == id) || null;
}

async function insertUser({ username, password }) {
  const users = readJsonArray(STORE_USERS);
  const nextId = users.length
    ? Math.max(...users.map(u => u.id)) + 1
    : 1;
  users.push({ id: nextId, username, password });
  const { success, error } = writeJsonArray(STORE_USERS, users);
  if (!success) throw new Error(error?.message || "Falha ao salvar usuário");
  return { id: nextId, username };
}

async function updateUser({ id, username, password }) {
  const users = readJsonArray(STORE_USERS);
  const idx   = users.findIndex(u => u.id == id);
  if (idx < 0) throw new Error("Usuário não encontrado");
  users[idx] = { id: Number(id), username, password };
  const { success, error } = writeJsonArray(STORE_USERS, users);
  if (!success) throw new Error(error?.message || "Falha ao atualizar usuário");
  return { id: Number(id), username };
}

async function deleteUser(id) {
  const users    = readJsonArray(STORE_USERS);
  const filtered = users.filter(u => u.id != id);
  if (filtered.length === users.length) {
    throw new Error("Usuário não encontrado");
  }
  const { success, error } = writeJsonArray(STORE_USERS, filtered);
  if (!success) throw new Error(error?.message || "Falha ao excluir usuário");
}

// ===========================
// Funções para Quadros Kanban Originais
// ===========================
async function getAllBoards() {
  return readJsonArray(STORE_BOARDS);
}

async function saveBoards(boards) {
  const { success, error } = writeJsonArray(STORE_BOARDS, boards);
  if (!success) throw new Error(error?.message || "Falha ao salvar quadros");
}

// ===========================
// Funções para Quadros por Usuário
// ===========================
async function getBoardsByUser(userId) {
  const all = readJsonArray(STORE_BOARDS);
  console.log("getBoardsByUser() leu:", all.length, "itens");
  return all.filter(b => String(b.userId) === String(userId));
}

async function saveBoardsByUser(userId, boardsForUser) {
  if (!Array.isArray(boardsForUser)) {
    throw new Error("boardsForUser precisa ser um array");
  }
  const all    = readJsonArray(STORE_BOARDS);
  const others = all.filter(b => String(b.userId) !== String(userId));
  const owned  = boardsForUser.map(b => ({ ...b, userId }));
  const merged = others.concat(owned);
  const { success, error } = writeJsonArray(STORE_BOARDS, merged);
  if (!success) throw new Error(error?.message || "Falha ao salvar quadros");
}

module.exports = {
  // Usuários
  getAllUsers,
  getUserById,
  insertUser,
  updateUser,
  deleteUser,

  // Quadros Originais
  getAllBoards,
  saveBoards,

  // Backup
  backupBoards,

  // Quadros por Usuário
  getBoardsByUser,
  saveBoardsByUser
};
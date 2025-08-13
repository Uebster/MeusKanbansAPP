// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Canais permitidos para envio do renderer ao main
const validSendChannels = [
  'open-create-user',
  'get-all-users',
  'create-user',
  'update-user',
  'delete-user',
  'user-selected',
  'load-boards',
  'save-boards',
  'app-close',
  'set-needs-backup',
  'switch-user'
];

// Canais permitidos para recebimento de eventos do main no renderer
const validReceiveChannels = [
  'get-all-users-reply',
  'create-user-reply',
  'update-user-reply',
  'delete-user-reply',
  'load-user',
  'load-result',
  'save-result'
];

// Canais que suportam invoke/handle (request–response)
const validInvokeChannels = [
  'get-user'
];

contextBridge.exposeInMainWorld('electronAPI', {
  // Envia mensagens ao main process
  send: (channel, ...args) => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },

  // Escuta eventos enviados pelo main process
  on: (channel, callback) => {
    if (validReceiveChannels.includes(channel)) {
      const listener = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, listener);
    }
  },

  // Faz invocações request–response
  invoke: (channel, ...args) => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Channel "${channel}" not allowed`));
  }
});
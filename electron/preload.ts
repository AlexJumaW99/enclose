// The only door between the window and the app's own process: `window.cad`.
import { contextBridge, ipcRenderer } from "electron"

import { CHANNEL, type CadApi } from "../shared/api"

function on<Args extends unknown[]>(
  channel: string,
  listener: (...args: Args) => void
) {
  const wrapped = (_: unknown, ...args: unknown[]) =>
    listener(...(args as Args))
  ipcRenderer.on(channel, wrapped)
  return () => {
    ipcRenderer.removeListener(channel, wrapped)
  }
}

const api: CadApi = {
  platform: process.platform,
  projects: {
    list: () => ipcRenderer.invoke(CHANNEL.projectsList),
    add: () => ipcRenderer.invoke(CHANNEL.projectsAdd),
    remove: (id) => ipcRenderer.invoke(CHANNEL.projectsRemove, id),
    reveal: (id) => ipcRenderer.invoke(CHANNEL.projectsReveal, id),
    onChange: (listener) => on(CHANNEL.projectsChanged, listener),
  },
  model: {
    read: (projectId) => ipcRenderer.invoke(CHANNEL.modelRead, projectId),
    saveCopy: (projectId, file, name) =>
      ipcRenderer.invoke(CHANNEL.modelSaveCopy, projectId, file, name),
  },
  thread: {
    items: (projectId) => ipcRenderer.invoke(CHANNEL.threadItems, projectId),
    send: (projectId, text, part, access) =>
      ipcRenderer.invoke(CHANNEL.threadSend, projectId, text, part, access),
    stop: (projectId) => ipcRenderer.invoke(CHANNEL.threadStop, projectId),
    answer: (projectId, permissionId, answer) =>
      ipcRenderer.invoke(CHANNEL.threadAnswer, projectId, permissionId, answer),
    reset: (projectId) => ipcRenderer.invoke(CHANNEL.threadReset, projectId),
    onItem: (listener) => on(CHANNEL.threadItem, listener),
    onReset: (listener) => on(CHANNEL.threadWasReset, listener),
  },
  claude: {
    status: () => ipcRenderer.invoke(CHANNEL.claudeStatus),
  },
  viewport: {
    onRequest: (listener) => on(CHANNEL.viewportRequest, listener),
    respond: (response) => ipcRenderer.send(CHANNEL.viewportResponse, response),
  },
}

contextBridge.exposeInMainWorld("cad", api)

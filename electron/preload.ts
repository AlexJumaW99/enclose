// The only door between the window and the app's own process: `window.cad`.
import { contextBridge, ipcRenderer, webUtils } from "electron"

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
    add: (kind) => ipcRenderer.invoke(CHANNEL.projectsAdd, kind),
    open: (paths) => ipcRenderer.invoke(CHANNEL.projectsOpen, paths),
    create: () => ipcRenderer.invoke(CHANNEL.projectsCreate),
    pathOf: (file) => webUtils.getPathForFile(file),
    remove: (id) => ipcRenderer.invoke(CHANNEL.projectsRemove, id),
    reveal: (id) => ipcRenderer.invoke(CHANNEL.projectsReveal, id),
    onChange: (listener) => on(CHANNEL.projectsChanged, listener),
  },
  model: {
    read: (projectId) => ipcRenderer.invoke(CHANNEL.modelRead, projectId),
    saveCopy: (projectId, file, name) =>
      ipcRenderer.invoke(CHANNEL.modelSaveCopy, projectId, file, name),
    saveCopies: (projectId, files, folder) =>
      ipcRenderer.invoke(CHANNEL.modelSaveCopies, projectId, files, folder),
  },
  changes: {
    undo: (projectId) => ipcRenderer.invoke(CHANNEL.changesUndo, projectId),
    redo: (projectId) => ipcRenderer.invoke(CHANNEL.changesRedo, projectId),
  },
  thread: {
    items: (projectId, conversationId) =>
      ipcRenderer.invoke(CHANNEL.threadItems, projectId, conversationId),
    send: (projectId, conversationId, text, notes, objects, manner) =>
      ipcRenderer.invoke(
        CHANNEL.threadSend,
        projectId,
        conversationId,
        text,
        notes,
        objects,
        manner
      ),
    lookOver: (projectId, seen, manner) =>
      ipcRenderer.invoke(CHANNEL.threadLookOver, projectId, seen, manner),
    stop: (projectId) => ipcRenderer.invoke(CHANNEL.threadStop, projectId),
    rename: (projectId, conversationId, name) =>
      ipcRenderer.invoke(CHANNEL.threadRename, projectId, conversationId, name),
    answer: (projectId, permissionId, answer) =>
      ipcRenderer.invoke(CHANNEL.threadAnswer, projectId, permissionId, answer),
    onItem: (listener) => on(CHANNEL.threadItem, listener),
  },
  claude: {
    status: () => ipcRenderer.invoke(CHANNEL.claudeStatus),
    models: () => ipcRenderer.invoke(CHANNEL.claudeModels),
    commands: (projectId) =>
      ipcRenderer.invoke(CHANNEL.claudeCommands, projectId),
  },
  settings: {
    get: () => ipcRenderer.invoke(CHANNEL.settingsGet),
    chooseProjectsFolder: () =>
      ipcRenderer.invoke(CHANNEL.settingsChooseProjectsFolder),
    revealProjectsFolder: () =>
      ipcRenderer.invoke(CHANNEL.settingsRevealProjectsFolder),
    setLookOver: (on) => ipcRenderer.invoke(CHANNEL.settingsSetLookOver, on),
  },
  viewport: {
    onRequest: (listener) => on(CHANNEL.viewportRequest, listener),
    respond: (response) => ipcRenderer.send(CHANNEL.viewportResponse, response),
  },
}

contextBridge.exposeInMainWorld("cad", api)

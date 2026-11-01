import { contextBridge, ipcRenderer } from 'electron'
import type { StashApi, UpdateCheck, UpdateProgress } from '../shared/types'
import type { AiApi, AiEvent } from '../shared/ai'

const call =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args)

const api: StashApi = {
  library: call('library'),
  createWiki: call('createWiki'),
  openWikiFolder: call('openWikiFolder'),
  forgetWiki: call('forgetWiki'),
  loadWiki: call('loadWiki'),
  saveMeta: call('saveMeta'),
  savePage: call('savePage'),
  listHistory: call('listHistory'),
  readHistory: call('readHistory'),
  savePages: call('savePages'),
  trashPage: call('trashPage'),
  listTrash: call('listTrash'),
  restorePage: call('restorePage'),
  purgePage: call('purgePage'),
  pickImages: call('pickImages'),
  saveImageData: call('saveImageData'),
  fetchImage: call('fetchImage'),
  revealWiki: call('revealWiki'),
  openExternal: call('openExternal'),
  openInspector: call('openInspector'),
  exportShare: call('exportShare'),
  inspectShare: call('inspectShare'),
  applyShare: call('applyShare'),
  exportSite: call('exportSite'),
  takeShareFile: call('takeShareFile'),
  showPath: call('showPath'),
  updates: {
    info: call('updates:info'),
    setAutoCheck: call('updates:setAuto'),
    check: call('updates:check'),
    install: call('updates:install'),
    onProgress: (cb: (p: UpdateProgress) => void) => {
      const listener = (_e: unknown, p: UpdateProgress): void => cb(p)
      ipcRenderer.on('updates:progress', listener)
      return () => ipcRenderer.removeListener('updates:progress', listener)
    },
    onAvailable: (cb: (c: UpdateCheck) => void) => {
      const listener = (_e: unknown, c: UpdateCheck): void => cb(c)
      ipcRenderer.on('updates:available', listener)
      return () => ipcRenderer.removeListener('updates:available', listener)
    }
  },
  onShareFile: (cb: (path: string) => void) => {
    const listener = (_e: unknown, path: string): void => cb(path)
    ipcRenderer.on('open-share-file', listener)
    return () => ipcRenderer.removeListener('open-share-file', listener)
  }
} as StashApi

if (__AI__) {
  api.ai = {
    getSettings: call('ai:getSettings'),
    saveSettings: call('ai:saveSettings'),
    setKey: call('ai:setKey'),
    listModels: call('ai:listModels'),
    chat: call('ai:chat'),
    abort: call('ai:abort'),
    onEvent: (cb: (e: AiEvent) => void) => {
      const listener = (_e: unknown, ev: AiEvent): void => cb(ev)
      ipcRenderer.on('ai:event', listener)
      return () => ipcRenderer.removeListener('ai:event', listener)
    }
  } as AiApi
}

contextBridge.exposeInMainWorld('stash', api)

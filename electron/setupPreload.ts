import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getDefaults: () => ipcRenderer.invoke('setup-defaults'),
  pickFolder: () => ipcRenderer.invoke('setup-pick-folder'),
  startInstall: (installPath: string) => ipcRenderer.invoke('setup-install', installPath),
  onProgress: (cb: (p: { phase: string; percent: number; detail?: string }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, p: { phase: string; percent: number; detail?: string }) =>
      cb(p);
    ipcRenderer.on('setup-progress', listener);
    return () => ipcRenderer.removeListener('setup-progress', listener);
  },
  rebootNow: () => ipcRenderer.invoke('setup-reboot'),
  launchApp: () => ipcRenderer.invoke('setup-launch'),
  quit: () => ipcRenderer.invoke('setup-quit'),
};

contextBridge.exposeInMainWorld('boysSetup', api);

export type BoysSetupApi = typeof api;

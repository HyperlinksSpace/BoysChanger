import { contextBridge, ipcRenderer } from 'electron';

export type SystemInputResult = { ok: boolean; message: string };

const api = {
  platform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke('platform'),
  ensureMicPermission: (): Promise<boolean> => ipcRenderer.invoke('ensure-mic-permission'),
  virtualCableHints: (): Promise<string[]> => ipcRenderer.invoke('virtual-cable-hints'),
  setSystemInput: (deviceHint: string): Promise<SystemInputResult> =>
    ipcRenderer.invoke('set-system-input', deviceHint),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
};

contextBridge.exposeInMainWorld('boysChanger', api);

export type BoysChangerApi = typeof api;

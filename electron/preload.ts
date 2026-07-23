import { contextBridge, ipcRenderer } from 'electron';

export type SystemInputResult = { ok: boolean; message: string };
export type UpdateStatusPayload = {
  status: 'checking' | 'available' | 'not-available' | 'downloaded' | 'error';
  version?: string;
  message?: string;
};

const api = {
  platform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke('platform'),
  getVersion: (): Promise<string> => ipcRenderer.invoke('get-version'),
  getLocale: (): Promise<string> => ipcRenderer.invoke('get-locale'),
  ensureMicPermission: (): Promise<boolean> => ipcRenderer.invoke('ensure-mic-permission'),
  virtualCableHints: (): Promise<string[]> => ipcRenderer.invoke('virtual-cable-hints'),
  setSystemInput: (deviceHint: string): Promise<SystemInputResult> =>
    ipcRenderer.invoke('set-system-input', deviceHint),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
  checkForUpdates: (): Promise<{ ok: boolean; version?: string; message?: string }> =>
    ipcRenderer.invoke('check-for-updates'),
  setChangerStatus: (on: boolean): Promise<{ ok: boolean; on: boolean }> =>
    ipcRenderer.invoke('set-changer-status', on),
  debugLog: (payload: {
    level?: 'info' | 'warn' | 'error';
    scope?: string;
    message: string;
    data?: unknown;
  }): Promise<{ ok: boolean }> => ipcRenderer.invoke('debug-log', payload),
  getLogPath: (): Promise<{ primary: string; paths: string[] }> =>
    ipcRenderer.invoke('get-log-path'),
  readDebugLog: (maxLines?: number): Promise<string> =>
    ipcRenderer.invoke('read-debug-log', maxLines),
  openLogFolder: (): Promise<{ ok: boolean; path: string }> =>
    ipcRenderer.invoke('open-log-folder'),
  savePrehearDebug: (
    wav: ArrayBuffer,
    meta?: Record<string, unknown>,
  ): Promise<{ ok: boolean; files?: string[]; error?: string }> =>
    ipcRenderer.invoke('save-prehear-debug', { wav, meta }),
  onUpdateStatus: (cb: (payload: UpdateStatusPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: UpdateStatusPayload) => cb(payload);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
};

contextBridge.exposeInMainWorld('boysChanger', api);

export type BoysChangerApi = typeof api;

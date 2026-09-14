import { contextBridge, ipcRenderer } from 'electron';

export interface PendingUpdate {
    version: string;
}

const api = {
    hideWindow: (): Promise<void> => ipcRenderer.invoke('window:hide'),
    setAlwaysOnTop: (flag: boolean): Promise<void> =>
        ipcRenderer.invoke('window:set-always-on-top', flag),
    isAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('window:is-always-on-top'),

    openUrl: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-url', url),

    openImageFiles: (): Promise<string[] | null> => ipcRenderer.invoke('dialog:open-files'),

    pathToBase64: (filePath: string): Promise<string> =>
        ipcRenderer.invoke('fs:path-to-base64', filePath),

    fetchImage: (url: string): Promise<string> => ipcRenderer.invoke('net:fetch-image', url),

    osType: (): Promise<string> => ipcRenderer.invoke('os:type'),

    autostartIsEnabled: (): Promise<boolean> => ipcRenderer.invoke('autostart:is-enabled'),
    autostartSet: (enabled: boolean): Promise<void> =>
        ipcRenderer.invoke('autostart:set', enabled),

    relaunch: (): Promise<void> => ipcRenderer.invoke('app:relaunch'),

    updaterCheck: (): Promise<PendingUpdate | null> => ipcRenderer.invoke('updater:check'),
    updaterDownloadAndInstall: (): Promise<void> =>
        ipcRenderer.invoke('updater:download-and-install'),
    onUpdaterDownloaded: (callback: () => void): (() => void) => {
        const listener = () => callback();

        ipcRenderer.on('updater:downloaded', listener);

        return () => ipcRenderer.removeListener('updater:downloaded', listener);
    },
};

export type CopallApi = typeof api;

contextBridge.exposeInMainWorld('copall', api);

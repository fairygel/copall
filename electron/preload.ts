import { contextBridge, ipcRenderer } from 'electron';

export interface PendingUpdate {
    version: string;
}

export interface WebSearchResult {
    title: string;
    url: string;
    snippet: string;
}

export interface WebPageContent {
    url: string;
    title: string;
    text: string;
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

    searchWeb: (query: string, apiKey: string): Promise<WebSearchResult[]> =>
        ipcRenderer.invoke('net:search-web', query, apiKey),

    fetchPageContent: (url: string): Promise<WebPageContent> =>
        ipcRenderer.invoke('net:fetch-page', url),

    osType: (): Promise<string> => ipcRenderer.invoke('os:type'),

    autostartIsEnabled: (): Promise<boolean> => ipcRenderer.invoke('autostart:is-enabled'),
    autostartSet: (enabled: boolean): Promise<boolean> =>
        ipcRenderer.invoke('autostart:set', enabled),

    relaunch: (): Promise<void> => ipcRenderer.invoke('app:relaunch'),

    appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),

    updaterCheck: (): Promise<PendingUpdate | null> => ipcRenderer.invoke('updater:check'),
    updaterDownloadAndInstall: (): Promise<void> =>
        ipcRenderer.invoke('updater:download-and-install'),
    onUpdaterDownloaded: (callback: () => void): (() => void) => {
        const listener = () => callback();

        ipcRenderer.on('updater:downloaded', listener);

        return () => ipcRenderer.removeListener('updater:downloaded', listener);
    },
    onUpdaterDownloadProgress: (callback: (percent: number) => void): (() => void) => {
        const listener = (_event: unknown, payload: { percent: number }) =>
            callback(payload.percent);

        ipcRenderer.on('updater:download-progress', listener);

        return () => ipcRenderer.removeListener('updater:download-progress', listener);
    },
};

export type CopallApi = typeof api;

contextBridge.exposeInMainWorld('copall', api);

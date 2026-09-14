interface PendingUpdate {
    version: string;
}

interface CopallApi {
    hideWindow: () => Promise<void>;
    setAlwaysOnTop: (flag: boolean) => Promise<void>;
    isAlwaysOnTop: () => Promise<boolean>;

    openUrl: (url: string) => Promise<void>;

    openImageFiles: () => Promise<string[] | null>;

    pathToBase64: (filePath: string) => Promise<string>;

    fetchImage: (url: string) => Promise<string>;

    osType: () => Promise<string>;

    autostartIsEnabled: () => Promise<boolean>;
    autostartSet: (enabled: boolean) => Promise<void>;

    relaunch: () => Promise<void>;

    updaterCheck: () => Promise<PendingUpdate | null>;
    updaterDownloadAndInstall: () => Promise<void>;
    onUpdaterDownloaded: (callback: () => void) => () => void;
}

interface Window {
    copall?: CopallApi;
}

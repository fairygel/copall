export interface NativePendingUpdate {
    version: string;
    downloadAndInstall: () => Promise<void>;
}

export function requireCopall() {
    if (!window.copall) {
        throw new Error('copall native bridge is not available');
    }

    return window.copall;
}

export async function hideWindow(): Promise<void> {
    await requireCopall().hideWindow();
}

export async function setAlwaysOnTop(flag: boolean): Promise<void> {
    await requireCopall().setAlwaysOnTop(flag);
}

export async function isAlwaysOnTop(): Promise<boolean> {
    return requireCopall().isAlwaysOnTop();
}

export async function openUrl(url: string): Promise<void> {
    await requireCopall().openUrl(url);
}

export async function openImageFiles(): Promise<string[] | null> {
    return requireCopall().openImageFiles();
}

export async function pathToBase64(filePath: string): Promise<string> {
    return requireCopall().pathToBase64(filePath);
}

export async function fetchImage(url: string): Promise<string> {
    return requireCopall().fetchImage(url);
}

export async function getOsTypeAsync(): Promise<string> {
    const platform = await requireCopall().osType();

    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'macos';

    return 'linux';
}

export async function autostartIsEnabled(): Promise<boolean> {
    return requireCopall().autostartIsEnabled();
}

export async function autostartSet(enabled: boolean): Promise<void> {
    await requireCopall().autostartSet(enabled);
}

export async function checkForUpdate(): Promise<NativePendingUpdate | null> {
    const pending = await requireCopall().updaterCheck();

    if (!pending) return null;

    return {
        version: pending.version,
        downloadAndInstall: () => requireCopall().updaterDownloadAndInstall(),
    };
}

export async function relaunchAfterUpdate(): Promise<void> {
    await requireCopall().relaunch();
}

export function onUpdaterDownloaded(callback: () => void): () => void {
    return requireCopall().onUpdaterDownloaded(callback);
}

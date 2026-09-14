import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { isIP, isIPv4, isIPv6 } from 'node:net';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = !app.isPackaged;
const START_IN_TRAY = process.argv.includes('--tray');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const authorizedPaths = new Set<string>();

app.setName('copall');

if (process.platform === 'linux') {
    app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform');
    app.commandLine.appendSwitch('ozone-platform', 'wayland');
}

log.transports.file.level = 'debug';
autoUpdater.logger = log;

function parseHttpUrl(rawUrl: string): URL {
    let parsed: URL;

    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('invalid URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`refusing to open unsafe scheme: ${parsed.protocol}`);
    }

    return parsed;
}

function isLoopbackAddress(address: string): boolean {
    if (isIPv4(address)) {
        const first = Number(address.split('.')[0]);

        return first === 127;
    }

    return address === '::1' || address.toLowerCase().startsWith('fe80:');
}

function isPrivateIPv4(address: string): boolean {
    const parts = address.split('.').map(Number);

    if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
        return true;
    }

    const [a, b] = parts;

    return (
        a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
    );
}

async function assertResolvesPublic(rawUrl: string): Promise<URL> {
    const parsed = parseHttpUrl(rawUrl);

    if (!parsed.hostname) throw new Error('URL has no hostname');

    if (isIP(parsed.hostname)) {
        if (isLoopbackAddress(parsed.hostname) || isIPv6(parsed.hostname)) {
            throw new Error('refusing to fetch non-public address');
        }

        if (isIPv4(parsed.hostname) && isPrivateIPv4(parsed.hostname)) {
            throw new Error('refusing to fetch non-public address');
        }

        return parsed;
    }

    const name = parsed.hostname.toLowerCase();

    if (name === 'localhost' || name.endsWith('.localhost') || name.endsWith('.local')) {
        throw new Error('refusing to fetch non-public host');
    }

    let records: string[];

    try {
        records = await lookup(parsed.hostname, { all: true }).then(r =>
            r.map(entry => entry.address)
        );
    } catch {
        throw new Error('could not resolve host');
    }

    for (const address of records) {
        if (isLoopbackAddress(address)) {
            throw new Error('host resolves to a non-public address');
        }

        if (isIPv6(address) || (isIPv4(address) && isPrivateIPv4(address))) {
            throw new Error('host resolves to a non-public address');
        }
    }

    return parsed;
}

function createWindow() {
    const windowIcon = isDev
        ? path.join(__dirname, '../../electron/icon.png')
        : path.join(process.resourcesPath, 'icon.png');

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 500,
        minHeight: 400,
        title: 'copall',
        frame: false,
        transparent: true,
        resizable: true,
        show: false,
        autoHideMenuBar: true,
        icon: windowIcon,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:1420');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    mainWindow.on('ready-to-show', () => {
        if (START_IN_TRAY) {
            mainWindow?.hide();
        } else {
            mainWindow?.show();
            mainWindow?.focus();
        }
    });

    mainWindow.on('close', event => {
        event.preventDefault();
        mainWindow?.hide();
    });
}

function createTray() {
    const iconPath = isDev
        ? path.join(__dirname, '../../electron/tray-icon.png')
        : path.join(process.resourcesPath, 'tray-icon.png');
    const icon = nativeImage.createFromPath(iconPath);

    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    tray.setToolTip('copall');

    const menu = Menu.buildFromTemplate([
        {
            label: 'Open Chat',
            click: () => {
                mainWindow?.show();
                mainWindow?.focus();
            },
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                tray?.destroy();
                tray = null;
                mainWindow?.destroy();
                app.quit();
            },
        },
    ]);

    tray.setContextMenu(menu);

    tray.on('click', () => {
        mainWindow?.show();
        mainWindow?.focus();
    });
}

function registerIpc() {
    ipcMain.handle('window:hide', () => {
        mainWindow?.hide();
    });

    ipcMain.handle('window:set-always-on-top', (_event, flag: boolean) => {
        mainWindow?.setAlwaysOnTop(flag);
    });

    ipcMain.handle('window:is-always-on-top', () => {
        return mainWindow?.isAlwaysOnTop() ?? false;
    });

    ipcMain.handle('shell:open-url', (_event, url: string) => {
        return shell.openExternal(parseHttpUrl(url).toString());
    });

    ipcMain.handle('dialog:open-files', async () => {
        if (!mainWindow) return null;

        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Choose Image to send',
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
        });

        if (result.canceled || result.filePaths.length === 0) return null;

        for (const filePath of result.filePaths) authorizedPaths.add(path.resolve(filePath));

        return result.filePaths;
    });

    ipcMain.handle('fs:path-to-base64', async (_event, filePath: string) => {
        if (typeof filePath !== 'string' || filePath.length === 0) {
            throw new Error('invalid file path');
        }

        const resolved = path.resolve(filePath);

        if (!authorizedPaths.has(resolved)) {
            throw new Error('file was not selected via the open dialog');
        }

        const fileStat = await stat(resolved);

        if (!fileStat.isFile()) throw new Error('not a file');

        const bytes = await readFile(resolved);

        return bytes.toString('base64');
    });

    ipcMain.handle('net:fetch-image', async (_event, url: string) => {
        const parsed = await assertResolvesPublic(url);

        const response = await fetch(parsed.toString(), {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            },
        });

        if (!response.ok) {
            throw new Error(`image server returned HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type') ?? '';

        if (!contentType.startsWith('image/')) {
            throw new Error(`URL is not an image (content-type: ${contentType})`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        return `${contentType};${buffer.toString('base64')}`;
    });

    ipcMain.handle('os:type', () => {
        return process.platform;
    });

    ipcMain.handle('autostart:is-enabled', () => {
        return app.getLoginItemSettings().openAtLogin;
    });

    ipcMain.handle('autostart:set', (_event, enabled: boolean) => {
        app.setLoginItemSettings({
            openAtLogin: enabled,
            args: enabled ? ['--tray'] : [],
        });
    });

    ipcMain.handle('app:relaunch', () => {
        autoUpdater.quitAndInstall();
    });

    ipcMain.handle('updater:check', async () => {
        if (isDev) return null;

        try {
            const result = await autoUpdater.checkForUpdates();

            if (!result?.updateInfo) return null;

            return { version: result.updateInfo.version };
        } catch (e) {
            log.error('update check failed:', e);

            return null;
        }
    });

    ipcMain.handle('updater:download-and-install', async () => {
        await autoUpdater.downloadUpdate();
    });

    autoUpdater.on('update-downloaded', () => {
        mainWindow?.webContents.send('updater:downloaded');
    });
}

function registerSingleInstance() {
    const gotLock = app.requestSingleInstanceLock();

    if (!gotLock) {
        app.quit();

        return false;
    }

    app.on('second-instance', () => {
        mainWindow?.show();
        mainWindow?.focus();
    });

    return true;
}

if (!registerSingleInstance()) {
} else {
    app.whenReady().then(() => {
        registerIpc();
        createWindow();
        createTray();

        if (!isDev) {
            autoUpdater.checkForUpdatesAndNotify().catch(e => log.error('updater error:', e));
        }
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            tray?.destroy();
            tray = null;
            app.quit();
        }
    });

    app.on('activate', () => {
        mainWindow?.show();
        mainWindow?.focus();
    });
}

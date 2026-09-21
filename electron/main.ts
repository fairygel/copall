import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import path from 'node:path';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
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
autoUpdater.autoDownload = false;

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

function isNewerVersion(latest: string, current: string) {
    const parse = (v: string) =>
        v.split('.').map(part => {
            const match = /^(\d+)(.*)$/.exec(part.trim());
            return { num: match ? Number(match[1]) : 0, suffix: match ? match[2] : part };
        });
    const a = parse(latest);
    const b = parse(current);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const x = a[i] ?? { num: 0, suffix: '' };
        const y = b[i] ?? { num: 0, suffix: '' };
        if (x.num !== y.num) return x.num > y.num;
        if (x.suffix !== y.suffix) {
            if (!x.suffix) return true;
            if (!y.suffix) return false;
            return x.suffix > y.suffix;
        }
    }
    return false;
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

    const LANGSEARCH_BASE_URL = 'https://api.langsearch.com/v1';

    ipcMain.handle('net:search-web', async (_event, query: string, apiKey: string) => {
        if (typeof query !== 'string' || query.trim().length === 0) {
            throw new Error('invalid search query');
        }

        if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
            throw new Error('LangSearch API key is missing');
        }

        const trimmed = query.trim().slice(0, 400);

        try {
            const response = await fetch(`${LANGSEARCH_BASE_URL}/web-search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey.trim()}`,
                },
                body: JSON.stringify({
                    query: trimmed,
                    count: 5,
                }),
            });

            if (response.status === 401 || response.status === 403) {
                throw new Error('LangSearch API key is invalid or has no access (check settings)');
            }

            if (response.status === 429) {
                throw new Error('LangSearch rate limit exceeded, try again later');
            }

            if (!response.ok) {
                let details = '';
                try {
                    const err = (await response.json()) as {
                        message?: unknown;
                        msg?: unknown;
                    };
                    if (typeof err.message === 'string') details = err.message;
                    else if (typeof err.msg === 'string') details = err.msg;
                } catch {
                    details = response.statusText;
                }
                throw new Error(`LangSearch returned HTTP ${response.status}: ${details}`);
            }

            const data = (await response.json()) as {
                data?: { webPages?: { value?: unknown } };
            };

            const raw = data.data?.webPages?.value;
            const values = Array.isArray(raw) ? raw : [];

            const results = values
                .slice(0, 5)
                .map(item => {
                    const entry = item as {
                        name?: unknown;
                        url?: unknown;
                        snippet?: unknown;
                        text?: unknown;
                        datePublished?: unknown;
                    };
                    const title = typeof entry.name === 'string' ? entry.name : '';
                    const url = typeof entry.url === 'string' ? entry.url : '';
                    const snippet =
                        typeof entry.snippet === 'string'
                            ? entry.snippet
                            : typeof entry.text === 'string'
                              ? entry.text
                              : '';
                    const date =
                        typeof entry.datePublished === 'string' ? entry.datePublished : '';
                    return {
                        title,
                        url,
                        snippet: (date ? `[${date.slice(0, 10)}] ` : '') + snippet.slice(0, 250),
                    };
                })
                .filter(r => r.url);

            if (results.length === 0) throw new Error('LangSearch returned no results');

            return results;
        } catch (e) {
            if (e instanceof Error && e.message.startsWith('LangSearch')) throw e;
            log.error('web search failed:', e);
            throw new Error('web search failed, please try again later');
        }
    });

    function cleanText(text: string): string {
        return text
            .replace(/[ \t\f\v ]+/g, ' ')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');
    }

    function stripHtml(html: string): string {
        let text = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
            .replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/<[^>]+>/g, ' ');

        text = text
            .replace(/&#(\d+);/g, (_m, dec: string) => {
                const code = Number(dec);
                return Number.isSafeInteger(code) ? String.fromCodePoint(code) : _m;
            })
            .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => {
                const code = parseInt(hex, 16);
                return Number.isSafeInteger(code) ? String.fromCodePoint(code) : _m;
            })
            .replace(/&(quot|amp|lt|gt|apos|nbsp);/g, (m, name: string) => {
                const named: Record<string, string> = {
                    quot: '"',
                    amp: '&',
                    lt: '<',
                    gt: '>',
                    apos: "'",
                    nbsp: ' ',
                };
                return named[name] ?? m;
            });

        return cleanText(text);
    }

    async function extractReadable(html: string, url: string): Promise<string | null> {
        try {
            const { JSDOM } = await import('jsdom');
            const { Readability } = await import('@mozilla/readability');

            const doc = new JSDOM(html, { url }).window.document;
            const article = new Readability(doc).parse();

            const text = article?.textContent;
            if (!text) return null;

            const cleaned = cleanText(text);
            return cleaned.length >= 200 ? cleaned : null;
        } catch (e) {
            log.warn(`[page] readability failed for ${url}:`, e);
            return null;
        }
    }

    const MAX_PAGE_BYTES = 3 * 1024 * 1024;
    const PAGE_FETCH_TIMEOUT_MS = 20000;

    async function readBoundedBody(response: Response): Promise<string> {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Page has no readable text');

        const decoder = new TextDecoder();
        let received = 0;
        let text = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            received += value.byteLength;
            if (received > MAX_PAGE_BYTES) {
                await reader.cancel().catch(() => {});
                throw new Error('Page is too large');
            }

            text += decoder.decode(value, { stream: true });
        }

        return text + decoder.decode();
    }

    ipcMain.handle('net:fetch-page', async (_event, url: string) => {
        let parsed: URL;

        try {
            parsed = new URL(url);
        } catch {
            throw new Error('invalid page URL');
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('refusing to open unsafe scheme');
        }

        await assertResolvesPublic(parsed.toString());

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS);

        try {
            const response = await fetch(parsed.toString(), {
                signal: controller.signal,
                redirect: 'manual',
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                    Accept: 'text/html,application/xhtml+xml',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
            });

            if (response.status >= 300 && response.status < 400) {
                throw new Error('Page redirects elsewhere, open the final URL instead');
            }

            if (!response.ok) {
                throw new Error(`Page fetch failed: HTTP ${response.status}`);
            }

            const contentType = response.headers.get('content-type') ?? '';
            if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
                throw new Error(`Not an HTML page (content-type: ${contentType})`);
            }

            const html = await readBoundedBody(response);
            const titleMatch = /<title[^>]*>([\s\S]{0,500}?)<\/title>/i.exec(html);
            const title = titleMatch
                ? titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 200)
                : parsed.toString();

            const readable = await extractReadable(html, parsed.toString());
            const text = (readable ?? stripHtml(html)).slice(0, 6000);

            if (!text) throw new Error('Page has no readable text');

            return { url: parsed.toString(), title, text };
        } catch (e) {
            if (
                e instanceof Error &&
                /Page|invalid|refusing|readable|too large|redirects|AbortError|aborted/i.test(
                    e.message
                )
            ) {
                if (/abort/i.test(e.message)) throw new Error('Page fetch timed out');
                throw e;
            }
            log.error('page fetch failed:', e);
            throw new Error('page fetch failed, please try again later');
        } finally {
            clearTimeout(timeout);
        }
    });

    ipcMain.handle('os:type', () => {
        return process.platform;
    });

    const AUTOSTART_ARGS = ['--tray'];
    const AUTOSTART_DESKTOP_FILE = 'copall.desktop';

    function getAutostartDesktopPath() {
        return path.join(app.getPath('home'), '.config', 'autostart', AUTOSTART_DESKTOP_FILE);
    }

    async function isLinuxAutostartEnabled() {
        try {
            await stat(getAutostartDesktopPath());
            return true;
        } catch {
            return false;
        }
    }

    async function setLinuxAutostart(enabled: boolean) {
        const desktopPath = getAutostartDesktopPath();
        if (!enabled) {
            try {
                await unlink(desktopPath);
            } catch (e: unknown) {
                if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
            }
            return false;
        }
        const execPath = process.env.APPIMAGE ?? process.execPath;
        const entry = [
            '[Desktop Entry]',
            'Type=Application',
            'Version=1.0',
            'Name=copall',
            `Exec="${execPath}" --tray`,
            'Terminal=false',
            'X-GNOME-Autostart-enabled=true',
            'NoDisplay=false',
            '',
        ].join('\n');
        await mkdir(path.dirname(desktopPath), { recursive: true });
        await writeFile(desktopPath, entry);
        return true;
    }

    ipcMain.handle('autostart:is-enabled', () => {
        if (process.platform === 'linux') return isLinuxAutostartEnabled();
        return app.getLoginItemSettings({ args: AUTOSTART_ARGS }).openAtLogin;
    });

    ipcMain.handle('autostart:set', (_event, enabled: boolean) => {
        if (process.platform === 'linux') return setLinuxAutostart(enabled);
        app.setLoginItemSettings({
            openAtLogin: enabled,
            args: AUTOSTART_ARGS,
        });

        return app.getLoginItemSettings({ args: AUTOSTART_ARGS }).openAtLogin;
    });

    ipcMain.handle('app:relaunch', () => {
        autoUpdater.quitAndInstall();
    });

    ipcMain.handle('updater:check', async () => {
        if (isDev) return null;

        try {
            const result = await autoUpdater.checkForUpdates();

            if (!result?.updateInfo) return null;

            if (!isNewerVersion(result.updateInfo.version, app.getVersion())) return null;

            return { version: result.updateInfo.version };
        } catch (e) {
            log.error('update check failed:', e);

            return null;
        }
    });

    ipcMain.handle('updater:download-and-install', async () => {
        await autoUpdater.downloadUpdate();
    });

    autoUpdater.on('download-progress', info => {
        mainWindow?.webContents.send('updater:download-progress', { percent: info.percent });
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

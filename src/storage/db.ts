import Chat, { ChatMeta } from '../models/Chat';
import Message from '../models/message';

const DB_NAME = 'copall';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
            const db = req.result;

            if (!db.objectStoreNames.contains('chatMetas')) {
                db.createObjectStore('chatMetas', { keyPath: 'id' });
            }

            if (!db.objectStoreNames.contains('chatMessages')) {
                db.createObjectStore('chatMessages', { keyPath: 'id' });
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function runTransaction(
    stores: string[],
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction) => void
): Promise<void> {
    return openDb().then(
        db =>
            new Promise<void>((resolve, reject) => {
                const tx = db.transaction(stores, mode);

                tx.oncomplete = () => {
                    db.close();
                    resolve();
                };
                tx.onerror = () => {
                    db.close();
                    reject(tx.error);
                };
                tx.onabort = () => {
                    db.close();
                    reject(tx.error);
                };

                work(tx);
            })
    );
}

export async function createChat(name = 'New Chat'): Promise<Chat> {
    const id = crypto.randomUUID();
    const now = Date.now();

    const meta: ChatMeta = { id, name, createdAt: now, updatedAt: now };

    await runTransaction(['chatMetas', 'chatMessages'], 'readwrite', tx => {
        tx.objectStore('chatMetas').add(meta);
        tx.objectStore('chatMessages').add({ id, messages: [] as Message[] });
    });

    return { ...meta, messages: [] };
}

export async function getChat(id: string): Promise<Chat | null> {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(['chatMetas', 'chatMessages'], 'readonly');

        let meta: ChatMeta | undefined;
        let raw: { id: string; messages: Message[] } | undefined;

        const metaReq = tx.objectStore('chatMetas').get(id);
        metaReq.onsuccess = () => {
            meta = metaReq.result;
        };

        const msgReq = tx.objectStore('chatMessages').get(id);
        msgReq.onsuccess = () => {
            raw = msgReq.result;
        };

        tx.oncomplete = () => {
            db.close();
            if (!meta) resolve(null);
            else resolve({ ...meta, messages: raw?.messages ?? [] });
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
        tx.onabort = () => {
            db.close();
            reject(tx.error);
        };
    });
}

export async function saveChat(chat: Chat): Promise<void> {
    const meta: ChatMeta = {
        id: chat.id,
        name: chat.name,
        createdAt: chat.createdAt,
        updatedAt: Date.now(),
    };

    await runTransaction(['chatMetas', 'chatMessages'], 'readwrite', tx => {
        tx.objectStore('chatMetas').put(meta);
        tx.objectStore('chatMessages').put({ id: chat.id, messages: chat.messages });
    });
}

const CURRENT_CHAT_KEY = 'currentChatId';

export function getCurrentChatId(): string | null {
    return localStorage.getItem(CURRENT_CHAT_KEY);
}

export function setCurrentChatId(id: string): void {
    localStorage.setItem(CURRENT_CHAT_KEY, id);
}

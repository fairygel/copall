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

function cleanNullAttachments(messages: Message[]): Message[] {
    return messages.map(msg => {
        if (!msg.attachments?.length) return msg;

        const live = msg.attachments.filter(file => file.base64);

        if (live.length === msg.attachments.length) return msg;

        if (live.length === 0) {
            const { attachments, ...rest } = msg;
            void attachments;
            return rest;
        }

        return { ...msg, attachments: live };
    });
}

function lastMessageAtOf(messages: Message[]): number | undefined {
    let latest: number | undefined;
    for (const msg of messages) {
        const at = msg.createdAt;
        if (typeof at !== 'number') continue;
        if (latest === undefined || at > latest) latest = at;
    }
    return latest;
}

export function sortChatMetas<T extends Pick<ChatMeta, 'lastMessageAt' | 'createdAt'>>(
    metas: T[]
): T[] {
    return metas.slice().sort((a, b) => {
        const aKey = a.lastMessageAt ?? Number.NEGATIVE_INFINITY;
        const bKey = b.lastMessageAt ?? Number.NEGATIVE_INFINITY;
        if (bKey !== aKey) return bKey - aKey;
        return b.createdAt - a.createdAt;
    });
}

export function deleteChat(id: string): Promise<void> {
    return runTransaction(['chatMetas', 'chatMessages'], 'readwrite', tx => {
        tx.objectStore('chatMetas').delete(id);
        tx.objectStore('chatMessages').delete(id);
    });
}

export function createEphemeralChat(name = 'New Chat'): Chat {
    const now = Date.now();
    const id = crypto.randomUUID();

    return { id, name, createdAt: now, updatedAt: now, messages: [] };
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
            else resolve({ ...meta, messages: cleanNullAttachments(raw?.messages ?? []) });
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
    const messages = cleanNullAttachments(chat.messages);
    const lastMessageAt = lastMessageAtOf(messages);
    const meta: ChatMeta = {
        id: chat.id,
        name: chat.name,
        createdAt: chat.createdAt,
        updatedAt: Date.now(),
        ...(lastMessageAt !== undefined ? { lastMessageAt } : {}),
    };

    await runTransaction(['chatMetas', 'chatMessages'], 'readwrite', tx => {
        tx.objectStore('chatMetas').put(meta);
        tx.objectStore('chatMessages').put({
            id: chat.id,
            messages,
        });
    });
}

export async function getAllChatMetas(): Promise<ChatMeta[]> {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(['chatMetas'], 'readonly');
        const req = tx.objectStore('chatMetas').getAll();

        req.onsuccess = () => {
            resolve(sortChatMetas((req.result ?? []) as ChatMeta[]));
        };
        req.onerror = () => reject(req.error);

        tx.oncomplete = () => db.close();
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

const CURRENT_CHAT_KEY = 'currentChatId';

export function getCurrentChatId(): string | null {
    return localStorage.getItem(CURRENT_CHAT_KEY);
}

export function setCurrentChatId(id: string): void {
    localStorage.setItem(CURRENT_CHAT_KEY, id);
}

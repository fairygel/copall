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
            return { id: msg.id, content: msg.content, sender: msg.sender };
        }

        return { ...msg, attachments: live };
    });
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
    const meta: ChatMeta = {
        id: chat.id,
        name: chat.name,
        createdAt: chat.createdAt,
        updatedAt: Date.now(),
    };

    await runTransaction(['chatMetas', 'chatMessages'], 'readwrite', tx => {
        tx.objectStore('chatMetas').put(meta);
        tx.objectStore('chatMessages').put({
            id: chat.id,
            messages: cleanNullAttachments(chat.messages),
        });
    });
}

export async function getAllChatMetas(): Promise<ChatMeta[]> {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(['chatMetas'], 'readonly');
        const req = tx.objectStore('chatMetas').getAll();

        req.onsuccess = () => {
            const metas = ((req.result ?? []) as ChatMeta[]).slice();
            metas.sort((a, b) => b.updatedAt - a.updatedAt);
            resolve(metas);
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

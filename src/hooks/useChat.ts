import { useState, useEffect, useRef } from 'react';
import Chat from '../models/Chat';
import Message from '../models/message';
import {
    createEphemeralChat,
    deleteChat,
    getChat,
    saveChat,
    getCurrentChatId,
    setCurrentChatId,
} from '../storage/db';

export function useChat() {
    const [chat, setChat] = useState<Chat | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    const initPromise = useRef<Promise<void> | null>(null);

    useEffect(() => {
        async function init() {
            const id = getCurrentChatId();

            if (id) {
                const existing = await getChat(id);
                if (existing) {
                    persistedIds.current.add(existing.id);
                    setChat(existing);
                    setIsLoaded(true);
                    return;
                }
            }

            const fresh = createEphemeralChat();
            setCurrentChatId(fresh.id);
            setChat(fresh);
            setIsLoaded(true);
        }

        initPromise.current = init().catch(e => {
            console.error('Failed to load chat:', e);
            setIsLoaded(true);
        });
    }, []);

    const saveTimeout = useRef<number | null>(null);
    const chatRef = useRef<Chat | null>(null);
    const persistedIds = useRef<Set<string>>(new Set());
    const dirtyRef = useRef(false);

    const isPersisted = (id: string) => persistedIds.current.has(id);

    const saveIfPersisted = (chatToSave: Chat): Promise<void> => {
        if (!isPersisted(chatToSave.id)) return Promise.resolve();
        return saveChat(chatToSave).catch(e => console.error('Failed to save chat:', e));
    };

    useEffect(() => {
        if (chat && chat.messages.length > 0) persistedIds.current.add(chat.id);
    }, [chat]);

    useEffect(() => {
        chatRef.current = chat;
    }, [chat]);

    useEffect(() => {
        if (!isLoaded || !chat) return;
        if (!dirtyRef.current) return;

        if (saveTimeout.current) window.clearTimeout(saveTimeout.current);

        const chatToSave = chat;
        saveTimeout.current = window.setTimeout(() => {
            saveTimeout.current = null;
            dirtyRef.current = false;
            saveIfPersisted(chatToSave);
        }, 300);

        return () => {
            if (saveTimeout.current) {
                window.clearTimeout(saveTimeout.current);
                saveTimeout.current = null;
            }
        };
    }, [chat, isLoaded]);

    useEffect(() => {
        return () => {
            if (chatRef.current && dirtyRef.current) {
                dirtyRef.current = false;
                saveIfPersisted(chatRef.current);
            }
        };
    }, []);

    const setMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
        dirtyRef.current = true;
        setChat(prevChatState => {
            if (!prevChatState) return prevChatState;

            const next =
                typeof updater === 'function'
                    ? (updater as (p: Message[]) => Message[])(prevChatState.messages)
                    : updater;

            return { ...prevChatState, messages: next };
        });
    };

    const setChatName = (name: string) => {
        dirtyRef.current = true;
        setChat(prevChatState => (prevChatState ? { ...prevChatState, name } : prevChatState));
    };

    useEffect(() => {
        const handleBeforeUnload = () => {
            if (chatRef.current && dirtyRef.current) {
                dirtyRef.current = false;
                saveIfPersisted(chatRef.current);
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    const flushCurrent = async (reason: string) => {
        const current = chatRef.current;
        if (!current || !dirtyRef.current) return;
        dirtyRef.current = false;
        if (current.messages.length === 0) {
            if (isPersisted(current.id)) {
                try {
                    await deleteChat(current.id);
                } catch (e) {
                    console.error(`Failed to drop empty chat on ${reason}:`, e);
                }
                persistedIds.current.delete(current.id);
            }
            return;
        }
        try {
            await saveChat(current);
        } catch (e) {
            console.error(`Failed to flush chat before ${reason}:`, e);
        }
    };

    const createNewChat = async () => {
        await initPromise.current;
        if (saveTimeout.current) {
            window.clearTimeout(saveTimeout.current);
            saveTimeout.current = null;
        }
        await flushCurrent('creating new chat');
        const fresh = createEphemeralChat();
        setCurrentChatId(fresh.id);
        setChat(fresh);
    };

    const openChat = async (id: string) => {
        await initPromise.current;
        if (chatRef.current?.id === id) return;
        if (saveTimeout.current) {
            window.clearTimeout(saveTimeout.current);
            saveTimeout.current = null;
        }
        await flushCurrent('opening another chat');
        const existing = await getChat(id);
        if (!existing) {
            console.error('Failed to open chat: not found');
            return;
        }
        persistedIds.current.add(existing.id);
        setCurrentChatId(existing.id);
        setChat(existing);
    };

    const removeChat = async (id: string) => {
        await initPromise.current;
        const isCurrent = chatRef.current?.id === id;
        if (isCurrent) {
            if (saveTimeout.current) {
                window.clearTimeout(saveTimeout.current);
                saveTimeout.current = null;
            }
            dirtyRef.current = false;
        }
        try {
            await deleteChat(id);
        } catch (e) {
            console.error('Failed to delete chat:', e);
            throw e;
        }
        persistedIds.current.delete(id);
        if (isCurrent) {
            const fresh = createEphemeralChat();
            setCurrentChatId(fresh.id);
            setChat(fresh);
        }
    };

    return {
        chatId: chat?.id ?? null,
        messages: chat?.messages ?? [],
        chatName: chat?.name ?? '',
        setMessages,
        setChatName,
        createNewChat,
        openChat,
        removeChat,
    };
}

import { useState, useEffect, useRef } from 'react';
import Chat from '../models/Chat';
import Message from '../models/message';
import { createChat, getChat, saveChat, getCurrentChatId, setCurrentChatId } from '../storage/db';

export function useChat() {
    const [chat, setChat] = useState<Chat | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        async function init() {
            const id = getCurrentChatId();

            if (id) {
                const existing = await getChat(id);
                if (existing) {
                    setChat(existing);
                    setIsLoaded(true);
                    return;
                }
            }

            const fresh = await createChat();
            setCurrentChatId(fresh.id);
            setChat(fresh);
            setIsLoaded(true);
        }

        init().catch(e => {
            console.error('Failed to load chat:', e);
            setIsLoaded(true);
        });
    }, []);

    const saveTimeout = useRef<number | null>(null);
    const chatRef = useRef<Chat | null>(null);

    useEffect(() => {
        chatRef.current = chat;
    }, [chat]);

    useEffect(() => {
        if (!isLoaded || !chat) return;

        if (saveTimeout.current) window.clearTimeout(saveTimeout.current);

        const chatToSave = chat;
        saveTimeout.current = window.setTimeout(() => {
            saveChat(chatToSave).catch(e => console.error('Failed to save chat:', e));
        }, 300);

        return () => {
            if (saveTimeout.current) {
                window.clearTimeout(saveTimeout.current);
                saveTimeout.current = null;
              
                if (chatRef.current) {
                    saveChat(chatRef.current).catch(e => console.error('Failed to flush chat on unmount:', e));
                }
            }
        };
    }, [chat, isLoaded]);

    const setMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
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
        setChat(prevChatState => (prevChatState ? { ...prevChatState, name } : prevChatState));
    };

    useEffect(() => {
        const handleBeforeUnload = () => {
            if (chatRef.current) {
                saveChat(chatRef.current).catch(() => {});
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    const createNewChat = async () => {
        if (saveTimeout.current) {
            window.clearTimeout(saveTimeout.current);
            saveTimeout.current = null;
        }
        const current = chatRef.current;
        if (current) {
            try {
                await saveChat(current);
            } catch (e) {
                console.error('Failed to flush chat before creating new chat:', e);
            }
        }
        const fresh = await createChat();
        setCurrentChatId(fresh.id);
        setChat(fresh);
    };

    return {
        messages: chat?.messages ?? [],
        chatName: chat?.name ?? '',
        setMessages,
        setChatName,
        createNewChat,
    };
}

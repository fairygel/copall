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

    useEffect(() => {
        if (!isLoaded || !chat) return;

        if (saveTimeout.current) window.clearTimeout(saveTimeout.current);

        saveTimeout.current = window.setTimeout(() => {
            saveChat(chat).catch(e => console.error('Failed to save chat:', e));
        }, 300);

        return () => {
            if (saveTimeout.current) window.clearTimeout(saveTimeout.current);
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

    const createNewChat = async () => {
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

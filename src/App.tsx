import './App.css';

import Header from './components/header/Header';
import Settings from './components/settings/Settings';
import ApiKeys from './components/settings/ApiKeys';
import MessageBox from './components/messageBox/MessageBox';
import Chat from './components/chat/Chat';

import AiModel from './models/AiModel';

import { generateAssistantResponse, generateChatTitle } from './service/ChatService';

import { useEffect, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useChat } from './hooks/useChat';
import UpdateDialog from './components/update/UpdateDialog';

function App() {
    const [settingsView, setSettingsView] = useState<'settings' | 'apiKeys' | null>(null);
    const [isSendMessageDisabled, setSendMessageDisabled] = useState(false);
    const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const update = await check();
                if (update) setPendingUpdate(update);
            } catch (e) {
                console.error('update check failed:', e);
            }
        })();
    }, []);

    const handleUpdate = async () => {
        if (!pendingUpdate) return;
        try {
            await pendingUpdate.downloadAndInstall();
            await relaunch();
        } catch (e) {
            console.error('update install failed:', e);
            setPendingUpdate(null);
        }
    };
  
    const { messages, chatName, setMessages, setChatName, createNewChat } = useChat();

    const generateTitle = async (message: string, model: AiModel) => {
        if (!message || !model) return;
        try {
            setChatName(await generateChatTitle(message, model.id));
        } catch (e) {
            console.error('Failed to generate chat title:', e);
        }
    };

    const handleSendMessage = async (content: string, selectedModel: AiModel) => {
        if (!selectedModel) return;

        setSendMessageDisabled(true);

        const isFirstMessage = messages.length === 0;

        const newMessage = {
            id: crypto.randomUUID(),
            content,
            sender: 'user' as const,
        };

        const updatedMessages = [...messages, newMessage];
        setMessages(updatedMessages);

        try {
            const response = await generateAssistantResponse(
                updatedMessages,
                selectedModel.id,
                setMessages as any
            );

            if (isFirstMessage && response) {
                await generateTitle(response, selectedModel);
            }
        } catch (e) {
            console.log(e);
        } finally {
            setSendMessageDisabled(false);
        }
    };

    const handleNewChat = async () => {
        await createNewChat();
        setSendMessageDisabled(false);
    };

    return (
      <main>
            {pendingUpdate && (
                <UpdateDialog
                    version={pendingUpdate.version}
                    onUpdate={handleUpdate}
                    onLater={() => setPendingUpdate(null)}
                />
            )}
            {settingsView === 'settings' && (
                <Settings
                    onClose={() => setSettingsView(null)}
                    onManageApiKeys={() => setSettingsView('apiKeys')}
                />
            )}
            {settingsView === 'apiKeys' && (
                <ApiKeys
                    onBack={() => setSettingsView('settings')}
                    onClose={() => setSettingsView(null)}
                />
            )}
            <Header
                chatName={chatName}
                onSettingsClick={() => setSettingsView('settings')}
                onNewChatClick={handleNewChat}
            />

            <Chat messages={messages} />

            <MessageBox onMessageSent={handleSendMessage} disabled={isSendMessageDisabled} />
        </main>
    );
}

export default App;

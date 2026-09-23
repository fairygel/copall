import './App.css';

import Header from './components/header/Header';
import Sidebar from './components/sidebar/Sidebar';
import Settings from './components/settings/Settings';
import ApiKeys from './components/settings/ApiKeys';
import MessageBox from './components/messageBox/MessageBox';
import Chat from './components/chat/Chat';

import AiModel from './models/AiModel';
import AttachedFile from './models/AttachedFile';

import { generateAssistantResponse, generateChatTitle } from './service/ChatService';

import { useEffect, useState } from 'react';
import {
    checkForUpdate,
    onUpdaterDownloaded,
    onUpdaterDownloadProgress,
    relaunchAfterUpdate,
    type NativePendingUpdate,
} from './service/NativeBridge';
import { useChat } from './hooks/useChat';
import UpdateDialog from './components/update/UpdateDialog';

function App() {
    const [settingsView, setSettingsView] = useState<'settings' | 'apiKeys' | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSendMessageDisabled, setSendMessageDisabled] = useState(false);
    const [pendingUpdate, setPendingUpdate] = useState<NativePendingUpdate | null>(null);
    const [updateDownloadState, setUpdateDownloadState] = useState<
        'idle' | 'downloading' | 'downloaded'
    >('idle');
    const [updateDownloadPercent, setUpdateDownloadPercent] = useState(0);

    useEffect(() => {
        (async () => {
            try {
                const update = await checkForUpdate();
                if (update) setPendingUpdate(update);
            } catch (e) {
                console.error('update check failed:', e);
            }
        })();

        const offProgress = onUpdaterDownloadProgress(percent => {
            setUpdateDownloadState('downloading');
            setUpdateDownloadPercent(Math.round(percent));
        });

        const offDownloaded = onUpdaterDownloaded(() => {
            setUpdateDownloadState('downloaded');
            relaunchAfterUpdate().catch(console.error);
        });

        return () => {
            offProgress();
            offDownloaded();
        };
    }, []);

    const handleUpdate = async () => {
        if (!pendingUpdate || updateDownloadState !== 'idle') return;
        setUpdateDownloadState('downloading');
        try {
            await pendingUpdate.downloadAndInstall();
        } catch (e) {
            console.error('update install failed:', e);
            setPendingUpdate(null);
            setUpdateDownloadState('idle');
        }
    };

    const handleUpdateLater = () => {
        setPendingUpdate(null);
        setUpdateDownloadState('idle');
        setUpdateDownloadPercent(0);
    };

    const { chatId, messages, chatName, setMessages, setChatName, createNewChat, openChat, removeChat } =
        useChat();

    const generateTitle = async (message: string, model: AiModel) => {
        if (!message || !model) return;
        try {
            setChatName(await generateChatTitle(message, model.id));
        } catch (e) {
            console.error('Failed to generate chat title:', e);
        }
    };

    const handleSendMessage = async (
        content: string,
        selectedModel: AiModel,
        files: AttachedFile[]
    ) => {
        if (!selectedModel) return;

        setSendMessageDisabled(true);

        const isFirstMessage = messages.length === 0;

        const liveFiles = files.filter(file => file.base64);

        const newMessage = {
            id: crypto.randomUUID(),
            content,
            sender: 'user' as const,
            createdAt: Date.now(),
            ...(liveFiles.length > 0 ? { attachments: liveFiles } : {}),
        };

        const updatedMessages = [...messages, newMessage];
        setMessages(updatedMessages);

        try {
            const response = await generateAssistantResponse(
                updatedMessages,
                selectedModel.id,
                setMessages
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
        setIsSidebarOpen(false);
        setSendMessageDisabled(false);
    };

    const handleOpenChat = async (id: string) => {
        await openChat(id);
        setIsSidebarOpen(false);
        setSendMessageDisabled(false);
    };

    const handleDeleteChat = async (id: string) => {
        await removeChat(id);
        setSendMessageDisabled(false);
    };

    return (
        <main>
            {pendingUpdate && (
                <UpdateDialog
                    version={pendingUpdate.version}
                    downloadState={updateDownloadState}
                    downloadPercent={updateDownloadPercent}
                    onUpdate={handleUpdate}
                    onLater={handleUpdateLater}
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
            <div className="appContent">
                <Header
                    chatName={chatName}
                    onMenuClick={() => setIsSidebarOpen(true)}
                    onNewChatClick={handleNewChat}
                />

                <Chat messages={messages} />

                <MessageBox
                    onMessageSent={handleSendMessage}
                    disabled={isSendMessageDisabled}
                    isSending={isSendMessageDisabled}
                />
            </div>
            <Sidebar
                isOpen={isSidebarOpen}
                currentChatId={chatId}
                onClose={() => setIsSidebarOpen(false)}
                onChatSelect={handleOpenChat}
                onChatDelete={handleDeleteChat}
                onSettingsClick={() => {
                    setIsSidebarOpen(false);
                    setSettingsView('settings');
                }}
            />
        </main>
    );
}

export default App;

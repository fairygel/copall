import './App.css';

import Header from './components/header/Header';
import Settings from './components/settings/Settings';
import ApiKeys from './components/settings/ApiKeys';
import MessageBox from './components/messageBox/MessageBox';
import Chat from './components/chat/Chat';

import Message from './models/message';
import AiModel from './models/AiModel';

import { generateAssistantResponse, generateChatTitle } from './service/ChatService';

import { useState } from 'react';

function App() {
    const [settingsView, setSettingsView] = useState<'settings' | 'apiKeys' | null>(null);
    const [isSendMessageDisabled, setSendMessageDisabled] = useState(false);

    const [model, setModel] = useState<AiModel | null>(null);

    const [chatName, setChatName] = useState('');

    const [messages, setMessages] = useState<Message[]>([]);

    const generateTitle = async (message: string) => {
        if (!message || !model) return;

        setChatName(await generateChatTitle(message, model.id));
    };

    const displayUserMessage = (content: string) => {
        const newMessage: Message = {
            id: crypto.randomUUID(),
            content,
            sender: 'user',
        };

        const updatedMessages = [...messages, newMessage];

        setMessages(updatedMessages);
        return updatedMessages;
    };

    const handleSendMessage = async (content: string) => {
        if (!model) return;

        setSendMessageDisabled(true);

        const isFirstMessage = messages.length === 0;
        const updatedMessages = displayUserMessage(content);

        try {
            const response = await generateAssistantResponse(
                updatedMessages,
                model.id,
                setMessages
            );

            if (isFirstMessage && response) {
                await generateTitle(response);
            }
        } catch (e) {
            console.log(e);
        } finally {
            setSendMessageDisabled(false);
        }
    };

    return (
        <main>
            {settingsView === 'settings' && (
                <Settings
                    onClose={() => {
                        setSettingsView(null);
                    }}
                    onManageApiKeys={() => {
                        setSettingsView('apiKeys');
                    }}
                />
            )}
            {settingsView === 'apiKeys' && (
                <ApiKeys
                    onBack={() => {
                        setSettingsView('settings');
                    }}
                    onClose={() => {
                        setSettingsView(null);
                    }}
                />
            )}
            <Header
                chatName={chatName}
                onSettingsClick={() => setSettingsView('settings')}
                onNewChatClick={() => {
                    setMessages([]);
                    setChatName('');
                    setSendMessageDisabled(false);
                }}
            />

            <Chat messages={messages} />

            <MessageBox
                onMessageSent={handleSendMessage}
                disabled={isSendMessageDisabled}
                onModelChange={setModel}
            />
        </main>
    );
}

export default App;

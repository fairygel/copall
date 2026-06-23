import "./App.css";

import Header from "./components/header/Header";
import Settings from "./components/settings/Settings";
import MessageBox from "./components/messageBox/MessageBox";
import Chat from './components/chat/Chat';

import Message from "./models/message";

import { generateAssistantResponse, generateChatTitle } from "./service/ChatService";

import { useState } from "react";

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSendMessageDisabled, setSendMessageDisabled] = useState(false);

  const [chatName, setChatName] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);

  const generateTitle = async (message: string) => {
    if (!message) return;
    
    setChatName(await generateChatTitle(message));
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
  }

  const handleSendMessage = async (content: string) => {
    setSendMessageDisabled(true);
    
    const isFirstMessage = messages.length === 0;
    const updatedMessages = displayUserMessage(content);

    const response = await generateAssistantResponse(updatedMessages, setMessages);

    setSendMessageDisabled(false);

    if (isFirstMessage && response) {
        await generateTitle(response);
    }
  }

  return (
    <main>
      {isSettingsOpen && <Settings onClose={() => setIsSettingsOpen(false)} />}
      <Header
        chatName={chatName}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onNewChatClick={() => {setMessages([]); setChatName(''); setSendMessageDisabled(false);}}
      />

      <Chat messages={messages} />

      <MessageBox onMessageSent={handleSendMessage} disabled={isSendMessageDisabled} />
    </main>
  )
}

export default App;


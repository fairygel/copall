import "./App.css";
import Header from "./components/header/Header";
import Settings from "./components/settings/Settings";
import { useState } from "react";
import Message from "./models/message";
import fetchMistralResponse from "./service/MistralService";
import MessageBox from "./components/messageBox/MessageBox";
import Chat from './components/chat/Chat';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSendMessageDisabled, setSendMessageDisabled] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);

  const appendToMessage = (id: string, chunk: string) => {
    setMessages(prev => prev.map(
      msg => msg.id === id ? { ...msg, content: msg.content + chunk } : msg
    ));
  };

  const setMessageContent = (id: string, content: string) => {
    setMessages(prev => prev.map(
      msg => msg.id === id ? { ...msg, content } : msg
    ));
  };

  const handleSendMessage = async (content: string) => {
    setSendMessageDisabled(true);

    const newMessage: Message = {
      id: crypto.randomUUID(),
      content,
      sender: 'user',
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);

    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantMessageId,
      content: 'working...',
      sender: 'assistant',
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      for await (const chunk of fetchMistralResponse(updatedMessages)) {
        appendToMessage(assistantMessageId, chunk);
      }
    } catch (error) {
      setMessageContent(assistantMessageId, (error as Error).message);
    } finally {
      setSendMessageDisabled(false);
    }
  }

  return (
    <main>
      {isSettingsOpen && <Settings onClose={() => setIsSettingsOpen(false)} />}
      <Header onSettingsClick={() => setIsSettingsOpen(true)} onNewChatClick={() => setMessages([])} />

      <Chat messages={messages} />

      <MessageBox onMessageSent={handleSendMessage} disabled={isSendMessageDisabled} />
    </main>
  )
}

export default App;

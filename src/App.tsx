import ReactMarkdown from 'react-markdown';
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

  const handleSendMessage = (content: string) => {
    setSendMessageDisabled(true);

    const newMessage: Message = {
      id: crypto.randomUUID(),
      content,
      sender: 'user',
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);

    fetchMistralResponse(updatedMessages).then((response) => {
      const newAIMessage: Message = {
        id: crypto.randomUUID(),
        content: response,
        sender: 'assistant',
      };
      setMessages((prevMessages) => [...prevMessages, newAIMessage]);
    }).catch((error) => {
      const newAIMessage: Message = {
        id: crypto.randomUUID(),
        content: error.message,
        sender: 'assistant',
      };
      setMessages((prevMessages) => [...prevMessages, newAIMessage]);
    }).finally(() => {
      setSendMessageDisabled(false);
    })
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

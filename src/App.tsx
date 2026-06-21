import { ArrowUp } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import "./App.css";
import Header from "./components/header/Header";
import Settings from "./components/settings/Settings";
import { useState } from "react";
import Message from "./models/message";
import fetchMistralResponse from "./service/MistralService";

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSendMessageDisabled, setSendMessageDisabled] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  
  const handleSendMessage = (content: string) => {
    setSendMessageDisabled(true);

    const newMessage: Message = {
      id: crypto.randomUUID(),
      content,
      sender: 'user',
    };
    setInputValue('');
    
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

      <div className="chatContainer">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender === 'user' ? 'userMessage' : 'aiMessage'}`}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        ))}
      </div>

      <div className="messageContainer">
        <textarea 
          className="inputArea" 
          placeholder="Your move, Ask!" 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <div className="tooltip">
          <button 
            className="sendMessage" 
            disabled={isSendMessageDisabled || inputValue.trim() === ''}
            onClick={() => handleSendMessage(inputValue)}>
            <ArrowUp size={24} color="white" />
          </button>
        </div>
      </div>
    </main>
  )
}

export default App;

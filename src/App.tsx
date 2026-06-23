import "./App.css";
import Header from "./components/header/Header";
import Settings from "./components/settings/Settings";
import { useState } from "react";
import Message from "./models/message";
import { fetchMistralStream, fetchMistralResponse } from "./service/MistralService";
import MessageBox from "./components/messageBox/MessageBox";
import Chat from './components/chat/Chat';

const GENERATE_CHAT_NAME_SYSTEM_PROMPT = 
    'Generate a concise chat title (max 40 chars) based on the user\'s message. ' +
    'The title must be in the SAME LANGUAGE as the user\'s text. ' +
    'Be specific and descriptive. No quotes or formatting. Output title only.\n\n' +
    'User: [message]\nTitle:';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSendMessageDisabled, setSendMessageDisabled] = useState(false);

  const [chatName, setChatName] = useState('');

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

  const generateTitle = async (message: Message) => {
    const prompt = GENERATE_CHAT_NAME_SYSTEM_PROMPT.replace('[message]', message.content);

    const systemMessage: Message = {
      id: crypto.randomUUID(),
      content: prompt,
      sender: 'system',
    };

    try {
      let title = await fetchMistralResponse([systemMessage, message]);
      const cleanTitle = title.trim().replace(/^["']|["']$/g, '');

      setChatName(cleanTitle);
    } catch (error) {
      console.error('Error generating chat title:', error);
    }

  };

  const handleSendMessage = async (content: string) => {
    setSendMessageDisabled(true);
    
    const isFirstMessage = messages.length === 0;

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

    let firstChunk = true;

    setMessages(prev => [...prev, assistantMessage]);

    try {
      for await (const chunk of fetchMistralStream(updatedMessages)) {
        if (firstChunk) {
          setMessageContent(assistantMessageId, chunk);
          firstChunk = false;
        } else {
          appendToMessage(assistantMessageId, chunk);
        }
      }
      console.log(messages.length);
      if (isFirstMessage) {
        await generateTitle(newMessage);
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
      <Header
        chatName={chatName}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onNewChatClick={() => {setMessages([]); setChatName('');}}
      />

      <Chat messages={messages} />

      <MessageBox onMessageSent={handleSendMessage} disabled={isSendMessageDisabled} />
    </main>
  )
}

export default App;


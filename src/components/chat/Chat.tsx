import ReactMarkdown from "react-markdown";
import Message from "../../models/message";
import './Chat.css';


function Chat({ messages }: { messages: Message[] }) {

    return (
      <div className="chatContainer">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender === 'user' ? 'userMessage' : 'aiMessage'}`}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        ))}
      </div>
    );
}

export default Chat;
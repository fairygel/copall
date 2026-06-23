import ReactMarkdown from "react-markdown";
import Message from "../../models/message";
import './Chat.css';
import { useEffect } from "react";
import React from "react";


function Chat({ messages }: { messages: Message[] }) {
    const bottomRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        messages.length === 0 ? (
            <div className="emptyContainer">
                <p>Copall.</p>
            </div>
        ) : (
        <div className="chatContainer">
            {messages.map((message) => (
                <div key={message.id} className={`message ${message.sender === 'user' ? 'userMessage' : 'aiMessage'}`}>
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
            ))}
            <div ref={bottomRef}></div>
        </div>
        )
    );
}

export default Chat;
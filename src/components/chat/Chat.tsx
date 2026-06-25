import ReactMarkdown from "react-markdown";
import Message from "../../models/message";
import './Chat.css';
import { useEffect } from "react";
import React from "react";
import { openUrl } from "@tauri-apps/plugin-opener";


function Chat({ messages }: { messages: Message[] }) {
    const bottomRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    const components = {
        a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
            if (!href || href.startsWith('#') || (!href.startsWith('http://') && !href.startsWith('https://'))) {
                return <a href={href}>{children}</a>;
            }

            const handleClick = (e: React.MouseEvent) => {
                e.preventDefault();
                openUrl(href).catch(console.error);
            };

            return (
                <a href={href} onClick={handleClick} style={{ cursor: 'pointer' }}>
                    {children}
                </a>
            );
        }
    }

    return (
        messages.length === 0 ? (
            <div className="emptyContainer">
                <img src="/copall_nobg.svg" alt="Me .-." className="logo" />
                <p>Copall.</p>
            </div>
        ) : (
        <div className="chatContainer">
            {messages.map((message) => (
                <div 
                    key={message.id} 
                    className={`message ${message.sender === 'user' ? 'userMessage' : 'aiMessage'}`}
                >
                    <ReactMarkdown components={components}>{message.content}</ReactMarkdown>
                </div>
            ))}
            <div ref={bottomRef}></div>
        </div>
        )
    );
}

export default Chat;
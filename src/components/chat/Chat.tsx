import ReactMarkdown from 'react-markdown';
import Message from '../../models/message';
import './Chat.css';
import { useEffect, useState } from 'react';
import React from 'react';
import { openUrl } from '../../service/NativeBridge';
import { Check, Copy, Search } from 'lucide-react';

function Chat({ messages }: { messages: Message[] }) {
    const bottomRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopy = async (content: string, id: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const extractText = (node: React.ReactNode): string => {
            if (typeof node === 'string' || typeof node === 'number') return String(node);
            if (Array.isArray(node)) return node.map(extractText).join('');
            if (React.isValidElement(node)) {
                const props = node.props as { children?: React.ReactNode };
                return extractText(props.children);
            }
            return '';
        };

    const components = {
        blockquote: ({ children }: { children?: React.ReactNode }) => {
            const searchMatch = /^\[search\]\s?(.*)$/s.exec(extractText(children).trim());

            if (searchMatch) {
                return (
                    <span className="searchStatus">
                        <Search size={14} />
                        <span>{searchMatch[1].trim() || 'Searching the web'}</span>
                    </span>
                );
            }

            return <blockquote>{children}</blockquote>;
        },
        a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
            if (
                !href ||
                href.startsWith('#') ||
                (!href.startsWith('http://') && !href.startsWith('https://'))
            ) {
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
        },
    };

    return messages.length === 0 ? (
        <div className="emptyContainer">
            <img src="./copall_nobg.svg" alt="Me .-." className="logo" />
            <p>Copall.</p>
        </div>
    ) : (
        <div className="chatContainer">
            {messages.map(message => (
                <div key={message.id} className="messageWrapper">
                    {message.attachments && message.attachments.length > 0 && (
                        <div className="messageAttachments">
                            {message.attachments.map(file => (
                                <img
                                    key={file.id}
                                    className="messageAttachmentThumb"
                                    src={`data:${file.mime};base64,${file.base64}`}
                                    alt={file.name}
                                    title={file.name}
                                />
                            ))}
                        </div>
                    )}
                    <div
                        className={`message ${message.sender === 'user' ? 'userMessage' : 'aiMessage'}`}
                    >
                        <ReactMarkdown components={components}>{message.content}</ReactMarkdown>
                    </div>

                    <button
                        className="copyButton"
                        onClick={() => handleCopy(message.content, message.id)}
                        title="Copy message"
                    >
                        {copiedId === message.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                </div>
            ))}
            <div ref={bottomRef}></div>
        </div>
    );
}

export default Chat;

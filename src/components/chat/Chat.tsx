import ReactMarkdown, { type Components } from 'react-markdown';
import Message from '../../models/message';
import './Chat.css';
import { useCallback, useEffect, useState } from 'react';
import React from 'react';
import { openUrl } from '../../service/NativeBridge';
import { Check, Copy, Search } from 'lucide-react';
import ChatScroll from './ChatScroll';
import { StreamingTail } from './StreamingTail';

const TAIL_CAP_CHARS = 900;
const TAIL_KEEP_CHARS = 250;

function extractText(node: React.ReactNode): string {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (React.isValidElement(node)) {
        const props = node.props as { children?: React.ReactNode };
        return extractText(props.children);
    }
    return '';
}

function MarkdownLink({ href, children }: { href?: string; children?: React.ReactNode }) {
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
}

const baseComponents: Components = {
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
    a: MarkdownLink,
};

function countFences(text: string): number {
    const matches = text.match(/```/g);
    return matches ? matches.length : 0;
}

function splitStableTail(content: string): { head: string; tail: string; tailOffset: number } {
    const SEP = '\n\n';
    let boundary = content.lastIndexOf(SEP);

    while (boundary !== -1) {
        if (countFences(content.slice(0, boundary)) % 2 === 0) {
            return {
                head: content.slice(0, boundary),
                tail: content.slice(boundary + SEP.length),
                tailOffset: boundary + SEP.length,
            };
        }
        boundary = content.lastIndexOf(SEP, boundary - 1);
    }

    let head = '';
    let tail = content;
    let tailOffset = 0;

    if (tail.length > TAIL_CAP_CHARS) {
        const limit = tail.length - TAIL_KEEP_CHARS;
        const cuts = [tail.lastIndexOf('\n', limit), tail.lastIndexOf(' ', limit)];

        for (const cut of cuts) {
            if (cut <= 0) continue;
            const candidate = tail.slice(0, cut);
            if (countFences(candidate) % 2 !== 0) continue;
            head = candidate;
            tail = tail.slice(cut + 1);
            tailOffset = cut + 1;
            break;
        }
    }

    return { head, tail, tailOffset };
}

const StableMarkdown = React.memo(function StableMarkdown({ content }: { content: string }) {
    return <ReactMarkdown components={baseComponents}>{content}</ReactMarkdown>;
});

function StreamingMarkdown({ content }: { content: string }) {
    const { head, tail, tailOffset } = splitStableTail(content);

    return (
        <>
            {head !== '' && <StableMarkdown content={head} />}
            <StreamingTail
                tail={tail}
                fenceOpen={countFences(head) % 2 === 1}
                baseOffset={tailOffset}
            />
        </>
    );
}

const MessageItem = React.memo(function MessageItem({
    message,
    isStreaming,
    copiedId,
    onCopy,
}: {
    message: Message;
    isStreaming: boolean;
    copiedId: string | null;
    onCopy: (content: string, id: string) => void;
}) {
    return (
        <div className="messageWrapper">
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
                className={`message ${message.sender === 'user' ? 'userMessage' : 'aiMessage'}${isStreaming ? ' style-typewriter' : ''}`}
            >
                {isStreaming ? (
                    <StreamingMarkdown content={message.content} />
                ) : (
                    <ReactMarkdown components={baseComponents}>{message.content}</ReactMarkdown>
                )}
            </div>

            <button
                className="copyButton"
                onClick={() => onCopy(message.content, message.id)}
                title="Copy message"
            >
                {copiedId === message.id ? <Check size={14} /> : <Copy size={14} />}
            </button>
        </div>
    );
});

function Chat({ messages, isGenerating }: { messages: Message[]; isGenerating?: boolean }) {
    const bottomRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const anchor = bottomRef.current;
        if (!anchor) return;
        const viewport = anchor.closest('.customScroll-viewport') as HTMLElement | null;

        if (isGenerating && viewport) {
            const distanceToBottom =
                viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
            if (distanceToBottom > 140) return;
            anchor.scrollIntoView({ behavior: 'auto', block: 'end' });
            return;
        }

        anchor.scrollIntoView({ behavior: isGenerating ? 'auto' : 'smooth' });
    }, [messages, isGenerating]);

    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopy = useCallback(async (content: string, id: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, []);

    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const streamingId =
        isGenerating && lastMessage && lastMessage.sender === 'assistant'
            ? lastMessage.id
            : null;

    return messages.length === 0 ? (
        <div className="emptyContainer">
            <img src="./copall_nobg.svg" alt="Me .-." className="logo" />
            <p>Copall.</p>
        </div>
    ) : (
        <ChatScroll>
            {messages.map(message => (
                <MessageItem
                    key={message.id}
                    message={message}
                    isStreaming={message.id === streamingId}
                    copiedId={copiedId}
                    onCopy={handleCopy}
                />
            ))}
            <div ref={bottomRef}></div>
        </ChatScroll>
    );
}

export default Chat;

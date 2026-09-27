import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Message from '../../models/message';
import './Chat.css';
import { useCallback, useEffect, useState } from 'react';
import React from 'react';
import { openUrl } from '../../service/NativeBridge';
import { Check, Copy, Search } from 'lucide-react';
import ChatScroll from './ChatScroll';
import HScroll from '../scroll/HScroll';
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
    pre: function CodeScroll({ children }: React.JSX.IntrinsicElements['pre'] & ExtraProps) {
        return (
            <HScroll className="md-codeScroll">
                <pre className="md-codePre">
                    {children}
                </pre>
            </HScroll>
        );
    },
    table: function TableScroll({ children }: React.JSX.IntrinsicElements['table'] & ExtraProps) {
        return (
            <HScroll className="md-tableScroll">
                <table className="md-table">
                    {children}
                </table>
            </HScroll>
        );
    },
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
    return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={baseComponents}>
            {content}
        </ReactMarkdown>
    );
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
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={baseComponents}>
                        {message.content}
                    </ReactMarkdown>
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

function Chat({
    messages,
    isGenerating,
    chatId,
}: {
    messages: Message[];
    isGenerating?: boolean;
    chatId?: string | null;
}) {
    const bottomRef = React.useRef<HTMLDivElement>(null);
    const pinnedRef = React.useRef(true);

    const scrollToBottom = useCallback((behavior: 'auto' | 'smooth') => {
        const anchor = bottomRef.current;
        if (!anchor) return;
        const viewport = anchor.closest('.customScroll-viewport') as HTMLElement | null;
        if (viewport) {
            viewport.scrollTo({ top: viewport.scrollHeight, behavior });
        } else {
            anchor.scrollIntoView({ behavior, block: 'end' });
        }
    }, []);

    useEffect(() => {
        if (messages.length === 0) return;
        const viewport =
            (bottomRef.current?.closest('.customScroll-viewport') as HTMLElement | null) ??
            (document.querySelector('.chatScroll-viewport') as HTMLElement | null);
        if (!viewport) return;
        const onScroll = () => {
            const distanceToBottom =
                viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
            pinnedRef.current = distanceToBottom <= 80;
        };
        viewport.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => viewport.removeEventListener('scroll', onScroll);
    }, [chatId, messages.length]);

    useEffect(() => {
        if (messages.length === 0) return;
        pinnedRef.current = true;
        const frame = requestAnimationFrame(() => scrollToBottom('auto'));
        return () => cancelAnimationFrame(frame);
    }, [chatId, scrollToBottom]);

    useEffect(() => {
        if (messages.length === 0) return;
        const last = messages[messages.length - 1];
        if (last.sender === 'user') {
            pinnedRef.current = true;
            scrollToBottom('auto');
            return;
        }
        if (pinnedRef.current) {
            scrollToBottom(isGenerating ? 'auto' : 'smooth');
        }
    }, [messages, isGenerating, scrollToBottom]);

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

import { useEffect, useState } from 'react';
import { Settings, Trash2, X } from 'lucide-react';
import type { ChatMeta } from '../../models/Chat';
import { getAllChatMetas } from '../../storage/db';
import CustomScroll from '../scroll/CustomScroll';
import DeleteChatDialog from '../deleteChat/DeleteChatDialog';
import './Sidebar.css';

function Sidebar({
    isOpen,
    currentChatId,
    onClose,
    onChatSelect,
    onChatDelete,
    onSettingsClick,
}: {
    isOpen: boolean;
    currentChatId: string | null;
    onClose: () => void;
    onChatSelect: (id: string) => void;
    onChatDelete: (id: string) => Promise<void>;
    onSettingsClick: () => void;
}) {
    const [chats, setChats] = useState<ChatMeta[]>([]);
    const [pendingDelete, setPendingDelete] = useState<ChatMeta | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        getAllChatMetas()
            .then(setChats)
            .catch(e => console.error('Failed to load chats:', e));
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="sidebarBackdrop" onClick={onClose}>
            <aside className="sidebar" onClick={e => e.stopPropagation()}>
                <div className="sidebarHeader">
                    <span className="sidebarTitle">Chats</span>
                    <button aria-label="Close menu" className="clickable" onClick={onClose}>
                        <X size={14} />
                    </button>
                </div>
                <CustomScroll
                    hostClassName="sidebarChatListHost"
                    viewportClassName="sidebarChatList"
                >
                    {chats.map(chat => (
                        <div
                            key={chat.id}
                            className={`sidebarChatRow${chat.id === currentChatId ? ' active' : ''}`}
                        >
                            <button
                                type="button"
                                className="sidebarChatItem"
                                title={chat.name}
                                onClick={() => onChatSelect(chat.id)}
                            >
                                {chat.name}
                            </button>
                            <button
                                type="button"
                                aria-label={`Delete ${chat.name}`}
                                title="Delete chat"
                                className="sidebarDeleteButton"
                                onClick={() => setPendingDelete(chat)}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                    {chats.length === 0 && <div className="sidebarEmpty">No chats yet</div>}
                </CustomScroll>
                <div className="sidebarFooter">
                    <button className="sidebarSettingsButton" onClick={onSettingsClick}>
                        <Settings size={18} />
                        <span>Settings</span>
                    </button>
                </div>
            </aside>
            {pendingDelete && (
                <DeleteChatDialog
                    chatName={pendingDelete.name}
                    onCancel={() => setPendingDelete(null)}
                    onConfirm={async () => {
                        const target = pendingDelete;
                        setPendingDelete(null);
                        try {
                            await onChatDelete(target.id);
                            setChats(prev => prev.filter(chat => chat.id !== target.id));
                        } catch {
                            setChats(prev =>
                                prev.some(chat => chat.id === target.id)
                                    ? prev
                                    : [...prev, target]
                            );
                        }
                    }}
                />
            )}
        </div>
    );
}

export default Sidebar;

import { useEffect, useState } from 'react';
import { Settings, X } from 'lucide-react';
import type { ChatMeta } from '../../models/Chat';
import { getAllChatMetas } from '../../storage/db';
import './Sidebar.css';

function Sidebar({
    isOpen,
    currentChatId,
    onClose,
    onSettingsClick,
}: {
    isOpen: boolean;
    currentChatId: string | null;
    onClose: () => void;
    onSettingsClick: () => void;
}) {
    const [chats, setChats] = useState<ChatMeta[]>([]);

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
                <div className="sidebarChatList">
                    {chats.map(chat => (
                        <div
                            key={chat.id}
                            className={`sidebarChatItem${chat.id === currentChatId ? ' active' : ''}`}
                            title={chat.name}
                        >
                            {chat.name}
                        </div>
                    ))}
                    {chats.length === 0 && <div className="sidebarEmpty">No chats yet</div>}
                </div>
                <div className="sidebarFooter">
                    <button className="sidebarSettingsButton" onClick={onSettingsClick}>
                        <Settings size={18} />
                        <span>Settings</span>
                    </button>
                </div>
            </aside>
        </div>
    );
}

export default Sidebar;

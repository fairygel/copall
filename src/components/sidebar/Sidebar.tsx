import { useEffect, useState } from 'react';
import { Settings, X } from 'lucide-react';
import type { ChatMeta } from '../../models/Chat';
import { getAllChatMetas } from '../../storage/db';
import CustomScroll from '../scroll/CustomScroll';
import './Sidebar.css';

function Sidebar({
    isOpen,
    currentChatId,
    onClose,
    onChatSelect,
    onSettingsClick,
}: {
    isOpen: boolean;
    currentChatId: string | null;
    onClose: () => void;
    onChatSelect: (id: string) => void;
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
                <CustomScroll
                    hostClassName="sidebarChatListHost"
                    viewportClassName="sidebarChatList"
                >
                    {chats.map(chat => (
                        <button
                            key={chat.id}
                            type="button"
                            className={`sidebarChatItem${chat.id === currentChatId ? ' active' : ''}`}
                            title={chat.name}
                            onClick={() => onChatSelect(chat.id)}
                        >
                            {chat.name}
                        </button>
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
        </div>
    );
}

export default Sidebar;

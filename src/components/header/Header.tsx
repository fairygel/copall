import { MessageCirclePlus, Settings, X } from 'lucide-react';
import './Header.css';
import { invoke } from '@tauri-apps/api/core';

function Header({
    onSettingsClick,
    onNewChatClick,
    chatName,
}: {
    onSettingsClick: () => void;
    onNewChatClick: () => void;
    chatName: string;
}) {
    const handleClose = async () => {
        await invoke('close_window');
    };

    return (
        <div data-tauri-drag-region className="header">
            <div data-tauri-drag-region className="icons">
                <button aria-label="Open settings" className="clickable" onClick={onSettingsClick}>
                    <Settings size={20} />
                </button>
                <button aria-label="Create new chat" className="clickable" onClick={onNewChatClick}>
                    <MessageCirclePlus size={20} />
                </button>
            </div>
            <div data-tauri-drag-region className="chatName">
                {chatName || 'New Chat'}
            </div>
            <div className="windowIcons">
                <button
                    aria-label="Close window"
                    onClick={() => {
                        handleClose();
                    }}
                    className="clickable"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}

export default Header;

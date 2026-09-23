import { Menu, MessageCirclePlus, X } from 'lucide-react';
import './Header.css';
import { hideWindow } from '../../service/NativeBridge';

function Header({
    onMenuClick,
    onNewChatClick,
    chatName,
}: {
    onMenuClick: () => void;
    onNewChatClick: () => void;
    chatName: string;
}) {
    const handleClose = async () => {
        await hideWindow().catch(console.error);
    };

    return (
        <div data-drag-region className="header">
            <div data-drag-region className="icons">
                <button aria-label="Open menu" className="clickable" onClick={onMenuClick}>
                    <Menu size={20} />
                </button>
                <button aria-label="Create new chat" className="clickable" onClick={onNewChatClick}>
                    <MessageCirclePlus size={20} />
                </button>
            </div>
            <div data-drag-region className="chatName">
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

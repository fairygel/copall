import { MessageCirclePlus, Settings, X } from "lucide-react";
import './Header.css';
import { invoke } from "@tauri-apps/api/core";

function Header({ onSettingsClick, onNewChatClick }: { onSettingsClick: () => void; onNewChatClick: () => void }) {

    const handleClose = async () => {
        await invoke('close_window');
    };

    return (
      <div data-tauri-drag-region className="header">

        <div data-tauri-drag-region className="icons">
          <button className="clickable" onClick={onSettingsClick}>
            <Settings size={20} />
          </button>
          <button className="clickable" onClick={onNewChatClick}>
            <MessageCirclePlus size={20} />
          </button>
        </div>
        <div className="chatName">Chat Name a little longer</div>
        <div className="windowIcons">
          <button onClick={() => {handleClose()}} className="clickable"><X size={14} /></button>
        </div>

      </div>
    );
}

export default Header;

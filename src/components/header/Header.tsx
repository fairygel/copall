import { MessageCirclePlus, Settings, X } from "lucide-react";
import { getCurrentWindow } from '@tauri-apps/api/window';
import './Header.css';

function Header() {

    const handleClose = async () => {
        const window = getCurrentWindow();
        await window.close();
    };

    return (
      <div data-tauri-drag-region className="header">

        <div data-tauri-drag-region className="icons">
          <button className="clickable"><Settings size={20}/></button>
          <button className="clickable"><MessageCirclePlus size={20}/></button>
        </div>
        <div className="chatName">Chat Name a little longer</div>
        <div className="windowIcons">
          <button onClick={() => {handleClose()}} className="clickable"><X size={14} /></button>
        </div>

      </div>
    );
}

export default Header;

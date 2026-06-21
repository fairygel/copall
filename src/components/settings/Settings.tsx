import './Settings.css';
import { X } from "lucide-react";

function Settings({ onClose }: { onClose: () => void }) {

    return (
        <div className="modalBackdrop" onClick={() => onClose()}>
            <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                <div className="modalHeader">
                    <h3>Settings</h3>
                    <button className="clickable" onClick={() => onClose()}>
                        <X size={14} />
                    </button>
                </div>
                <div className="modalBody">
                    <h4>Api Keys</h4>
                    <div className="settingsSection">
                        <div className="settingItem">
                            <div className="settingLabel">
                                <img src="/mistral.svg" alt="icon" width={18} height={18} />
                                <span>Mistral</span>
                            </div>
                            <input type="password" placeholder="Enter Mistral API Key" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
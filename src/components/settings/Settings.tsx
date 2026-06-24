import { useState } from 'react';
import './Settings.css';
import { SunMoon, X } from "lucide-react";

function Settings({ onClose }: { onClose: () => void }) {
    const [mistralApiKey, setMistralApiKey] = useState(() =>
        localStorage.getItem('mistralApiKey') || ''
    );

    const [geminiApiKey, setGeminiApiKey] = useState(() =>
        localStorage.getItem('geminiApiKey') || ''
    );

    const [theme, setTheme] = useState<'light' | 'dark'>(
        localStorage.getItem('theme') === 'light' ? 'light' : 'dark'
    );

    const saveSettings = () => {
        localStorage.setItem('mistralApiKey', mistralApiKey);
        localStorage.setItem('geminiApiKey', geminiApiKey);
        onClose();
    };

    const setAppTheme = (theme: 'light' | 'dark') => {
        localStorage.setItem('theme', theme);
        setTheme(theme);

        if (theme === 'dark') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    };

    return (
        <div className="modalBackdrop" onClick={() => saveSettings()}>
            <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                <div className="modalHeader">
                    <h3>Settings</h3>
                    <button className="clickable" onClick={() => saveSettings()}>
                        <X size={14} />
                    </button>
                </div>
                <div className="modalBody">
                    <h4>General</h4>
                    <div className="settingsSection">
                        <div className="settingItem">
                            <div className="settingLabel">
                                <SunMoon size={18} />
                                <span>Theme</span>
                            </div>
                            <div className="textSwitch">
                                <button
                                    className={`switchOption ${theme === 'light' ? 'active' : ''}`}
                                    onClick={() => setAppTheme('light')}>Light</button>
                                <span>/</span>
                                <button
                                    className={`switchOption ${theme === 'dark' ? 'active' : ''}`}
                                    onClick={() => setAppTheme('dark')}>Dark</button>
                            </div>
                        </div>
                    </div>
                    <h4>Api Keys</h4>
                    <div className="settingsSection">
                        <div className="settingItem">
                            <div className="settingLabel">
                                <img src="/mistral.svg" alt="icon" width={18} height={18} />
                                <span>Mistral</span>
                            </div>
                            <input
                                type="password"
                                placeholder="Enter Mistral API Key"
                                value={mistralApiKey}
                                onChange={(e) => setMistralApiKey(e.target.value)}
                            />
                        </div>
                        <div className="settingItem">
                            <div className="settingLabel">
                                <img src="/gemini.svg" alt="icon" width={18} height={18} />
                                <span>Gemini</span>
                            </div>
                            <input
                                type="password"
                                placeholder="Enter Gemini API Key"
                                value={geminiApiKey}
                                onChange={(e) => setGeminiApiKey(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
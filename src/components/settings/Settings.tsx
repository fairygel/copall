import { useEffect, useState } from 'react';
import './Settings.css';
import { CircleAlert, KeyRound, Pin, Power, SunMoon, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import { type } from '@tauri-apps/plugin-os';
import Select from '../select/Select';

type Theme = 'dark' | 'light' | 'exclusive';

const THEMES: Theme[] = ['dark', 'light', 'exclusive'];

const THEME_LABEL: Record<Theme, string> = {
    dark: 'Dark',
    light: 'Light',
    exclusive: 'Exclusive',
};

function Settings({
    onClose,
    onManageApiKeys,
}: {
    onClose: () => void;
    onManageApiKeys: () => void;
}) {
    const appWindow = getCurrentWindow();
    const osType = type();

    const isLinux = osType === 'linux';

    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('theme') as Theme | null;
        return saved && THEMES.includes(saved) ? saved : 'dark';
    });

    const [alwaysOnTop, setAlwaysOnTop] = useState(false);
    const [openOnStartup, setOpenOnStartup] = useState(false);

    const handleClose = () => {
        onClose();
    };

    const setAppTheme = (next: Theme) => {
        localStorage.setItem('theme', next);
        setTheme(next);

        if (next === 'dark') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', next);
        }
    };

    const handleAlwaysOnTopToggle = async () => {
        const next = !alwaysOnTop;
        await appWindow.setAlwaysOnTop(next);
        setAlwaysOnTop(next);
    };

    const handleStartupToggle = async () => {
        const next = !openOnStartup;
        next ? await enable() : await disable();
        setOpenOnStartup(next);
    };

    useEffect(() => {
        appWindow.isAlwaysOnTop().then(setAlwaysOnTop);
        isEnabled().then(setOpenOnStartup);
    }, []);

    return (
        <div className="modalBackdrop" onClick={handleClose}>
            <div className="modalContent" onClick={e => e.stopPropagation()}>
                <div className="modalHeader">
                    <div />
                    <h3>Settings</h3>
                    <button className="clickable" onClick={handleClose}>
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
                            <Select
                                list={THEMES.map(t => THEME_LABEL[t])}
                                defaultItem={THEME_LABEL[theme]}
                                onSelect={label => {
                                    const next = (Object.entries(THEME_LABEL).find(
                                        ([, v]) => v === label
                                    )?.[0] ?? 'dark') as Theme;
                                    setAppTheme(next);
                                }}
                            />
                        </div>
                        <div className="settingItem">
                            <div className="settingLabel">
                                <Pin size={18} />
                                <span>Always On Top</span>
                                {isLinux && (
                                    <button
                                        type="button"
                                        className="settingTooltipTrigger"
                                        aria-label="Linux only: This may not work on all Linux desktop environments"
                                    >
                                        <CircleAlert size={14} />
                                        <span className="settingTooltipBubble" role="tooltip">
                                            This may not work on all Linux desktop environments
                                        </span>
                                    </button>
                                )}
                            </div>
                            <button
                                className={`toggleSwitch ${alwaysOnTop ? 'active' : ''}`}
                                aria-pressed={alwaysOnTop}
                                onClick={handleAlwaysOnTopToggle}
                            >
                                <span className="toggleThumb" />
                            </button>
                        </div>
                        <div className="settingItem">
                            <div className="settingLabel">
                                <Power size={18} />
                                <span>Open on System Start up</span>
                            </div>
                            <button
                                className={`toggleSwitch ${openOnStartup ? 'active' : ''}`}
                                aria-pressed={openOnStartup}
                                onClick={handleStartupToggle}
                            >
                                <span className="toggleThumb" />
                            </button>
                        </div>
                    </div>
                    <h4>Providers</h4>
                    <div className="settingsSection">
                        <button
                            type="button"
                            className="settingItem settingLinkItem textActionButton"
                            onClick={onManageApiKeys}
                        >
                            <div className="settingLabel">
                                <KeyRound size={18} />
                                <span>Api Keys</span>
                            </div>
                            <span className="manageLink">Manage &gt;</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;

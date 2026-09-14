import { useEffect, useState } from 'react';
import './Settings.css';
import { CircleAlert, KeyRound, Pin, Power, SunMoon, X } from 'lucide-react';
import {
    autostartIsEnabled,
    autostartSet,
    getOsTypeAsync,
    isAlwaysOnTop,
    setAlwaysOnTop as setAlwaysOnTopNative,
} from '../../service/NativeBridge';
import Select from '../select/Select';
import {
    applyTheme,
    getSavedTheme,
    themeFromLabel,
    THEME_LABEL,
    THEMES,
    type Theme,
} from '../../service/ThemeService';

function Settings({
    onClose,
    onManageApiKeys,
}: {
    onClose: () => void;
    onManageApiKeys: () => void;
}) {
    const [isLinux, setIsLinux] = useState(false);

    const [theme, setTheme] = useState<Theme>(getSavedTheme);

    const [alwaysOnTop, setAlwaysOnTop] = useState(false);
    const [openOnStartup, setOpenOnStartup] = useState(false);
    const [alwaysOnTopPending, setAlwaysOnTopPending] = useState(true);
    const [startupPending, setStartupPending] = useState(true);

    useEffect(() => {
        getOsTypeAsync()
            .then(platform => setIsLinux(platform === 'linux'))
            .catch(() => setIsLinux(false));
        isAlwaysOnTop()
            .then(setAlwaysOnTop)
            .catch(() => setAlwaysOnTop(false))
            .finally(() => setAlwaysOnTopPending(false));
        autostartIsEnabled()
            .then(setOpenOnStartup)
            .catch(() => setOpenOnStartup(false))
            .finally(() => setStartupPending(false));
    }, []);

    const setAppTheme = (next: Theme) => {
        applyTheme(next);
        setTheme(next);
    };

    const handleAlwaysOnTopToggle = async () => {
        if (alwaysOnTopPending) return;
        const next = !alwaysOnTop;
        setAlwaysOnTopPending(true);
        try {
            await setAlwaysOnTopNative(next);
            setAlwaysOnTop(next);
        } catch (e) {
            console.error('Failed to toggle always on top:', e);
        } finally {
            setAlwaysOnTopPending(false);
        }
    };

    const handleStartupToggle = async () => {
        if (startupPending) return;
        const next = !openOnStartup;
        setStartupPending(true);
        try {
            await autostartSet(next);
            setOpenOnStartup(next);
        } catch (e) {
            console.error('Failed to toggle autostart:', e);
        } finally {
            setStartupPending(false);
        }
    };

    return (
        <div className="modalBackdrop" onClick={onClose}>
            <div className="modalContent" onClick={e => e.stopPropagation()}>
                <div className="modalHeader">
                    <div />
                    <h3>Settings</h3>
                    <button className="clickable" onClick={onClose}>
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
                                onSelect={label => setAppTheme(themeFromLabel(label))}
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
                                disabled={alwaysOnTopPending}
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
                                disabled={startupPending}
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

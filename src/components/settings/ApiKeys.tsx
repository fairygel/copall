import { useState } from 'react';
import './Settings.css';
import { X } from 'lucide-react';
import { AVAILABLE_PROVIDERS, getApiKey, setApiKey } from '../../config/AiProviderConfig';
import {
    getSearchApiKey,
    setSearchApiKey,
    SEARCH_API_KEY_LABEL,
    SEARCH_API_KEY_PLACEHOLDER,
    SEARCH_API_KEY_STORAGE_KEY,
} from '../../config/SearchConfig';

function ApiKeys({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
    const readStoredKeys = () => {
        const initial: Record<string, string> = {};
        for (const provider of AVAILABLE_PROVIDERS) {
            initial[provider.id] = getApiKey(provider);
        }
        initial[SEARCH_API_KEY_STORAGE_KEY] = getSearchApiKey();
        return initial;
    };

    const [apiKeys, setApiKeys] = useState<Record<string, string>>(readStoredKeys);
    const [initialApiKeys, setInitialApiKeys] =
        useState<Record<string, string>>(readStoredKeys);

    const handleKeyBlur = (providerId: string) => {
        if (providerId === SEARCH_API_KEY_STORAGE_KEY) {
            const value = apiKeys[providerId] ?? '';
            setSearchApiKey(value);
            setInitialApiKeys(prev => ({ ...prev, [providerId]: value }));
            return;
        }

        const provider = AVAILABLE_PROVIDERS.find(p => p.id === providerId);
        if (!provider) return;

        const value = apiKeys[providerId] ?? '';
        setApiKey(provider, value);
        setInitialApiKeys(prev => ({ ...prev, [providerId]: value }));
    };

    const persistApiKeys = () => {
        for (const provider of AVAILABLE_PROVIDERS) {
            const newValue = apiKeys[provider.id] ?? '';
            const oldValue = initialApiKeys[provider.id] ?? '';

            if (newValue !== oldValue) {
                setApiKey(provider, newValue);
            }
        }

        const searchValue = apiKeys[SEARCH_API_KEY_STORAGE_KEY] ?? '';
        const searchOld = initialApiKeys[SEARCH_API_KEY_STORAGE_KEY] ?? '';

        if (searchValue !== searchOld) {
            setSearchApiKey(searchValue);
        }
    };

    const handleClose = () => {
        persistApiKeys();
        onClose();
    };

    const handleBack = () => {
        persistApiKeys();
        onBack();
    };

    return (
        <div className="modalBackdrop" onClick={handleClose}>
            <div className="modalContent" onClick={e => e.stopPropagation()}>
                <div className="modalHeader">
                    <button className="textActionButton backButton" onClick={handleBack}>
                        &lt; Back
                    </button>
                    <h3>Providers</h3>
                    <button className="clickable" onClick={handleClose}>
                        <X size={14} />
                    </button>
                </div>
                <div className="modalBody">
                    <h4>Api Keys</h4>
                    <div className="settingsSection">
                        {AVAILABLE_PROVIDERS.map(provider => (
                            <div key={provider.id} className="settingItem">
                                <div className="settingLabel">
                                    <img
                                        src={`./${provider.icon}`}
                                        alt={provider.name}
                                        width={18}
                                        height={18}
                                    />
                                    <span>{provider.name}</span>
                                </div>
                                <input
                                    type="password"
                                    placeholder={`Enter ${provider.name} API Key`}
                                    value={apiKeys[provider.id] ?? ''}
                                    onChange={e =>
                                        setApiKeys(prev => ({
                                            ...prev,
                                            [provider.id]: e.target.value,
                                        }))
                                    }
                                    onBlur={() => handleKeyBlur(provider.id)}
                                />
                            </div>
                        ))}
                    </div>
                    <h4>Web Search</h4>
                    <div className="settingsSection">
                        <div className="settingItem">
                            <div className="settingLabel">
                                <span>{SEARCH_API_KEY_LABEL}</span>
                            </div>
                            <input
                                type="password"
                                placeholder={SEARCH_API_KEY_PLACEHOLDER}
                                value={apiKeys[SEARCH_API_KEY_STORAGE_KEY] ?? ''}
                                onChange={e =>
                                    setApiKeys(prev => ({
                                        ...prev,
                                        [SEARCH_API_KEY_STORAGE_KEY]: e.target.value,
                                    }))
                                }
                                onBlur={() => handleKeyBlur(SEARCH_API_KEY_STORAGE_KEY)}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ApiKeys;

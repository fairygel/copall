import { useState } from 'react';
import './Settings.css';
import { X } from "lucide-react";
import { AVAILABLE_PROVIDERS, getApiKey, setApiKey } from '../../config/AiProviderConfig';
import { AiProvider } from '../../models/AiProvider';
import { useQueryClient } from '@tanstack/react-query';

function ApiKeys({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
    const queryClient = useQueryClient();

    const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        for (const provider of AVAILABLE_PROVIDERS) {
            initial[provider.name] = getApiKey(provider);
        }
        return initial;
    });

    const [initialApiKeys] = useState(() => {
        const initial: Record<string, string> = {};
        for (const provider of AVAILABLE_PROVIDERS) {
            initial[provider.name] = getApiKey(provider);
        }
        return initial;
    });

    const handleKeyBlur = (provider: AiProvider) => {
        setApiKey(provider, apiKeys[provider.name] ?? '');
    };

    const persistApiKeys = () => {
        let keysChanged = false;
        for (const provider of AVAILABLE_PROVIDERS) {
            const newValue = apiKeys[provider.name] ?? '';
            const oldValue = initialApiKeys[provider.name] ?? '';

            if (newValue !== oldValue) {
                setApiKey(provider, newValue);
                keysChanged = true;
            }
        }

        if (keysChanged) {
            queryClient.invalidateQueries({ queryKey: ['ai-models-list'] });
        }

        return keysChanged;
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
            <div className="modalContent" onClick={(e) => e.stopPropagation()}>
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
                            <div key={provider.name} className="settingItem">
                                <div className="settingLabel">
                                    <img src={`/${provider.icon}`} alt={provider.name} width={18} height={18} />
                                    <span>{provider.name}</span>
                                </div>
                                <input
                                    type="password"
                                    placeholder={`Enter ${provider.name} API Key`}
                                    value={apiKeys[provider.name] ?? ''}
                                    onChange={(e) => setApiKeys(prev => ({
                                        ...prev,
                                        [provider.name]: e.target.value,
                                    }))}
                                    onBlur={() => handleKeyBlur(provider)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ApiKeys;
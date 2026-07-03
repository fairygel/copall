import { ArrowUp } from "lucide-react";
import { useState, useEffect } from "react";
import './MessageBox.css';
import { getAvailableModels } from "../../service/ChatService";
import AiModelSelect from "../select/AiModelSelect";
import AiModel from "../../models/AiModel";

function MessageBox({ onMessageSent, disabled, onModelChange, modelsVersion = 0 }: {
    onMessageSent: (msg: string) => void;
    disabled: boolean;
    onModelChange: (model: AiModel | null) => void;
    modelsVersion?: number;
}) {
    const [inputValue, setInputValue] = useState('');
    const [models, setModels] = useState<AiModel[]>([]);
    const [defaultModel, setDefaultModel] = useState<AiModel | null>(null);
    const [isLoadingModels, setIsLoadingModels] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setIsLoadingModels(true);

        getAvailableModels()
            .then(loadedModels => {
                if (cancelled) return;
                setModels(loadedModels);

                const savedModelId = localStorage.getItem('selectedModel');
                const savedModel = savedModelId
                    ? loadedModels.find(m => m.id === savedModelId) ?? null
                    : null;
                const model = savedModel || loadedModels[0] || null;

                setDefaultModel(model);
                onModelChange(model);
            })
            .catch(err => {
                console.error('Failed to load available models:', err);
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoadingModels(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [modelsVersion]);

    const isDisabled = disabled || inputValue.trim() === '' || isLoadingModels || !defaultModel;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isDisabled) {
                onMessageSent(inputValue);
                setInputValue('');
            }
        }
    }

    const handleSendClick = () => {
        if (!isDisabled) {
            setInputValue('');
            onMessageSent(inputValue);
        }
    }

    const handleModelSelect = (model: AiModel | null) => {
        if (model) {
            localStorage.setItem('selectedModel', model.id);
        } else {
            localStorage.removeItem('selectedModel');
        }
        setDefaultModel(model);
        onModelChange(model);
    }

    return (
        <div className="messageContainer">
            <textarea
                className="inputArea"
                autoFocus
                placeholder="Your move, Ask!"
                value={inputValue}
                onKeyDown={handleKeyDown}
                onChange={(e) => setInputValue(e.target.value)}
            />
            <div className="tooltip">
                <AiModelSelect
                    list={models}
                    onSelect={handleModelSelect}
                    defaultItem={defaultModel ?? undefined}
                    disabled={isLoadingModels || disabled}
                />
                <button
                    className="sendMessage"
                    disabled={isDisabled}
                    onClick={handleSendClick}>
                    <ArrowUp size={20} />
                </button>
            </div>
        </div>
    )
}

export default MessageBox;
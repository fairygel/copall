import { ArrowUp } from "lucide-react";
import { useState, useEffect } from "react";
import './MessageBox.css';
import { useAiModels } from "../../storage/useAiModels";
import AiModelSelect from "../select/AiModelSelect";
import AiModel from "../../models/AiModel";

function MessageBox({ onMessageSent, disabled, onModelChange }: {
    onMessageSent: (msg: string) => void;
    disabled: boolean;
    onModelChange: (model: AiModel | null) => void;
}) {
    const [inputValue, setInputValue] = useState('');
    const [defaultModel, setDefaultModel] = useState<AiModel | null>(null);

    const { 
        data: models = [],
        isLoading: isLoadingModels,
        isError,
        error,
    } = useAiModels();

    useEffect(() => {
        if (models.length === 0) return;

        const savedModelId = localStorage.getItem('selectedModel');
        const savedModel = savedModelId
            ? models.find(m => m.id === savedModelId) ?? null
            : null;
        const model = savedModel || models[0] || null;

        setDefaultModel(model);
        onModelChange(model);
    }, [models, onModelChange]);

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

    if (isError) {
        console.error('Failed to load models:', error);
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
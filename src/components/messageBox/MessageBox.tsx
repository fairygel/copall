import { ArrowUp } from "lucide-react";
import { useState } from "react";
import './MessageBox.css';
import Select from "../select/Select";

const models = ["Mistral/mistral-medium-3-5", "Mistral/mistral-small-2603", "Mistral/mistral-large-2512", "Google/gemini-3.5-flash", "Google/gemini-3-flash-preview", "Google/gemini-3.1-flash-lite"];

function MessageBox({ onMessageSent, disabled, onModelChange }: { 
    onMessageSent: (msg: string) => void; 
    disabled: boolean;
    onModelChange: (model: string) => void;
}) {
    const [inputValue, setInputValue] = useState('');

    const isDisabled = disabled || inputValue.trim() === '';

    const [defaultModel, setDefaultModel] = useState(() => {
        const model = localStorage.getItem('selectedModel') || models[0];
        onModelChange(model);
        return model;
    });

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

    const handleModelSelect = (model: string) => {
        localStorage.setItem('selectedModel', model);
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
                <Select 
                    list={models} 
                    onSelect={handleModelSelect} 
                    defaultItem={defaultModel} 
                    disabled={models.length === 0}
                    shouldGroup={true}
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
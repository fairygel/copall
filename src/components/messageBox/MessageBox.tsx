import { ArrowUp } from "lucide-react";
import { useState } from "react";
import './MessageBox.css';

function MessageBox({ onMessageSent, disabled }: { onMessageSent: (msg: string) => void; disabled: boolean }) {
    const [inputValue, setInputValue] = useState('');

    const isDisabled = disabled || inputValue.trim() === '';

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
                <button
                    className="sendMessage"
                    disabled={isDisabled}
                    onClick={handleSendClick}>
                    <ArrowUp size={24} />
                </button>
            </div>
        </div>
    )
}

export default MessageBox;
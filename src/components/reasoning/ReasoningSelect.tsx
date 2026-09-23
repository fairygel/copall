import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { ReasoningLevel } from '../../models/AiModel';
import './ReasoningSelect.css';

export type ReasoningChoice = ReasoningLevel | 'default';

export interface ReasoningSelectHandle {
    toggle: () => void;
}

function ReasoningSelect(
    {
        levels,
        value,
        onSelect,
        disabled,
    }: {
        levels: ReasoningLevel[];
        value: ReasoningChoice;
        onSelect: (level: ReasoningChoice) => void;
        disabled?: boolean;
    },
    ref: React.Ref<ReasoningSelectHandle>
) {
    const [isOpened, setIsOpened] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        toggle: () => {
            if (disabled) return;
            setIsOpened(prev => !prev);
        },
    }));

    useEffect(() => {
        if (disabled) setIsOpened(false);
    }, [disabled]);

    useEffect(() => {
        if (!isOpened) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpened(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpened]);

    const handleItemSelect = (level: ReasoningChoice) => {
        setIsOpened(false);
        onSelect(level);
    };

    const options: ReasoningChoice[] = [
        ...levels.filter(level => level !== 'none').reverse(),
        'none',
        'default',
    ];

    return (
        <div
            ref={containerRef}
            className="reasoningSelect"
            style={{ position: 'absolute', bottom: '100%', marginBottom: 8, right: 0 }}
        >
            {isOpened && !disabled && (
                <div onClick={e => e.stopPropagation()} className="selectDropdown reasoningDropdown">
                    {options.map(level => (
                        <button
                            onClick={() => handleItemSelect(level)}
                            key={level}
                            className={`selectItem reasoningItem${value === level ? ' selected' : ''}`}
                        >
                            <span className="reasoningItemCheck">
                                {value === level && <Check size={14} />}
                            </span>
                            {level}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default forwardRef(ReasoningSelect);

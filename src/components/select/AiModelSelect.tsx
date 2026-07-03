import { useEffect, useMemo, useRef, useState } from "react";
import './Select.css';
import { ChevronDown, ChevronRight } from "lucide-react";
import AiModel from "../../models/AiModel";

const PLACEHOLDER = 'Select Model';

function AiModelSelect({ list, onSelect, defaultItem, disabled }: {
    list: AiModel[];
    onSelect: (item: AiModel | null) => void;
    defaultItem?: AiModel;
    disabled?: boolean;
}) {
    const [isOpened, setIsOpened] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const resolvedDefault = useMemo<AiModel | null>(() => {
        if (!defaultItem) return null;
        const exists = list.some(m => m.id === defaultItem.id);
        return exists ? defaultItem : null;
    }, [defaultItem, list]);

    const [defaultSelect, setDefaultSelect] = useState<AiModel | null>(resolvedDefault);

    useEffect(() => {
        setDefaultSelect(resolvedDefault);
        if (!resolvedDefault) {
            onSelect(null);
        }
    }, [resolvedDefault]);

    const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

    const handleItemSelect = (item: AiModel) => {
        setDefaultSelect(item);
        setIsOpened(false);
        onSelect(item);
    }

    const toggleProvider = (provider: string) => {
        setExpandedProviders(prev => ({
            ...prev,
            [provider]: !prev[provider]
        }));
    }

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

    const groups: Record<string, AiModel[]> = {};
    list.forEach(item => {
        const providerName = item.provider.name;
        if (!groups[providerName]) {
            groups[providerName] = [];
        }
        groups[providerName].push(item);
    });

    const providers = Object.keys(groups);
    const showPlaceholder = !defaultSelect || list.length === 0;

    return (
        <div
            ref={containerRef}
            className={`selectWrapper ${disabled ? 'disabled' : ''}`}
            style={{ position: 'relative', display: 'inline-block' }}
        >
            <button
                onClick={() => setIsOpened(!isOpened)}
                className="selectContainer"
                disabled={disabled}
            >
                <span>{showPlaceholder ? PLACEHOLDER : defaultSelect.name}</span>
                <span className={`selectIcon ${isOpened ? 'dropdownOpened' : ''}`}>
                    <ChevronDown size={14} />
                </span>
            </button>
            {isOpened && providers.length > 0 && (
                <div onClick={(e) => e.stopPropagation()} className="selectDropdown">
                    {providers.map((provider) => {
                        const isExpanded = !!expandedProviders[provider];
                        const modelsInGroup = groups[provider];

                        return (
                            <div key={provider} className="selectGroup">
                                <button
                                    onClick={() => toggleProvider(provider)}
                                    className="selectGroupHeader"
                                >
                                    <span className={`groupChevron ${isExpanded ? 'groupExpanded' : ''}`}>
                                        <ChevronRight size={14}></ChevronRight>
                                    </span>
                                    <span>{provider}</span>
                                </button>
                                {isExpanded && (
                                    <div className="selectGroupItems">
                                        {modelsInGroup.map((item, index) => (
                                            <button
                                                onClick={() => handleItemSelect(item)}
                                                key={index}
                                                className="selectItem selectSubItem"
                                            >
                                                {item.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    )
}

export default AiModelSelect;
import { useEffect, useRef, useState } from "react";
import './Select.css';
import { ChevronDown } from "lucide-react";

function Select({ list, onSelect, defaultItem, disabled, shouldGroup }: {
    list: string[];
    onSelect: (item: string) => void;
    defaultItem?: string;
    disabled?: boolean;
    shouldGroup?: boolean;
}) {
    const [isOpened, setIsOpened] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const [defaultSelect, setDefaultSelect] = useState(() => {
        return defaultItem || (list.length > 0 ? list[0] : '');
    });

    const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

    const handleItemSelect = (item: string) => {
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

    const renderDropdownContent = () => {
        if (!shouldGroup) {
            return list.map((item, index) => (
                <button 
                    onClick={() => handleItemSelect(item)} 
                    key={index} 
                    className="selectItem">
                    {item}
                </button>
            ));
        }

        const groups: Record<string, string[]> = {};
        list.forEach(item => {
            const slashIndex = item.indexOf('/');
            if (slashIndex !== -1) {
                const provider = item.slice(0, slashIndex);
                if (!groups[provider]) {
                    groups[provider] = [];
                }
                groups[provider].push(item);
            } else {
                if (!groups['other']) {
                    groups['other'] = [];
                }
                groups['other'].push(item);
            }
        });

        const providers = Object.keys(groups);

        return providers.map((provider) => {
            const isExpanded = !!expandedProviders[provider];
            const modelsInGroup = groups[provider];

            return (
                <div key={provider} className="selectGroup">
                    <button 
                        onClick={() => toggleProvider(provider)} 
                        className="selectGroupHeader"
                    >
                        {`> ${provider}`}
                    </button>
                    {isExpanded && (
                        <div className="selectGroupItems">
                            {modelsInGroup.map((item, index) => {
                                const slashIndex = item.indexOf('/');
                                const displayName = slashIndex !== -1 ? item.slice(slashIndex + 1) : item;
                                return (
                                    <button 
                                        onClick={() => handleItemSelect(item)} 
                                        key={index} 
                                        className="selectItem selectSubItem"
                                    >
                                        {displayName}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        });
    }

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
                <span>{defaultSelect}</span>
                <ChevronDown size={14} />
            </button>
            {isOpened && (
                <div onClick={(e) => e.stopPropagation()} className="selectDropdown">
                    {renderDropdownContent()}
                </div>
            )}
        </div>
    )
}

export default Select;
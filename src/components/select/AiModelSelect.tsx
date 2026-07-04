import { useEffect, useMemo, useRef, useState } from "react";
import './Select.css';
import { ChevronDown, ChevronRight, Search } from "lucide-react";
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
    const [searchQuery, setSearchQuery] = useState('');

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
        setSearchQuery('');
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

    const filteredGroups = useMemo(() => {
        const query = searchQuery.toLowerCase().trim().replace(/\s+/g, '-');
        if (!query) {
            const groups: Record<string, AiModel[]> = {};
            list.forEach(item => {
                const providerName = item.provider.name;
                if (!groups[providerName]) {
                    groups[providerName] = [];
                }
                groups[providerName].push(item);
            });
            return groups;
        }

        const groups: Record<string, AiModel[]> = {};
        list.forEach(item => {
            const providerName = item.provider.name;
            const matchName = item.name.toLowerCase().includes(query);
            const matchProvider = providerName.toLowerCase().includes(query);
            const matchId = item.id.toLowerCase().includes(query);

            if (matchName || matchProvider || matchId) {
                if (!groups[providerName]) {
                    groups[providerName] = [];
                }
                groups[providerName].push(item);
            }
        });
        return groups;
    }, [list, searchQuery]);

    useEffect(() => {
        if (searchQuery.trim()) {
            const allExpanded: Record<string, boolean> = {};
            Object.keys(filteredGroups).forEach(provider => {
                allExpanded[provider] = true;
            });
            setExpandedProviders(allExpanded);
        }
    }, [searchQuery, filteredGroups]);

    const providers = Object.keys(filteredGroups);
    const showPlaceholder = !defaultSelect || list.length === 0;
    const showNoModelsFound = list.length > 0 && providers.length === 0 && searchQuery.trim().length > 0;

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
            {isOpened && (
                <div onClick={(e) => e.stopPropagation()} className="selectDropdown">
                    {providers.length > 0 && (
                        <div className="selectDropdownList">
                            {providers.map((provider) => {
                                const isExpanded = !!expandedProviders[provider];
                                const modelsInGroup = filteredGroups[provider];

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
                    {showNoModelsFound && (
                        <div className="selectEmptyState">
                            <span className="selectEmptyTitle">No models found</span>
                        </div>
                    )}
                    <div className="selectSearchContainer">
                        <Search size={14}/>
                        <input
                            type="text"
                            className="selectSearchInput"
                            placeholder="Search models..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

export default AiModelSelect;
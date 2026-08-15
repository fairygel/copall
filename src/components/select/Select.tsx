import { useEffect, useRef, useState } from 'react';
import './Select.css';
import { ChevronDown } from 'lucide-react';

function Select({
    list,
    onSelect,
    defaultItem,
    disabled,
}: {
    list: string[];
    onSelect: (item: string) => void;
    defaultItem?: string;
    disabled?: boolean;
}) {
    const [isOpened, setIsOpened] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const [defaultSelect, setDefaultSelect] = useState(() => {
        return defaultItem || (list.length > 0 ? list[0] : '');
    });

    const handleItemSelect = (item: string) => {
        setDefaultSelect(item);
        setIsOpened(false);
        onSelect(item);
    };

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
                <span className={`selectIcon ${isOpened ? 'dropdownOpened' : ''}`}>
                    <ChevronDown size={14} />
                </span>
            </button>
            {isOpened && (
                <div onClick={e => e.stopPropagation()} className="selectDropdown">
                    {list.map((item, index) => (
                        <button
                            onClick={() => handleItemSelect(item)}
                            key={index}
                            className="selectItem"
                        >
                            {item}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Select;

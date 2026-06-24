import { useState } from "react";
import './Select.css';
import { ChevronDown } from "lucide-react";

function Select({ list, onSelect, defaultItem, disabled }: { 
    list: string[]; 
    onSelect: (item: string) => void; 
    defaultItem?: string;
    disabled?: boolean;
}) {
    const [isOpened, setIsOpened] = useState(false);

    const [defaultSelect, setDefaultSelect] = useState(() => {
        return defaultItem || (list.length > 0 ? list[0] : '');
    });

    const handleItemSelect = (item: string) => {
        setDefaultSelect(item);
        setIsOpened(false);
        onSelect(item);
    }

    return (
        <button 
            onClick={() => setIsOpened(!isOpened)} 
            className="selectContainer"
            disabled={disabled}
        >
            <span>{defaultSelect}</span>
            <ChevronDown size={14} />
            {isOpened && (
                <div onClick={(e) => e.stopPropagation()} className="selectDropdown">
                    {list.map((item, index) => (
                        <button onClick={() => handleItemSelect(item)} key={index} className="selectItem">
                            {item}
                        </button>
                    ))}
                </div>
            )}
        </button>
    )
}

export default Select;
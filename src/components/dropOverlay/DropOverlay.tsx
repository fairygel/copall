import './DropOverlay.css';
import { ImagePlus } from 'lucide-react';

function DropOverlay({ visible }: { visible: boolean }) {
    if (!visible) return null;

    return (
        <div className="dropBackdrop">
            <div className="dropFrame">
                <ImagePlus size={40} />
                <span className="dropTitle">Drop images to attach</span>
            </div>
        </div>
    );
}

export default DropOverlay;

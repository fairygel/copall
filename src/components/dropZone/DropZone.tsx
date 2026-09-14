import { useEffect, useState } from 'react';
import DropOverlay from '../dropOverlay/DropOverlay';

function DropZone({ onDrop }: { onDrop: (data: DataTransfer) => void }) {
    const [dragDepth, setDragDepth] = useState(0);

    useEffect(() => {
        const hasDropPayload = (e: DragEvent) => {
            const types = e.dataTransfer?.types ?? [];

            return (
                types.includes('Files') ||
                types.includes('text/uri-list') ||
                types.includes('text/html')
            );
        };

        const handleDragEnter = (e: DragEvent) => {
            if (!hasDropPayload(e)) return;

            e.preventDefault();

            setDragDepth(prev => prev + 1);
        };

        const handleDragLeave = (e: DragEvent) => {
            if (!hasDropPayload(e)) return;

            e.preventDefault();

            setDragDepth(prev => Math.max(0, prev - 1));
        };

        const handleDragOver = (e: DragEvent) => {
            if (!hasDropPayload(e)) return;

            e.preventDefault();
        };

        const handleDrop = (e: DragEvent) => {
            if (!hasDropPayload(e)) return;

            e.preventDefault();

            setDragDepth(0);

            if (e.dataTransfer) onDrop(e.dataTransfer);
        };

        window.addEventListener('dragenter', handleDragEnter);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('dragenter', handleDragEnter);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('drop', handleDrop);
        };
    }, [onDrop]);

    return <DropOverlay visible={dragDepth > 0} />;
}

export default DropZone;

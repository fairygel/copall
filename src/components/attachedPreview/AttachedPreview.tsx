import './AttachedPreview.css';
import { Image, Plus, X } from 'lucide-react';
import AttachedFile from '../../models/AttachedFile';

function AttachedPreview({
    files,
    onAdd,
    onClose,
}: {
    files: AttachedFile[];
    onAdd: () => void;
    onClose: () => void;
}) {
    return (
        <div className="attachedBackdrop" onClick={onClose}>
            <div className="attachedContent" onClick={e => e.stopPropagation()}>
                <div className="attachedHeader">
                    <div />
                    <h4>Attached files</h4>
                    <button className="clickable" aria-label="Close attached files" onClick={onClose}>
                        <X size={14} />
                    </button>
                </div>
                <div className="attachedGrid">
                    {files.map(file => (
                        <div key={file.id} className="attachedItem" title={file.name}>
                            {file.base64 ? (
                                <img
                                    className="attachedThumb"
                                    src={`data:${file.mime};base64,${file.base64}`}
                                    alt={file.name}
                                />
                            ) : (
                                <span className="attachedFallback">
                                    <Image size={32} />
                                </span>
                            )}
                        </div>
                    ))}
                    <button className="attachedAdd" aria-label="Add file" onClick={onAdd}>
                        <Plus size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AttachedPreview;

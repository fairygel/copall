import { ArrowUp, Paperclip } from 'lucide-react';
import { useState, useEffect } from 'react';
import './MessageBox.css';
import AiModelSelect from '../select/AiModelSelect';
import AiModel from '../../models/AiModel';
import { getModelsFromCatalog } from '../../service/CatalogService';
import AttachedPreview from '../attachedPreview/AttachedPreview';
import DropZone from '../dropZone/DropZone';
import AttachedFile from '../../models/AttachedFile';
import PasteSnapshot from '../../models/PasteSnapshot';
import { selectAttachedFiles } from '../../service/FileService';
import {
    pastedToAttachedFiles,
    snapshotHasImage,
    snapshotPaste,
} from '../../service/ClipboardService';

function MessageBox({
    onMessageSent,
    disabled,
}: {
    onMessageSent: (msg: string, selectedModel: AiModel) => void;
    disabled: boolean;
}) {
    const [inputValue, setInputValue] = useState('');
    const [defaultModel, setDefaultModel] = useState<AiModel | null>(null);

    const [models, setModels] = useState<AiModel[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(true);

    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [pendingConversions, setPendingConversions] = useState(0);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const isConverting = pendingConversions > 0;

    useEffect(() => {
        getModelsFromCatalog()
            .then(setModels)
            .catch(e => console.error('Failed to load models:', e))
            .finally(() => setIsLoadingModels(false));
    }, []);

    useEffect(() => {
        if (models.length === 0) return;

        const savedModelId = localStorage.getItem('selectedModel');
        const savedModel = savedModelId ? (models.find(m => m.id === savedModelId) ?? null) : null;
        const model = savedModel || models[0] || null;

        if (model && !savedModel) {
            localStorage.setItem('selectedModel', model.id);
        }

        setDefaultModel(model);
    }, [models]);

    const isDisabled =
        disabled || inputValue.trim() === '' || isLoadingModels || !defaultModel || isConverting;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isDisabled) {
                onMessageSent(inputValue, defaultModel);
                setInputValue('');
            }
        }
    };

    const handleSendClick = () => {
        if (!isDisabled) {
            setInputValue('');
            onMessageSent(inputValue, defaultModel);
        }
    };

    const handleModelSelect = (model: AiModel | null) => {
        if (model) {
            localStorage.setItem('selectedModel', model.id);
        } else {
            localStorage.removeItem('selectedModel');
        }
        setDefaultModel(model);
    };

    const runWithCounter = (task: () => Promise<void>) => {
        setPendingConversions(prev => prev + 1);
        task()
            .catch(console.error)
            .finally(() => setPendingConversions(prev => prev - 1));
    };

    const applySnapshot = (snapshot: PasteSnapshot) => {
        const placeholderId = crypto.randomUUID();

        const hasImageHint = snapshotHasImage(snapshot) || snapshot.plain.trim() === '';

        if (hasImageHint) {
            const placeholder: AttachedFile = {
                id: placeholderId,
                name: 'clipboard.png',
                base64: null,
                mime: 'image/png',
            };

            setAttachedFiles(prev => [...prev, placeholder]);
        }

        return { placeholderId, hasImageHint };
    };

    const resolveSnapshot = (
        snapshot: PasteSnapshot,
        placeholderId: string,
        hasImageHint: boolean,
        insertText: (text: string) => void
    ) => {
        runWithCounter(async () => {
            const created = await pastedToAttachedFiles(snapshot);

            if (created.length > 0) {
                if (hasImageHint) {
                    const [first, ...rest] = created;

                    setAttachedFiles(prev =>
                        prev.map(file =>
                            file.id === placeholderId ? { ...first, id: placeholderId } : file
                        )
                    );

                    if (rest.length > 0) {
                        setAttachedFiles(prev => [...prev, ...rest]);
                    }
                } else {
                    setAttachedFiles(prev => [...prev, ...created]);
                }

                return;
            }

            if (hasImageHint) {
                setAttachedFiles(prev => prev.filter(file => file.id !== placeholderId));
            }

            if (snapshot.plain !== '') {
                insertText(snapshot.plain);
            }
        });
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();

        const snapshot = snapshotPaste(e.clipboardData);
        const target = e.currentTarget;
        const start = target.selectionStart ?? inputValue.length;
        const end = target.selectionEnd ?? start;

        const { placeholderId, hasImageHint } = applySnapshot(snapshot);

        resolveSnapshot(snapshot, placeholderId, hasImageHint, text =>
            setInputValue(prev => prev.slice(0, start) + text + prev.slice(end))
        );
    };

    const handleDrop = (data: DataTransfer) => {
        const snapshot = snapshotPaste(data);

        if (!snapshotHasImage(snapshot)) return;

        const { placeholderId, hasImageHint } = applySnapshot(snapshot);

        resolveSnapshot(snapshot, placeholderId, hasImageHint, () => {});
    };

    const addFiles = () => {
        runWithCounter(async () => {
            try {
                const created = await selectAttachedFiles();

                if (created.length > 0) {
                    setAttachedFiles(prev => [...prev, ...created]);
                }
            } catch (e) {
                console.error(e);
            }
        });
    };

    const attachFiles = () => {
        if (attachedFiles.length > 0) {
            setIsPreviewOpen(true);
            return;
        }

        addFiles();
    };

    return (
        <div className="messageContainer">
            <DropZone onDrop={handleDrop} />
            <textarea
                className="inputArea"
                autoFocus
                placeholder="Your move, Ask!"
                value={inputValue}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onChange={e => setInputValue(e.target.value)}
            />
            <div className="tooltip">
                <div className="left-tooltip">
                    <button
                        className="clickable attachButton"
                        aria-label="Attach files"
                        onClick={attachFiles}
                    >
                        <Paperclip size={18} />
                        {attachedFiles.length > 0 && (
                            <span className="attachedLabel">
                                {isConverting
                                    ? 'Processing...'
                                    : `${attachedFiles.length} Attached`}
                            </span>
                        )}
                    </button>
                    <AiModelSelect
                        list={models}
                        onSelect={handleModelSelect}
                        defaultItem={defaultModel ?? undefined}
                        disabled={isLoadingModels || disabled}
                    />
                </div>

                <button className="sendMessage" disabled={isDisabled} onClick={handleSendClick}>
                    <ArrowUp size={20} />
                </button>
            </div>
            {isPreviewOpen && (
                <AttachedPreview
                    files={attachedFiles}
                    onAdd={addFiles}
                    onClose={() => setIsPreviewOpen(false)}
                />
            )}
        </div>
    );
}

export default MessageBox;

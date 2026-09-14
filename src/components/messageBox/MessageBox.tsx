import { ArrowUp, LoaderCircle, Paperclip } from 'lucide-react';
import { useState, useEffect } from 'react';
import './MessageBox.css';
import AiModelSelect from '../select/AiModelSelect';
import AiModel from '../../models/AiModel';
import { getModelsFromCatalog } from '../../service/CatalogService';
import AttachedPreview from '../attachedPreview/AttachedPreview';
import DropZone from '../dropZone/DropZone';
import Toast from '../toast/Toast';
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
    isSending,
}: {
    onMessageSent: (msg: string, selectedModel: AiModel, files: AttachedFile[]) => void;
    disabled: boolean;
    isSending: boolean;
}) {
    const [inputValue, setInputValue] = useState('');
    const [defaultModel, setDefaultModel] = useState<AiModel | null>(null);

    const [models, setModels] = useState<AiModel[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(true);

    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [pendingConversions, setPendingConversions] = useState(0);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
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

    const canSend = Boolean(inputValue.trim() || attachedFiles.length > 0);
    const modelSupportsImages =
        !defaultModel || defaultModel.inputModalities.includes('image');
    const isDisabled =
        disabled ||
        isSending ||
        !canSend ||
        isLoadingModels ||
        !defaultModel ||
        isConverting;

    const sendMessage = () => {
        if (isDisabled || !defaultModel) return;

        if (attachedFiles.length > 0 && !defaultModel.inputModalities.includes('image')) {
            setToast('Sent as text only — this model cannot see images');
            onMessageSent(inputValue, defaultModel, []);
            setInputValue('');
            return;
        }

        onMessageSent(inputValue, defaultModel, attachedFiles);
        setInputValue('');
        setAttachedFiles([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
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
                        setAttachedFiles(prev => [...prev, ...created.slice(1)]);
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
        const snapshot = snapshotPaste(e.clipboardData);

        if (!snapshotHasImage(snapshot)) return;

        e.preventDefault();

        const { placeholderId, hasImageHint } = applySnapshot(snapshot);

        resolveSnapshot(snapshot, placeholderId, hasImageHint, text => {
            const target = e.target as HTMLTextAreaElement;

            setInputValue(prev => {
                const start = target.selectionStart ?? prev.length;
                const end = target.selectionEnd ?? start;

                return prev.slice(0, start) + text + prev.slice(end);
            });
        });
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

    const removeFile = (id: string) => {
        setAttachedFiles(prev => prev.filter(file => file.id !== id));
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
            {toast && <Toast message={toast} onDone={() => setToast(null)} />}
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
                    {attachedFiles.length > 0 && !modelSupportsImages && (
                        <span className="visionWarning" title="This model cannot see images">
                            No vision
                        </span>
                    )}
                </div>

                <button className="sendMessage" disabled={isDisabled} onClick={sendMessage}>
                    {isSending ? <LoaderCircle size={20} className="sendingSpinner" /> : <ArrowUp size={20} />}
                </button>
            </div>
            {isPreviewOpen && (
                <AttachedPreview
                    files={attachedFiles}
                    onAdd={addFiles}
                    onRemove={removeFile}
                    onClose={() => setIsPreviewOpen(false)}
                />
            )}
        </div>
    );
}

export default MessageBox;

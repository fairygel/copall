import { ArrowUp, Lightbulb, LoaderCircle, Paperclip } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import './MessageBox.css';
import AiModelSelect from '../select/AiModelSelect';
import ReasoningSelect, { ReasoningSelectHandle } from '../reasoning/ReasoningSelect';
import AiModel, { REASONING_LEVELS, type ReasoningLevel } from '../../models/AiModel';
import type { ReasoningChoice } from '../../service/ai-client/BaseClient';
import { getModelsFromCatalog } from '../../service/CatalogService';
import {
    API_KEYS_CHANGED_EVENT,
    getAvailableProviderIds,
    getShowOnlyAvailableProviders,
} from '../../config/AiProviderConfig';
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

function readSavedReasoningLevel(): ReasoningChoice {
    const saved = localStorage.getItem('reasoningLevel');
    if (saved === 'default') return 'default';
    if (saved !== null && (REASONING_LEVELS as readonly string[]).includes(saved)) {
        return saved as ReasoningLevel;
    }
    return 'default';
}

function MessageBox({
    onMessageSent,
    disabled,
    isSending,
}: {
    onMessageSent: (
        msg: string,
        selectedModel: AiModel,
        files: AttachedFile[],
        reasoning: ReasoningChoice
    ) => void;
    disabled: boolean;
    isSending: boolean;
}) {
    const [inputValue, setInputValue] = useState('');
    const [defaultModel, setDefaultModel] = useState<AiModel | null>(null);

    const [models, setModels] = useState<AiModel[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(true);
    const [showOnlyAvailable, setShowOnlyAvailable] = useState(() =>
        getShowOnlyAvailableProviders()
    );
    const [availableProviders, setAvailableProviders] = useState<string[]>(() =>
        getAvailableProviderIds()
    );

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
        const refresh = () => {
            setAvailableProviders(getAvailableProviderIds());
            setShowOnlyAvailable(getShowOnlyAvailableProviders());
        };
        window.addEventListener(API_KEYS_CHANGED_EVENT, refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener(API_KEYS_CHANGED_EVENT, refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);

    const visibleModels = useMemo(
        () =>
            showOnlyAvailable
                ? models.filter(m => availableProviders.includes(m.provider.id))
                : models,
        [models, availableProviders, showOnlyAvailable]
    );

    useEffect(() => {
        if (visibleModels.length === 0) {
            setDefaultModel(null);
            return;
        }

        const savedModelId = localStorage.getItem('selectedModel');
        const savedModel = savedModelId
            ? (visibleModels.find(m => m.id === savedModelId) ?? null)
            : null;
        const model = savedModel || visibleModels[0] || null;

        if (model && !savedModel) {
            localStorage.setItem('selectedModel', model.id);
        }

        setDefaultModel(model);
    }, [visibleModels]);

    const canSend = Boolean(inputValue.trim() || attachedFiles.length > 0);
    const modelSupportsImages =
        !defaultModel || defaultModel.inputModalities.includes('image');
    const modelSupportsReasoning = Boolean(defaultModel?.reasoning.supported);
    const reasoningLevels = defaultModel?.reasoning.levels ?? [];
    const [reasoningLevel, setReasoningLevel] = useState<ReasoningChoice>(() =>
        readSavedReasoningLevel()
    );
    const reasoningSelectRef = useRef<ReasoningSelectHandle>(null);
    const reasoningActive =
        modelSupportsReasoning && reasoningLevel !== 'default';
    const isDisabled =
        disabled ||
        isSending ||
        !canSend ||
        isLoadingModels ||
        !defaultModel ||
        isConverting;

    const sendMessage = () => {
        if (isDisabled || !defaultModel) return;

        const effectiveReasoning: ReasoningChoice =
            modelSupportsReasoning && reasoningLevel !== 'default' ? reasoningLevel : 'default';

        if (attachedFiles.length > 0 && !defaultModel.inputModalities.includes('image')) {
            setToast('Sent as text only — this model cannot see images');
            onMessageSent(inputValue, defaultModel, [], effectiveReasoning);
            setInputValue('');
            return;
        }

        onMessageSent(inputValue, defaultModel, attachedFiles, effectiveReasoning);
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
        if (
            model?.reasoning.supported &&
            reasoningLevel !== 'default' &&
            model.reasoning.levels.includes(reasoningLevel)
        ) {
            return;
        }
        if (model && model.reasoning.supported) {
            const saved = readSavedReasoningLevel();
            if (saved !== 'default' && model.reasoning.levels.includes(saved)) {
                setReasoningLevel(saved);
                return;
            }
        }
        setReasoningLevel('default');
    };

    const handleReasoningSelect = (level: ReasoningChoice) => {
        localStorage.setItem('reasoningLevel', level);
        setReasoningLevel(level);
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
                        list={visibleModels}
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

                <div className="right-tooltip">
                    <ReasoningSelect
                        ref={reasoningSelectRef}
                        levels={reasoningLevels}
                        value={reasoningLevel}
                        onSelect={handleReasoningSelect}
                        disabled={!modelSupportsReasoning}
                    />
                    <button
                        type="button"
                        className={`reasoningIndicator${reasoningActive ? ' active' : ''}`}
                        title={
                            reasoningActive
                                ? `Reasoning: ${reasoningLevel}`
                                : modelSupportsReasoning
                                  ? undefined
                                  : 'This model does not support reasoning'
                        }
                        onClick={() => reasoningSelectRef.current?.toggle()}
                    >
                        <Lightbulb size={18} />
                    </button>
                    <button className="sendMessage" disabled={isDisabled} onClick={sendMessage}>
                        {isSending ? <LoaderCircle size={20} className="sendingSpinner" /> : <ArrowUp size={20} />}
                    </button>
                </div>
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

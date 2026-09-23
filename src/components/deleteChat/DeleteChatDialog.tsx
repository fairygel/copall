import './DeleteChatDialog.css';

function DeleteChatDialog({
    chatName,
    onConfirm,
    onCancel,
}: {
    chatName: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="modalBackdrop deleteChatBackdrop" onClick={onCancel}>
            <div
                className="modalContent deleteChatDialog"
                onClick={e => e.stopPropagation()}
            >
                <div className="modalHeader">
                    <div />
                    <h3>Delete chat?</h3>
                    <div />
                </div>
                <div className="modalBody">
                    <p>
                        &ldquo;{chatName}&rdquo; will be deleted permanently. This cannot be undone.
                    </p>
                    <div className="deleteChatActions">
                        <button className="deleteChatButton" onClick={onCancel}>
                            Cancel
                        </button>
                        <button
                            className="deleteChatButton deleteChatPrimary"
                            onClick={onConfirm}
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DeleteChatDialog;

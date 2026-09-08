import './UpdateDialog.css';

function UpdateDialog({
    version,
    onUpdate,
    onLater,
}: {
    version: string;
    onUpdate: () => void;
    onLater: () => void;
}) {
    return (
        <div className="modalBackdrop" onClick={onLater}>
            <div className="modalContent updateDialog" onClick={e => e.stopPropagation()}>
                <div className="modalHeader">
                    <div />
                    <h3>Update available</h3>
                    <div />
                </div>
                <div className="modalBody">
                    <p>A new version {version} is available. Update now?</p>
                    <div className="updateActions">
                        <button className="updateButton updatePrimary" onClick={onUpdate}>
                            Update
                        </button>
                        <button className="updateButton" onClick={onLater}>
                            Later
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default UpdateDialog;

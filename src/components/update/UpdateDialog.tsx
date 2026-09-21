import './UpdateDialog.css';

function UpdateDialog({
    version,
    downloadState,
    downloadPercent,
    onUpdate,
    onLater,
}: {
    version: string;
    downloadState: 'idle' | 'downloading' | 'downloaded';
    downloadPercent: number;
    onUpdate: () => void;
    onLater: () => void;
}) {
    const isDownloading = downloadState !== 'idle';
    const statusText =
        downloadState === 'downloaded'
            ? 'Update downloaded, restarting…'
            : `Downloading… ${downloadPercent}%`;
    return (
        <div className="modalBackdrop" onClick={isDownloading ? undefined : onLater}>
            <div className="modalContent updateDialog" onClick={e => e.stopPropagation()}>
                <div className="modalHeader">
                    <div />
                    <h3>Update available</h3>
                    <div />
                </div>
                <div className="modalBody">
                    <p>
                        A new version {version} is available. Update now?
                    </p>
                    {isDownloading && (
                        <div className="updateProgress">
                            <div
                                className="updateProgressBar"
                                style={{ width: `${downloadState === 'downloaded' ? 100 : downloadPercent}%` }}
                            />
                        </div>
                    )}
                    {isDownloading && <p className="updateStatus">{statusText}</p>}
                    <div className="updateActions">
                        <button
                            className="updateButton updatePrimary"
                            onClick={onUpdate}
                            disabled={isDownloading}
                        >
                            {isDownloading ? 'Downloading…' : 'Update'}
                        </button>
                        <button
                            className="updateButton"
                            onClick={onLater}
                            disabled={isDownloading}
                        >
                            Later
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default UpdateDialog;

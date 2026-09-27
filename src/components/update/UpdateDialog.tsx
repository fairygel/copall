import './UpdateDialog.css';

function UpdateDialog({
    version,
    downloadState,
    downloadPercent,
    isRestarting,
    restartError,
    onUpdate,
    onLater,
    onRestartNow,
}: {
    version: string;
    downloadState: 'idle' | 'downloading' | 'downloaded';
    downloadPercent: number;
    isRestarting: boolean;
    restartError: string | null;
    onUpdate: () => void;
    onLater: () => void;
    onRestartNow: () => void;
}) {
    const isDownloading = downloadState === 'downloading';
    const isDownloaded = downloadState === 'downloaded';
    const statusText = isDownloaded
        ? 'Update downloaded and ready to install.'
        : `Downloading… ${downloadPercent}%`;
    return (
        <div className="modalBackdrop" onClick={isDownloading || isRestarting ? undefined : onLater}>
            <div className="modalContent updateDialog" onClick={e => e.stopPropagation()}>
                <div className="modalHeader">
                    <div />
                    <h3>Update available</h3>
                    <div />
                </div>
                <div className="modalBody">
                    <p>
                        A new version {version} is available.{' '}
                        {isDownloaded ? 'Restart the app to install it?' : 'Update now?'}
                    </p>
                    {(isDownloading || isDownloaded) && (
                        <div className="updateProgress">
                            <div
                                className="updateProgressBar"
                                style={{ width: `${isDownloaded ? 100 : downloadPercent}%` }}
                            />
                        </div>
                    )}
                    {(isDownloading || isDownloaded) && <p className="updateStatus">{statusText}</p>}
                    {restartError && <p className="updateError">{restartError}</p>}
                    <div className="updateActions">
                        {isDownloaded ? (
                            <button
                                className="updateButton updatePrimary"
                                onClick={onRestartNow}
                                disabled={isRestarting}
                            >
                                {isRestarting ? 'Restarting…' : 'Restart now'}
                            </button>
                        ) : (
                            <button
                                className="updateButton updatePrimary"
                                onClick={onUpdate}
                                disabled={isDownloading}
                            >
                                {isDownloading ? 'Downloading…' : 'Update'}
                            </button>
                        )}
                        <button
                            className="updateButton"
                            onClick={onLater}
                            disabled={isDownloading || isRestarting}
                        >
                            {isDownloaded ? 'Later' : 'Later'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default UpdateDialog;

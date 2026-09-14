import { useEffect } from 'react';
import './Toast.css';

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onDone, 2600);

        return () => clearTimeout(timer);
    }, [message, onDone]);

    return (
        <div className="toast" role="status">
            {message}
        </div>
    );
}

export default Toast;

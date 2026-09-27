import { useCallback, useEffect, useRef, useState } from 'react';
import './HScroll.css';

const HIDE_DELAY = 1200;
const MIN_THUMB = 24;

function HScroll({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    const hideTimer = useRef<number | null>(null);
    const dragState = useRef<{ startX: number; startLeft: number } | null>(null);

    const [visible, setVisible] = useState(false);
    const [thumb, setThumb] = useState({ left: 0, width: 0 });

    const poke = useCallback(() => {
        setVisible(true);
        if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
        hideTimer.current = window.setTimeout(() => {
            hideTimer.current = null;
            if (!dragState.current) setVisible(false);
        }, HIDE_DELAY);
    }, []);

    const syncThumb = useCallback(() => {
        const el = viewportRef.current;
        const thumbEl = thumbRef.current;
        if (!el) return;

        const { scrollLeft, scrollWidth, clientWidth } = el;
        const track = barRef.current?.clientWidth ?? clientWidth;

        if (scrollWidth <= clientWidth + 1 || track <= 0) {
            setThumb({ left: 0, width: 0 });
            return;
        }

        const width = Math.max(MIN_THUMB, (clientWidth / scrollWidth) * track);
        const maxLeft = track - width;
        const left = maxLeft <= 0 ? 0 : (scrollLeft / (scrollWidth - clientWidth)) * maxLeft;

        if (dragState.current && thumbEl) {
            thumbEl.style.left = `${left}px`;
            thumbEl.style.width = `${width}px`;
            return;
        }

        setThumb({ left, width });
    }, []);

    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;

        const sync = () => requestAnimationFrame(syncThumb);
        sync();

        const resize = new ResizeObserver(sync);
        resize.observe(el);
        if (barRef.current) resize.observe(barRef.current);

        const mutation = new MutationObserver(sync);
        mutation.observe(el, { childList: true, subtree: true, characterData: true });

        const onScroll = () => {
            syncThumb();
            poke();
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', sync);

        return () => {
            resize.disconnect();
            mutation.disconnect();
            el.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', sync);
        };
    }, [syncThumb, poke]);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const drag = dragState.current;
            const el = viewportRef.current;
            if (!drag || !el) return;

            const track = barRef.current?.clientWidth ?? el.clientWidth;
            const width = Math.max(MIN_THUMB, (el.clientWidth / el.scrollWidth) * track);
            const maxLeft = Math.max(1, track - width);
            const delta = e.clientX - drag.startX;
            const ratio = (drag.startLeft + delta) / maxLeft;

            el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth);
        };

        const onUp = () => {
            if (!dragState.current) return;
            dragState.current = null;
            syncThumb();
            poke();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [poke, syncThumb]);

    const onThumbDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragState.current = { startX: e.clientX, startLeft: thumb.left };
        poke();
    };

    const onTrackClick = (e: React.MouseEvent) => {
        const el = viewportRef.current;
        if (!el || e.target !== e.currentTarget) return;

        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        el.scrollLeft = ratio * el.scrollWidth - el.clientWidth / 2;
        poke();
    };

    return (
        <div
            className={`hscroll${className ? ` ${className}` : ''}${visible && thumb.width > 0 ? ' hscroll-visible' : ''}`}
            onMouseEnter={poke}
        >
            <div ref={viewportRef} className="hscroll-viewport">
                {children}
            </div>
            {thumb.width > 0 && (
                <div ref={barRef} className="hscroll-bar" onMouseDown={onTrackClick}>
                    <div
                        ref={thumbRef}
                        className="hscroll-thumb"
                        style={{ left: thumb.left, width: thumb.width }}
                        onMouseDown={onThumbDown}
                    />
                </div>
            )}
        </div>
    );
}

export default HScroll;

import { useCallback, useEffect, useRef, useState } from 'react';

const HIDE_DELAY = 1200;
const MIN_THUMB = 32;

function ChatScroll({ children }: { children: React.ReactNode }) {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    const hideTimer = useRef<number | null>(null);
    const dragState = useRef<{ startY: number; startTop: number } | null>(null);

    const [visible, setVisible] = useState(false);
    const [thumb, setThumb] = useState({ top: 0, height: 0 });

    const poke = useCallback(() => {
        setVisible(true);

        if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
        hideTimer.current = window.setTimeout(() => {
            hideTimer.current = null;
            if (!dragState.current) setVisible(false);
        }, HIDE_DELAY);
    }, []);

    const trackLength = useCallback(() => {
        return barRef.current?.clientHeight ?? viewportRef.current?.clientHeight ?? 0;
    }, []);

    const syncThumb = useCallback(() => {
        const el = viewportRef.current;
        const thumbEl = thumbRef.current;
        if (!el) return;

        const { scrollTop, scrollHeight, clientHeight } = el;

        if (scrollHeight <= clientHeight + 1) {
            setThumb({ top: 0, height: 0 });
            return;
        }

        const track = trackLength();
        if (track <= 0) return;

        const height = Math.max(MIN_THUMB, (clientHeight / scrollHeight) * track);
        const maxTop = track - height;
        const top = maxTop <= 0 ? 0 : (scrollTop / (scrollHeight - clientHeight)) * maxTop;

        if (dragState.current && thumbEl) {
            thumbEl.style.top = `${top}px`;
            thumbEl.style.height = `${height}px`;
            return;
        }

        setThumb({ top, height });
    }, [trackLength]);

    useEffect(() => {
        const el = viewportRef.current;
        const host = hostRef.current;
        if (!el || !host) return;

        const syncTrack = () => {
            const box = document.querySelector('.messageContainer') as HTMLElement | null;
            const gap = 12;

            if (box) {
                const hostRect = host.getBoundingClientRect();
                const boxRect = box.getBoundingClientRect();
                const overlap = hostRect.bottom - boxRect.top + gap;
                host.style.setProperty(
                    '--chatScroll-bottom',
                    `${Math.max(24, Math.round(overlap))}px`
                );
            }

            requestAnimationFrame(syncThumb);
        };

        syncTrack();

        const resize = new ResizeObserver(syncTrack);
        resize.observe(el);
        resize.observe(host);
        if (barRef.current) resize.observe(barRef.current);
        if (document.body) resize.observe(document.body);

        const mutation = new MutationObserver(syncTrack);
        mutation.observe(el, { childList: true, subtree: true, characterData: true });

        el.addEventListener('scroll', syncThumb, { passive: true });
        window.addEventListener('resize', syncTrack);

        return () => {
            resize.disconnect();
            mutation.disconnect();
            el.removeEventListener('scroll', syncThumb);
            window.removeEventListener('resize', syncTrack);
        };
    }, [syncThumb]);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        const onLeave = () => {
            if (hideTimer.current !== null) {
                window.clearTimeout(hideTimer.current);
                hideTimer.current = null;
            }
            if (!dragState.current) setVisible(false);
        };

        host.addEventListener('mousemove', poke, { passive: true });
        host.addEventListener('wheel', poke, { passive: true });
        host.addEventListener('touchmove', poke, { passive: true });
        host.addEventListener('mouseleave', onLeave);

        return () => {
            host.removeEventListener('mousemove', poke);
            host.removeEventListener('wheel', poke);
            host.removeEventListener('touchmove', poke);
            host.removeEventListener('mouseleave', onLeave);
            if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
        };
    }, [poke]);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const drag = dragState.current;
            const el = viewportRef.current;
            if (!drag || !el) return;

            const track = trackLength();
            const height = Math.max(
                MIN_THUMB,
                (el.clientHeight / el.scrollHeight) * track
            );
            const maxTop = Math.max(1, track - height);
            const delta = e.clientY - drag.startY;
            const ratio = (drag.startTop + delta) / maxTop;

            el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
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
    }, [poke, syncThumb, trackLength]);

    const onThumbDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragState.current = { startY: e.clientY, startTop: thumb.top };
        poke();
    };

    const onTrackClick = (e: React.MouseEvent) => {
        const el = viewportRef.current;
        if (!el || e.target !== e.currentTarget) return;

        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const ratio = (e.clientY - rect.top) / rect.height;
        el.scrollTop = ratio * el.scrollHeight - el.clientHeight / 2;
        poke();
    };

    return (
        <div
            ref={hostRef}
            className={`chatScroll-host${visible && thumb.height > 0 ? ' scroll-visible' : ''}`}
        >
            <div ref={viewportRef} className="chatContainer chatScroll-viewport">
                {children}
            </div>
            {thumb.height > 0 && (
                <div ref={barRef} className="chatScroll-bar" onMouseDown={onTrackClick}>
                    <div
                        ref={thumbRef}
                        className="chatScroll-thumb"
                        style={{ top: thumb.top, height: thumb.height }}
                        onMouseDown={onThumbDown}
                    />
                </div>
            )}
        </div>
    );
}

export default ChatScroll;

import React from 'react';
import { Search } from 'lucide-react';
import { openUrl } from '../../service/NativeBridge';

export function isExternalUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
}

export function handleTailLinkClick(e: React.MouseEvent, url: string): void {
    if (!isExternalUrl(url)) return;
    e.preventDefault();
    e.stopPropagation();
    openUrl(url).catch(console.error);
}

export function handleTailImageError(e: React.SyntheticEvent<HTMLImageElement>): void {
    e.currentTarget.style.display = 'none';
}

export interface CharToken {
    key: number;
    ch: string;
    bold: boolean;
    italic: boolean;
    code: boolean;
    link: number;
}

interface LinkSpan {
    from: number;
    to: number;
    urlFrom: number;
    urlTo: number;
    image: boolean;
    imageAlt: string;
    title?: string;
}

interface StyleRange {
    from: number;
    to: number;
    style: 'bold' | 'italic' | 'code';
    link: number;
}

const isSpace = (ch: string | undefined): boolean =>
    ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';

const isWordChar = (ch: string | undefined): boolean =>
    !!ch && /[\p{L}\p{N}]/u.test(ch);

function rangeCovers(ranges: StyleRange[], index: number): StyleRange | undefined {
    return ranges.find(range => index >= range.from && index < range.to);
}

function pairMarkers(
    occurrences: number[],
    markerLen: number,
    style: 'bold' | 'italic',
    canOpen: (index: number) => boolean,
    canClose: (index: number) => boolean
): { ranges: StyleRange[]; consumed: Set<number> } {
    const ranges: StyleRange[] = [];
    const consumed = new Set<number>();
    const stack: number[] = [];

    for (const index of occurrences) {
        if (canClose(index) && stack.length > 0) {
            const opener = stack.pop() as number;
            ranges.push({ from: opener + markerLen, to: index, style, link: -1 });
            for (let j = 0; j < markerLen; j++) {
                consumed.add(opener + j);
                consumed.add(index + j);
            }
        } else if (canOpen(index)) {
            stack.push(index);
        }
    }

    return { ranges, consumed };
}

function findCodeRanges(chars: string[]): { ranges: StyleRange[]; consumed: Set<number> } {
    const ticks: number[] = [];
    chars.forEach((ch, index) => {
        if (ch === '`') ticks.push(index);
    });

    const ranges: StyleRange[] = [];
    const consumed = new Set<number>();

    let k = 0;
    while (k + 1 < ticks.length) {
        const a = ticks[k];
        const b = ticks[k + 1];
        if (b > a + 1) {
            ranges.push({ from: a + 1, to: b, style: 'code', link: -1 });
            consumed.add(a);
            consumed.add(b);
            k += 2;
        } else {
            k += 1;
        }
    }

    return { ranges, consumed };
}

function findLinkSpans(
    chars: string[],
    allowed: (index: number) => boolean
): { spans: LinkSpan[]; consumed: Set<number> } {
    const spans: LinkSpan[] = [];
    const consumed = new Set<number>();
    const occupied = new Set<number>();

    const claim = (from: number, to: number): boolean => {
        for (let i = from; i < to; i++) {
            if (occupied.has(i) || !allowed(i)) return false;
        }
        for (let i = from; i < to; i++) occupied.add(i);
        return true;
    };

    const readBracket = (
        open: number
    ): { textFrom: number; textTo: number; close: number; image: boolean } | null => {
        let image = false;
        let start = open;
        if (chars[start] === '!') {
            const next = start + 1;
            if (chars[next] !== '[' || !allowed(start)) return null;
            image = true;
            start = next;
        } else if (chars[start] !== '[') {
            return null;
        }
        if (!allowed(start)) return null;

        let depth = 0;
        for (let i = start + 1; i < chars.length; i++) {
            if (!allowed(i)) return null;
            if (chars[i] === '\\' && i + 1 < chars.length) {
                i++;
                continue;
            }
            if (chars[i] === '[') depth++;
            else if (chars[i] === ']') {
                if (depth === 0) return { textFrom: start + 1, textTo: i, close: i, image };
                depth--;
            }
        }
        return null;
    };

    const readDestination = (
        open: number
    ): { urlFrom: number; urlTo: number; title?: string; close: number } | null => {
        if (!allowed(open)) return null;
        let probe = open + 1;
        let depth = 0;
        let quote: string | null = null;
        let closed = false;
        while (probe < chars.length) {
            if (!allowed(probe)) return null;
            const ch = chars[probe];
            if (quote !== null) {
                if (ch === quote) quote = null;
            } else if (ch === '"' || ch === "'") {
                quote = ch;
            } else if (ch === '(') {
                depth++;
            } else if (ch === ')') {
                if (depth === 0) {
                    closed = true;
                    break;
                }
                depth--;
            }
            probe++;
        }
        if (!closed || quote !== null) return null;

        let i = open + 1;
        while (i < chars.length && (chars[i] === ' ' || chars[i] === '\t')) i++;
        if (i >= chars.length) return null;

        let urlFrom = i;
        let urlTo = i;
        if (chars[i] === '<') {
            urlFrom = i + 1;
            let j = urlFrom;
            while (j < chars.length && chars[j] !== '>' && chars[j] !== '\n' && chars[j] !== '\r') {
                if (!allowed(j)) return null;
                j++;
            }
            if (j >= chars.length || chars[j] !== '>') return null;
            if (!allowed(j)) return null;
            urlTo = j;
            i = j + 1;
        } else {
            let j = i;
            let depth = 0;
            while (j < chars.length) {
                const ch = chars[j];
                if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') break;
                if (ch === '(') depth++;
                else if (ch === ')') {
                    if (depth === 0) break;
                    depth--;
                }
                if (!allowed(j)) return null;
                j++;
            }
            urlTo = j;
            i = j;
        }

        const rawUrl = chars.slice(urlFrom, urlTo).join('');
        if (rawUrl === '') return null;

        while (i < chars.length && (chars[i] === ' ' || chars[i] === '\t')) i++;

        let title: string | undefined;
        if (i < chars.length && (chars[i] === '"' || chars[i] === "'")) {
            const quote = chars[i];
            let j = i + 1;
            while (j < chars.length && chars[j] !== quote) {
                if (!allowed(j)) return null;
                j++;
            }
            if (j >= chars.length) return null;
            if (!allowed(j)) return null;
            title = chars.slice(i + 1, j).join('');
            i = j + 1;
            while (i < chars.length && (chars[i] === ' ' || chars[i] === '\t')) i++;
        }

        if (i >= chars.length || chars[i] !== ')' || !allowed(i)) return null;
        return { urlFrom, urlTo, title, close: i };
    };

    const inOccupied = (from: number, to: number): boolean => {
        for (let j = from; j < to; j++) {
            if (occupied.has(j)) return true;
        }
        return false;
    };

    for (let i = 0; i < chars.length; i++) {
        if (chars[i] !== '<' || !allowed(i)) continue;
        let j = i + 1;
        while (j < chars.length && chars[j] !== '>' && !isSpace(chars[j])) {
            if (!allowed(j)) break;
            j++;
        }
        if (j >= chars.length || chars[j] !== '>' || !allowed(j)) continue;
        const url = chars.slice(i + 1, j).join('');
        if (!/^https?:\/\/\S+$/i.test(url)) continue;
        if (inOccupied(i, j + 1)) continue;
        if (!claim(i, j + 1)) continue;
        spans.push({ from: i + 1, to: j, urlFrom: i + 1, urlTo: j, image: false, imageAlt: '' });
        consumed.add(i);
        consumed.add(j);
    }

    const TRAILING = new Set(['.', ',', ';', ':', '!', '?', ')', ']', "'"]);
    {
        let i = 0;
        while (i < chars.length) {
            const rest = chars.slice(i).join('');
            const match = /^https?:\/\/\S+/i.exec(rest);
            if (!match) {
                i++;
                continue;
            }
            const rawEnd = i + match[0].length;
            let end = rawEnd;
            while (end > i && TRAILING.has(chars[end - 1])) end--;
            if (end <= i) {
                i++;
                continue;
            }
            if (inOccupied(i, end)) {
                i = end;
                continue;
            }
            if (!claim(i, end)) {
                i = end;
                continue;
            }
            spans.push({ from: i, to: end, urlFrom: i, urlTo: end, image: false, imageAlt: '' });
            i = end;
        }
    }

    const insideReadySpan = (from: number, to: number): boolean =>
        spans.some(span => {
            const spanFrom = span.image ? span.from - 1 : span.from;
            return from >= spanFrom && to <= span.urlTo + 1;
        });

    const absorb = (from: number, to: number): void => {
        for (let s = spans.length - 1; s >= 0; s--) {
            const span = spans[s];
            if (span.from !== span.urlFrom) continue;
            const spanTo = span.urlTo;
            if (span.from < to && spanTo > from) {
                spans.splice(s, 1);
                for (let j = span.from; j < spanTo; j++) occupied.delete(j);
                for (const j of Array.from(consumed)) {
                    if (j >= span.from && j < spanTo) consumed.delete(j);
                }
            }
        }
    };

    const takeInline = (onlyImage: boolean): void => {
        const step = onlyImage ? -1 : 1;
        const start = onlyImage ? chars.length - 1 : 0;
        const cont = (i: number): boolean => (onlyImage ? i >= 0 : i < chars.length);
        for (let i = start; cont(i); i += step) {
            if (chars[i] !== '[') continue;
            const bang = chars[i - 1] === '!' && allowed(i - 1);
            if (onlyImage && !bang) continue;
            if (!onlyImage && bang) continue;
            const open = bang ? i - 1 : i;
            const bracket = readBracket(open);
            if (!bracket) continue;
            if (bracket.image !== onlyImage) continue;
            const paren = chars[bracket.close + 1] === '(' ? bracket.close + 1 : -1;
            if (paren === -1) continue;
            const dest = readDestination(paren);
            if (!dest) continue;

            const totalFrom = open;
            const totalTo = dest.close + 1;
            if (onlyImage && insideReadySpan(totalFrom, totalTo)) continue;
            absorb(totalFrom, totalTo);
            if (!claim(totalFrom, totalTo)) continue;

            const imageAlt = bracket.image
                ? chars.slice(bracket.textFrom, bracket.textTo).join('')
                : '';
            spans.push({
                from: bracket.textFrom,
                to: bracket.textTo,
                urlFrom: dest.urlFrom,
                urlTo: dest.urlTo,
                image: bracket.image,
                imageAlt,
                title: dest.title,
            });

            for (let j = totalFrom; j < totalTo; j++) {
                const visible =
                    !bracket.image && j >= bracket.textFrom && j < bracket.textTo;
                if (!visible) consumed.add(j);
            }

            if (!onlyImage) i = totalTo - 1;
        }
    };

    takeInline(false);
    takeInline(true);

    spans.sort((a, b) => a.from - b.from);
    return { spans, consumed };
}

export function parseInline(line: string, keyBase = 0): { tokens: CharToken[]; links: LinkSpan[] } {
    const chars = Array.from(line);
    const code = findCodeRanges(chars);
    const inCode = (index: number): boolean =>
        code.consumed.has(index) || rangeCovers(code.ranges, index) !== undefined;

    const links = findLinkSpans(chars, (index: number) => !inCode(index));
    const inLinkSyntax = (index: number): boolean =>
        links.consumed.has(index) ||
        links.spans.some(span => index >= span.from && index < span.to && !isLinkText(index, span));
    const inLink = (index: number): number =>
        links.spans.findIndex(span => index >= span.from && index < span.to);

    const starStar: number[] = [];
    for (let i = 0; i + 1 < chars.length; i++) {
        if (chars[i] !== '*' || chars[i + 1] !== '*') continue;
        if (chars[i - 1] === '*' || chars[i + 2] === '*') continue;
        if (inCode(i) || inCode(i + 1) || inLinkSyntax(i) || inLinkSyntax(i + 1)) continue;
        starStar.push(i);
    }
    const boldStar = pairMarkers(
        starStar,
        2,
        'bold',
        i => chars[i + 2] !== undefined && !isSpace(chars[i + 2]),
        i => chars[i - 1] !== undefined && !isSpace(chars[i - 1])
    );

    const usedAfterBoldStar = new Set([...code.consumed, ...boldStar.consumed]);
    const underUnder: number[] = [];
    for (let i = 0; i + 1 < chars.length; i++) {
        if (chars[i] !== '_' || chars[i + 1] !== '_') continue;
        if (chars[i - 1] === '_' || chars[i + 2] === '_') continue;
        if (
            inCode(i) ||
            inCode(i + 1) ||
            inLinkSyntax(i) ||
            inLinkSyntax(i + 1) ||
            usedAfterBoldStar.has(i) ||
            usedAfterBoldStar.has(i + 1)
        ) {
            continue;
        }
        underUnder.push(i);
    }
    const boldUnder = pairMarkers(
        underUnder,
        2,
        'bold',
        i => {
            const prev = chars[i - 1];
            const next = chars[i + 2];
            return next !== undefined && !isSpace(next) && (prev === undefined || !isWordChar(prev));
        },
        i => {
            const prev = chars[i - 1];
            const next = chars[i + 2];
            return prev !== undefined && !isSpace(prev) && (next === undefined || !isWordChar(next));
        }
    );

    const usedAfterUnder = new Set([...usedAfterBoldStar, ...boldUnder.consumed]);
    const star: number[] = [];
    for (let i = 0; i < chars.length; i++) {
        if (chars[i] !== '*') continue;
        if (chars[i - 1] === '*' || chars[i + 1] === '*') continue;
        if (inCode(i) || inLinkSyntax(i) || usedAfterUnder.has(i)) continue;
        star.push(i);
    }
    const italicStar = pairMarkers(
        star,
        1,
        'italic',
        i => chars[i + 1] !== undefined && !isSpace(chars[i + 1]),
        i => chars[i - 1] !== undefined && !isSpace(chars[i - 1])
    );

    const usedAfterStar = new Set([...usedAfterUnder, ...italicStar.consumed]);
    const under: number[] = [];
    for (let i = 0; i < chars.length; i++) {
        if (chars[i] !== '_') continue;
        if (chars[i - 1] === '_' || chars[i + 1] === '_') continue;
        if (inCode(i) || inLinkSyntax(i) || usedAfterStar.has(i)) continue;
        under.push(i);
    }
    const italicUnder = pairMarkers(
        under,
        1,
        'italic',
        i => {
            const prev = chars[i - 1];
            const next = chars[i + 1];
            return next !== undefined && !isSpace(next) && (prev === undefined || !isWordChar(prev));
        },
        i => {
            const prev = chars[i - 1];
            const next = chars[i + 1];
            return prev !== undefined && !isSpace(prev) && (next === undefined || !isWordChar(next));
        }
    );

    const allRanges = [
        ...code.ranges,
        ...boldStar.ranges,
        ...boldUnder.ranges,
        ...italicStar.ranges,
        ...italicUnder.ranges,
    ];
    const skipped = new Set([
        ...code.consumed,
        ...boldStar.consumed,
        ...boldUnder.consumed,
        ...italicStar.consumed,
        ...italicUnder.consumed,
    ]);

    const tokens: CharToken[] = [];
    for (let i = 0; i < chars.length; i++) {
        if (skipped.has(i) || links.consumed.has(i)) continue;
        const linkIndex = inLink(i);
        const link = linkIndex === -1 ? -1 : linkIndex;
        tokens.push({
            key: keyBase + i,
            ch: chars[i],
            bold: allRanges.some(range => range.style === 'bold' && i >= range.from && i < range.to),
            italic: allRanges.some(
                range => range.style === 'italic' && i >= range.from && i < range.to
            ),
            code: allRanges.some(range => range.style === 'code' && i >= range.from && i < range.to),
            link,
        });
    }

    return { tokens, links: links.spans };
}

function isLinkText(index: number, span: LinkSpan): boolean {
    return index >= span.from && index < span.to;
}

export type TailLine =
    | { kind: 'header'; level: number; text: string; globalKey: number; prefix: number }
    | { kind: 'list-item'; ordered: boolean; text: string; globalKey: number; prefix: number }
    | { kind: 'search'; text: string; globalKey: number; prefix: number }
    | { kind: 'quote'; text: string; globalKey: number; prefix: number }
    | { kind: 'code'; text: string; globalKey: number; prefix: number }
    | { kind: 'para'; text: string; globalKey: number; prefix: number };

export function parseTailLines(tail: string, fenceOpen: boolean, baseOffset: number): TailLine[] {
    const lines: TailLine[] = [];
    const raw = tail.split('\n');

    let open = fenceOpen;
    let offset = baseOffset;

    raw.forEach((rawLine, index) => {
        const key = offset;
        offset += rawLine.length + (index < raw.length - 1 ? 1 : 0);
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

        if (/^\s*```/.test(line)) {
            open = !open;
            return;
        }
        if (open) {
            lines.push({ kind: 'code', text: line, globalKey: key, prefix: 0 });
            return;
        }

        const search = /^(\s*>\s*\[search\]\s?)(.*)$/.exec(line);
        if (search) {
            lines.push({ kind: 'search', text: search[2], globalKey: key, prefix: search[1].length });
            return;
        }

        const quote = /^(\s*>\s?)(.*)$/.exec(line);
        if (quote) {
            lines.push({ kind: 'quote', text: quote[2], globalKey: key, prefix: quote[1].length });
            return;
        }

        const header = /^(\s*#{1,6}\s+)(.*)$/.exec(line);
        if (header) {
            const hashes = header[1].replace(/\s/g, '');
            lines.push({
                kind: 'header',
                level: Math.min(hashes.length, 6),
                text: header[2],
                globalKey: key,
                prefix: header[1].length,
            });
            return;
        }

        const list = /^(\s*(?:\d+[.)]|[-+*])\s+)(.*)$/.exec(line);
        if (list) {
            lines.push({
                kind: 'list-item',
                ordered: /^\s*\d/.test(list[1]),
                text: list[2],
                globalKey: key,
                prefix: list[1].length,
            });
            return;
        }

        lines.push({ kind: 'para', text: line, globalKey: key, prefix: 0 });
    });

    return lines;
}

function charStyle(token: CharToken): React.CSSProperties | undefined {
    if (!token.bold && !token.italic) return undefined;
    const style: React.CSSProperties = {};
    if (token.bold) style.fontWeight = 700;
    if (token.italic) style.fontStyle = 'italic';
    return style;
}

function hrefOf(rawLine: string, span: LinkSpan): string {
    return Array.from(rawLine).slice(span.urlFrom, span.urlTo).join('');
}

function linkInnerHasImage(rawLine: string, span: LinkSpan): boolean {
    if (span.image) return false;
    const inner = Array.from(rawLine).slice(span.from, span.to).join('');
    return /!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\)/.test(inner);
}

function renderLinkInnerImage(rawLine: string, span: LinkSpan): React.ReactNode {
    const inner = Array.from(rawLine).slice(span.from, span.to).join('');
    const match = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+("[^"]*"|'[^']*'))?\)/.exec(inner);
    if (!match) return null;
    const url = match[2];
    const alt = match[1];
    const title = match[3]?.slice(1, -1);
    return (
        <img
            src={url}
            alt={alt}
            title={title}
            className="tail-image tail-image-link"
            loading="lazy"
            onError={handleTailImageError}
        />
    );
}

function linkWrap(
    rawLine: string,
    span: LinkSpan | undefined,
    inner: React.ReactNode,
    key: string | number
): React.ReactNode {
    if (!span || span.image) return inner;
    const url = hrefOf(rawLine, span);
    const imageInner = linkInnerHasImage(rawLine, span)
        ? renderLinkInnerImage(rawLine, span)
        : null;
    return (
        <a
            key={key}
            href={url}
            title={span.title}
            className="tail-link"
            onClick={e => handleTailLinkClick(e, url)}
        >
            {imageInner ?? inner}
        </a>
    );
}

function StaticContent({ text, keyBase }: { text: string; keyBase: number }) {
    const { tokens, links } = parseInline(text, keyBase);
    if (tokens.length === 0 && links.every(span => !span.image)) return null;

    const images = links.filter(span => span.image);

    const segments: CharToken[][] = [];
    for (const token of tokens) {
        const current = segments[segments.length - 1];
        const prev = current?.[current.length - 1];
        if (
            prev &&
            prev.bold === token.bold &&
            prev.italic === token.italic &&
            prev.code === token.code &&
            prev.link === token.link
        ) {
            current.push(token);
        } else {
            segments.push([token]);
        }
    }

    return (
        <>
            {segments.map(segment => {
                const first = segment[0];
                const content = segment.map(token => token.ch).join('');
                let node: React.ReactNode = content;
                if (first.code) node = <code className="tail-inline-code">{node}</code>;
                if (first.italic) node = <em>{node}</em>;
                if (first.bold) node = <strong>{node}</strong>;
                const span = first.link === -1 ? undefined : links[first.link];
                return (
                    <React.Fragment key={first.key}>
                        {linkWrap(text, span, node, first.key)}
                    </React.Fragment>
                );
            })}
            {images.map(span => {
                const url = hrefOf(text, span);
                return (
                    <a
                        key={`img-${span.from}`}
                        href={url}
                        className="tail-link"
                        onClick={e => handleTailLinkClick(e, url)}
                    >
                        <img
                            src={url}
                            alt={span.imageAlt}
                            title={span.title}
                            className="tail-image"
                            loading="lazy"
                            onError={handleTailImageError}
                        />
                    </a>
                );
            })}
        </>
    );
}

function AnimatedContent({ text, keyBase }: { text: string; keyBase: number }) {
    const { tokens, links } = parseInline(text, keyBase);

    const out: React.ReactNode[] = [];
    let word: CharToken[] = [];
    let wordIndex = 0;

    const flushWord = () => {
        if (word.length === 0) return;
        const current = word;
        const slot = wordIndex++;
        word = [];
        out.push(
            <span key={slot} className="word-unit">
                {renderWordChars(current, links, text)}
            </span>
        );
    };

    for (const token of tokens) {
        const boundary =
            token.ch === ' ' ||
            token.ch === '\t' ||
            (word.length > 0 && word[word.length - 1].link !== token.link);
        if (boundary && token.ch !== ' ' && token.ch !== '\t') {
            flushWord();
            word.push(token);
            continue;
        }
        if (token.ch === ' ' || token.ch === '\t') {
            flushWord();
            out.push(<span key={token.key}>{token.ch}</span>);
        } else {
            word.push(token);
        }
    }
    flushWord();

    const images = links.filter(span => span.image);

    return (
        <>
            {out}
            {images.map(span => (
                <TailImage key={`img-${span.from}`} rawLine={text} span={span} />
            ))}
        </>
    );
}

function renderWordChars(
    chars: CharToken[],
    links: LinkSpan[],
    rawLine: string
): React.ReactNode {
    const first = chars[0];
    const nodes = chars.map(token => (
        <span
            key={token.key}
            className={token.code ? 'reveal-unit tail-code-char' : 'reveal-unit'}
            style={charStyle(token)}
        >
            {token.ch}
        </span>
    ));
    const span = first.link === -1 ? undefined : links[first.link];
    return linkWrap(rawLine, span, <>{nodes}</>, `w-${first.key}`);
}

function TailImage({ rawLine, span }: { rawLine: string; span: LinkSpan }) {
    const url = hrefOf(rawLine, span);
    return (
        <a href={url} className="tail-link" onClick={e => handleTailLinkClick(e, url)}>
            <img
                src={url}
                alt={span.imageAlt}
                title={span.title}
                className="tail-image"
                loading="lazy"
                onError={handleTailImageError}
            />
        </a>
    );
}

function AnimatedCode({ text, keyBase }: { text: string; keyBase: number }) {
    const chars = Array.from(text);

    return (
        <>
            {chars.map((ch, index) =>
                ch === ' ' || ch === '\t' ? (
                    <span key={keyBase + index}>{ch}</span>
                ) : (
                    <span key={keyBase + index} className="reveal-unit tail-code-char">
                        {ch}
                    </span>
                )
            )}
        </>
    );
}

function sameLine(a: TailLine, b: TailLine): boolean {
    if (a.kind !== b.kind) return false;
    if (a.prefix !== b.prefix) return false;
    switch (a.kind) {
        case 'header':
            return (
                a.text === (b as { text: string }).text &&
                a.level === (b as { level: number }).level
            );
        case 'list-item':
            return (
                a.text === (b as { text: string }).text &&
                a.ordered === (b as { ordered: boolean }).ordered
            );
        default:
            return a.text === (b as { text: string }).text;
    }
}

const TailBlock = React.memo(
    function TailBlock({ line, last }: { line: TailLine; last: boolean }) {
        const content =
            line.text === '' ? null : last ? (
                <AnimatedContent text={line.text} keyBase={line.prefix} />
            ) : (
                <StaticContent text={line.text} keyBase={line.prefix} />
            );

        switch (line.kind) {
            case 'header': {
                const tag = `h${line.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
                if (line.text === '' && last) return <p>{content}</p>;
                return React.createElement(tag, null, content ?? <br />);
            }
            case 'list-item':
                return <li>{content}</li>;
            case 'search':
                return (
                    <span className="searchStatus">
                        <Search size={14} />
                        <span>{line.text.trim() === '' ? 'Searching the web' : line.text}</span>
                    </span>
                );
            case 'quote':
                return <blockquote className="tail-quote">{content}</blockquote>;
            case 'code':
                return null;
            case 'para':
                return <p>{content ?? (last ? null : <br />)}</p>;
        }
    },
    (prev, next) => prev.last === next.last && sameLine(prev.line, next.line)
);

const CodeLine = React.memo(
    function CodeLine({ text, last, lineKey }: { text: string; last: boolean; lineKey: number }) {
        if (text === '' && last) return null;
        return (
            <>
                {last ? <AnimatedCode text={text} keyBase={lineKey} /> : text}
                {'\n'}
            </>
        );
    },
    (prev, next) => prev.last === next.last && prev.text === next.text
);

export function StreamingTail({
    tail,
    fenceOpen,
    baseOffset,
}: {
    tail: string;
    fenceOpen: boolean;
    baseOffset: number;
}) {
    const lines = parseTailLines(tail, fenceOpen, baseOffset);
    if (lines.length === 0) return null;

    const lastKey = lines[lines.length - 1].globalKey;
    const out: React.ReactNode[] = [];

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        if (line.kind === 'list-item') {
            const group: typeof line[] = [line];
            let j = i + 1;
            while (
                j < lines.length &&
                lines[j].kind === 'list-item' &&
                (lines[j] as typeof line).ordered === line.ordered
            ) {
                group.push(lines[j] as typeof line);
                j++;
            }
            const ListTag = line.ordered ? 'ol' : 'ul';
            out.push(
                <ListTag key={line.globalKey} className="tail-list">
                    {group.map(item => (
                        <TailBlock
                            key={item.globalKey}
                            line={item}
                            last={item.globalKey === lastKey}
                        />
                    ))}
                </ListTag>
            );
            i = j;
            continue;
        }

        if (line.kind === 'code') {
            const group: typeof line[] = [line];
            let j = i + 1;
            while (j < lines.length && lines[j].kind === 'code') {
                group.push(lines[j] as typeof line);
                j++;
            }
            out.push(
                <pre key={line.globalKey} className="tail-pre">
                    <code>
                        {group.map(item => (
                            <CodeLine
                                key={item.globalKey}
                                lineKey={item.globalKey}
                                text={item.text}
                                last={item.globalKey === lastKey}
                            />
                        ))}
                    </code>
                </pre>
            );
            i = j;
            continue;
        }

        out.push(
            <TailBlock key={line.globalKey} line={line} last={line.globalKey === lastKey} />
        );
        i++;
    }

    return <>{out}</>;
}

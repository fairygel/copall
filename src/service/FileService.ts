import AttachedFile from '../models/AttachedFile';
import { compressImage, dataUrlToCompressedJpeg } from './ImageService';
import { openImageFiles, pathToBase64 } from './NativeBridge';

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

const MIME_BY_EXTENSION: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
};

function getMimeType(path: string): string | null {
    const ext = path.split('.').pop()?.toLowerCase();

    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) return null;

    return MIME_BY_EXTENSION[ext];
}

function getFileName(path: string): string {
    return path.split('/').pop()?.split('\\').pop() ?? 'unknown';
}

export async function filePathToAttachedFile(path: string): Promise<AttachedFile | null> {
    const mime = getMimeType(path);

    if (!mime) return null;

    try {
        const base64 = await pathToBase64(path);
        const compressed = await dataUrlToCompressedJpeg(`data:${mime};base64,${base64}`);

        return {
            id: crypto.randomUUID(),
            name: getFileName(path),
            base64: compressed.base64,
            mime: compressed.mime,
        };
    } catch {
        return null;
    }
}

export async function selectAttachedFiles(): Promise<AttachedFile[]> {
    let paths: string[] | null;

    try {
        paths = await openImageFiles();
    } catch (e) {
        throw new Error('Unable to open file: ' + e);
    }

    if (!paths || paths.length === 0) return [];

    const files = await Promise.all(paths.map(filePathToAttachedFile));

    return files.filter((file): file is AttachedFile => file !== null);
}

export async function blobToAttachedFile(blob: Blob): Promise<AttachedFile | null> {
    if (!blob.type.startsWith('image/')) return null;

    const name = blob instanceof File && blob.name ? blob.name : 'unknown';

    try {
        const compressed = await compressImage(blob);

        return { id: crypto.randomUUID(), name, base64: compressed.base64, mime: compressed.mime };
    } catch {
        return null;
    }
}

export function imagePathsOf(text: string): string[] {
    const paths = new Set<string>();

    for (const raw of text.split('\n')) {
        const line = raw.trim().replace(/^["']|["']$/g, '').trim();

        if (!line || line.startsWith('#')) continue;

        const stripped = line.startsWith('file://') ? line.slice('file://'.length) : line;

        let path = stripped;

        try {
            path = decodeURI(stripped);
        } catch {
            path = stripped;
        }

        if (/^\/[A-Za-z]:[\\/]/.test(path)) path = path.slice(1);

        const isPosix = path.startsWith('/');
        const isWindows = /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\');

        if ((isPosix || isWindows) && getMimeType(path) !== null) paths.add(path);
    }

    return [...paths];
}

import AttachedFile from '../models/AttachedFile';
import PasteSnapshot from '../models/PasteSnapshot';
import { dataUrlToCompressedJpeg } from './ImageService';
import { fetchImage } from './NativeBridge';
import { blobToAttachedFile, filePathToAttachedFile, imagePathsOf } from './FileService';

function imageBlobsOf(data: DataTransfer): Blob[] {
    const blobs: Blob[] = [];

    for (const item of data.items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile();

            if (blob) blobs.push(blob);
        }
    }

    if (blobs.length === 0 && data.files) {
        for (const file of data.files) {
            if (file.type.startsWith('image/')) blobs.push(file);
        }
    }

    return blobs;
}

export function snapshotPaste(data: DataTransfer): PasteSnapshot {
    const plain = data.getData('text/plain');

    return {
        blobs: imageBlobsOf(data),
        plain,
        pathsText: `${data.getData('text/uri-list')}\n${plain}`,
        html: data.getData('text/html'),
    };
}

function imageUrlsOf(html: string): string[] {
    const urls: string[] = [];

    new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelectorAll('img')
        .forEach(img => {
            const src = img.getAttribute('src');

            if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
                urls.push(src);
            }
        });

    return urls;
}

function directUrlsOf(text: string): string[] {
    const urls = new Set<string>();

    for (const raw of text.split(/\s+/)) {
        const token = raw.trim().replace(/^["']|["']$/g, '').trim();

        if (token.startsWith('http://') || token.startsWith('https://')) {
            urls.add(token);
        }
    }

    return [...urls];
}

export function snapshotHasImage(snapshot: PasteSnapshot): boolean {
    if (snapshot.blobs.length > 0) return true;

    if (imagePathsOf(snapshot.pathsText).length > 0) return true;

    if (imageUrlsOf(snapshot.html).length > 0) return true;

    return directUrlsOf(`${snapshot.pathsText}\n${snapshot.html}`).length > 0;
}

export async function urlToAttachedFile(url: string): Promise<AttachedFile | null> {
    let mimeAndBase64: string;

    try {
        mimeAndBase64 = await fetchImage(url);
    } catch {
        return null;
    }

    const separator = mimeAndBase64.indexOf(';');
    if (separator === -1) return null;

    const mime = mimeAndBase64.slice(0, separator);
    const base64 = mimeAndBase64.slice(separator + 1);
    if (!mime.startsWith('image/') || !base64) return null;

    let name = 'unknown';

    try {
        const urlPath = new URL(url).pathname.split('/').pop();

        if (urlPath) name = decodeURIComponent(urlPath);
    } catch (e) {
        console.error(e);
    }

    try {
        const compressed = await dataUrlToCompressedJpeg(`data:${mime};base64,${base64}`);

        return { id: crypto.randomUUID(), name, base64: compressed.base64, mime: compressed.mime };
    } catch {
        return null;
    }
}

export async function pastedToAttachedFiles(snapshot: PasteSnapshot): Promise<AttachedFile[]> {
    if (snapshot.blobs.length > 0) {
        const files = await Promise.all(snapshot.blobs.map(blobToAttachedFile));
        const attached = files.filter((file): file is AttachedFile => file !== null);

        if (attached.length > 0) return attached;
    }

    const paths = imagePathsOf(snapshot.pathsText);

    if (paths.length > 0) {
        const files = await Promise.all(paths.map(filePathToAttachedFile));
        const attached = files.filter((file): file is AttachedFile => file !== null);

        if (attached.length > 0) return attached;
    }

    const urls = [
        ...imageUrlsOf(snapshot.html),
        ...directUrlsOf(`${snapshot.pathsText}\n${snapshot.html}`),
    ];

    if (urls.length > 0) {
        const files = await Promise.all([...new Set(urls)].map(urlToAttachedFile));

        return files.filter((file): file is AttachedFile => file !== null);
    }

    return [];
}

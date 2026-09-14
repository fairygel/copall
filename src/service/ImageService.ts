const MAX_SIDE = 1568;
const JPEG_QUALITY = 0.82;

async function blobToBitmap(blob: Blob): Promise<ImageBitmap> {
    if ('createImageBitmap' in window) {
        return createImageBitmap(blob);
    }

    const url = URL.createObjectURL(blob);

    try {
        const img = new Image();

        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('cannot decode image'));
            img.src = url;
        });

        return createImageBitmap(img);
    } finally {
        URL.revokeObjectURL(url);
    }
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<string> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            blob => {
                if (!blob) {
                    reject(new Error('cannot encode image'));
                    return;
                }

                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
            },
            'image/jpeg',
            JPEG_QUALITY
        );
    });
}

export async function compressImage(blob: Blob): Promise<{ base64: string; mime: string }> {
    const bitmap = await blobToBitmap(blob);

    try {
        const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        if (!ctx) throw new Error('no 2d canvas context');

        ctx.drawImage(bitmap, 0, 0, width, height);

        return { base64: await canvasToJpeg(canvas), mime: 'image/jpeg' };
    } finally {
        bitmap.close();
    }
}

export async function dataUrlToCompressedJpeg(dataUrl: string): Promise<{
    base64: string;
    mime: string;
}> {
    const blob = await (await fetch(dataUrl)).blob();

    return compressImage(blob);
}

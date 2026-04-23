// Client-side image resize + recompress. Turns a raw 6 MB PNG photo into a
// ~500 KB JPEG while preserving the long-edge at maxDimension px. Skips the
// work when the input is already small or isn't an image.

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  /** Skip compression when the file is already below this size in bytes. */
  skipBelowBytes?: number;
}

export async function compressImage(
  file: File,
  { maxDimension = 2000, quality = 0.85, skipBelowBytes = 500_000 }: CompressOptions = {},
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= skipBelowBytes) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not decode image'));
      image.src = objectUrl;
    });

    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
    return new File([blob], newName, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

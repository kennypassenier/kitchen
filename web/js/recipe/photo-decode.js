// Decoding a picked photo file into something a canvas can draw (Kenny, 30/10/2026).
// The kit's CSP is `img-src 'self' data:`, so a blob: URL can never be an <img> source here. The fallback for a browser
// whose createImageBitmap refuses the file therefore reads the file into a data: URL first. The CSP stays as it is.

/**
 * Try the bitmap path, then the data-URL path; throws `unreadable` when both fail (nothing is swallowed).
 * @template T
 * @param {{ bitmap: () => Promise<T>, readDataUrl: () => Promise<string>, loadImage: (url: string) => Promise<T>, unreadable: string }} steps
 * @returns {Promise<T>}
 */
export async function decodeWith({ bitmap, readDataUrl, loadImage, unreadable }) {
  try {
    return await bitmap();
  } catch (bitmapError) {
    try {
      return await loadImage(await readDataUrl());
    } catch (fallbackError) {
      throw new Error(unreadable, { cause: { bitmapError, fallbackError } });
    }
  }
}

/** @param {File} file @returns {Promise<string>} */
const readDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });

/** @param {string} url @returns {Promise<HTMLImageElement>} */
const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });

/** The picture decoded, honouring its orientation. @param {File} file @param {string} unreadable the message when no path works @returns {Promise<ImageBitmap | HTMLImageElement>} */
export const decode = (file, unreadable) =>
  decodeWith({
    bitmap: () => createImageBitmap(file, { imageOrientation: "from-image" }),
    readDataUrl: () => readDataUrl(file),
    loadImage,
    unreadable,
  });

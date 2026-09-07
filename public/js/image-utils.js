// Shared image resize/crop helpers used by the photo manager and camera session.

export const PHOTO_MAX_DIM = 1600;
export const PHOTO_QUALITY = 0.8;

// Scales an image file to fit within maxDim (no cropping). Used for "add from
// library" photos, which should keep their original aspect ratio.
export function resizeImage(file, maxDim = PHOTO_MAX_DIM, quality = PHOTO_QUALITY) {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load image'));
    };
    img.src = objectUrl;
  });
}

// Center-crops a video/image/canvas source to a square, then scales to maxDim.
// Used by the live camera session's shutter capture.
export function cropSquareToDataUrl(source, { maxDim = PHOTO_MAX_DIM, quality = PHOTO_QUALITY } = {}) {
  const sw = source.videoWidth ?? source.naturalWidth ?? source.width;
  const sh = source.videoHeight ?? source.naturalHeight ?? source.height;
  const side = Math.min(sw, sh);
  const sx = (sw - side) / 2;
  const sy = (sh - side) / 2;
  const outSize = Math.min(side, maxDim);

  const canvas = document.createElement('canvas');
  canvas.width  = outSize;
  canvas.height = outSize;
  canvas.getContext('2d').drawImage(source, sx, sy, side, side, 0, 0, outSize, outSize);
  return canvas.toDataURL('image/jpeg', quality);
}

// Splits a data URL into its base64 payload and MIME type.
export function dataUrlToParts(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const semi  = dataUrl.indexOf(';');
  return { base64: dataUrl.slice(comma + 1), mimeType: dataUrl.slice(5, semi) };
}

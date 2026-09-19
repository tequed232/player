/** Image picking, downscaling and camera frame capture. */

/** Natural image picker: one image at a time, via the platform file chooser. */
export function pickImageFile(): Promise<File | null> {
  return pickFile('图片', 'image/*');
}

/** Generic single file picker (images, schedule documents, ...). */
export function pickFile(_label: string, accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = false;
    input.style.position = 'fixed';
    input.style.left = '-1000px';
    document.body.appendChild(input);
    const cleanup = () => input.remove();
    input.addEventListener('change', () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      cleanup();
      resolve(file);
    });
    input.addEventListener('cancel', () => {
      cleanup();
      resolve(null);
    });
    input.click();
  });
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片解码失败'));
    image.src = dataUrl;
  });
}

/**
 * "相机清晰度调整" -> capture resolution and JPEG quality.
 * sharpness 0..100 maps to a 720..2160px long edge and 0.55..0.95 quality.
 */
export function sharpnessToQuality(sharpness: number): { maxEdge: number; quality: number } {
  const t = Math.min(100, Math.max(0, sharpness)) / 100;
  return { maxEdge: Math.round(720 + t * 1440), quality: Number((0.55 + t * 0.4).toFixed(2)) };
}

export async function downscaleDataUrl(dataUrl: string, sharpness: number): Promise<string> {
  const { maxEdge, quality } = sharpnessToQuality(sharpness);
  try {
    const image = await loadImage(dataUrl);
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    if (!longest) return dataUrl;
    const scale = Math.min(1, maxEdge / longest);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return dataUrl;
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return dataUrl;
  }
}

export async function prepareImageFile(file: File, sharpness: number): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  return downscaleDataUrl(dataUrl, sharpness);
}

/** Grab the current video frame as a JPEG data URL. */
export function captureVideoFrame(video: HTMLVideoElement, sharpness: number): string | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;
  const { maxEdge, quality } = sharpnessToQuality(sharpness);
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

export function dataUrlSizeKb(dataUrl: string): number {
  const index = dataUrl.indexOf(',');
  const payload = index >= 0 ? dataUrl.slice(index + 1) : dataUrl;
  return Math.round((payload.length * 0.75) / 1024);
}

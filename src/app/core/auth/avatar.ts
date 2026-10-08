import { AuthError } from '../../common/interfaces/auth/auth.models';

const MAX_INPUT_BYTES = 8 * 1024 * 1024;

/**
 * Centers a square crop of the picked image, shrinks it to `size` x `size` and returns a JPEG data URL
 * (about 10 kB), small enough to live in the profile row. Throws `invalid_image` for anything that is not a readable image.
 */
export async function imageToAvatarDataUrl(file: File, size = 160): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > MAX_INPUT_BYTES) throw new AuthError('invalid_image');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AuthError('invalid_image');
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new AuthError('invalid_image');
    // JPEG has no transparency: paint white first so a transparent PNG does not turn black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    const side = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    bitmap.close();
  }
}

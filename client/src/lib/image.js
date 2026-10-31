// Shrinks a photo in the browser before upload: 256 x 256 JPEG, center-cropped.
// Re-drawing on a canvas also drops EXIF data such as GPS location.
export async function resizePhoto(file, size = 256) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.85);
}

import { resizeImage, dataUrlToParts } from './image-utils.js';

// Wires up a `.photo-grid` (thumbnails + camera/library add buttons) shared by
// the new-listing and edit-listing pages. Returns { getPhotos, render }.
//
// photos = [{ dataUrl, base64, mimeType }, ...]
export function createPhotoManager({
  gridEl,
  cameraBtn,
  addBtn,
  fileInput,
  cameraSession,
  maxPhotos,
  initialPhotos = [],
  showPrimaryLabel = true,
  onChange,
}) {
  let photos = initialPhotos.slice();

  function render() {
    gridEl.querySelectorAll('.photo-thumb').forEach(el => el.remove());

    photos.forEach((photo, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'photo-thumb' + (showPrimaryLabel && i === 0 ? ' photo-thumb--primary' : '');
      thumb.innerHTML = `
        <img src="${photo.dataUrl}" alt="Photo ${i + 1}">
        <button type="button" class="photo-thumb-remove" data-index="${i}" aria-label="Remove photo">&times;</button>
        ${showPrimaryLabel && i === 0 ? '<span class="photo-thumb-label">Primary</span>' : ''}
      `;
      gridEl.insertBefore(thumb, cameraBtn);
    });

    const atMax = photos.length >= maxPhotos;
    cameraBtn.style.display = atMax ? 'none' : '';
    addBtn.style.display    = atMax ? 'none' : '';

    onChange?.(photos);
  }

  gridEl.addEventListener('click', e => {
    const btn = e.target.closest('.photo-thumb-remove');
    if (!btn) return;
    photos.splice(Number(btn.dataset.index), 1);
    render();
  });

  cameraBtn.addEventListener('click', () => {
    cameraSession.open(maxPhotos - photos.length);
  });

  cameraSession.addEventListener('photos-done', e => {
    const slots = maxPhotos - photos.length;
    photos.push(...e.detail.photos.slice(0, slots));
    render();
  });

  addBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files ?? []);
    const slots = maxPhotos - photos.length;
    for (const file of files.slice(0, slots)) {
      const dataUrl = await resizeImage(file);
      const { base64, mimeType } = dataUrlToParts(dataUrl);
      photos.push({ dataUrl, base64, mimeType });
    }
    fileInput.value = '';
    render();
  });

  render();

  return {
    getPhotos: () => photos,
    render,
  };
}

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
  sortable = false,
  onChange,
}) {
  let photos = initialPhotos.slice();

  function render() {
    gridEl.querySelectorAll('.photo-thumb').forEach(el => el.remove());

    photos.forEach((photo, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'photo-thumb' + (showPrimaryLabel && i === 0 ? ' photo-thumb--primary' : '');
      thumb.dataset.origIndex = String(i);
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

  if (sortable) {
    gridEl.classList.add('photo-grid--sortable');
    gridEl.addEventListener('contextmenu', e => {
      if (e.target.closest('.photo-thumb')) e.preventDefault();
    });

    const DRAG_THRESHOLD  = 6;
    const SLIDE_DURATION  = 200;
    let dragEl = null;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let dragging = false;

    // FLIP: snapshot positions, run the DOM mutation, then animate every
    // displaced thumb (excluding the one under the pointer) from its old
    // spot to its new one so neighbors visibly slide to open a gap.
    function reorderWithSlide(mutate) {
      const others = Array.from(gridEl.querySelectorAll('.photo-thumb')).filter(el => el !== dragEl);
      const firstRects = new Map(others.map(el => [el, el.getBoundingClientRect()]));

      mutate();

      others.forEach(el => {
        const first = firstRects.get(el);
        const last  = el.getBoundingClientRect();
        const dx = first.left - last.left;
        const dy = first.top  - last.top;
        if (!dx && !dy) return;

        el.style.transition = 'none';
        el.style.transform  = `translate(${dx}px, ${dy}px)`;
        el.getBoundingClientRect(); // force reflow so the transform above applies before we animate it away
        requestAnimationFrame(() => {
          el.style.transition = `transform ${SLIDE_DURATION}ms ease`;
          el.style.transform  = '';
        });
        el.addEventListener('transitionend', () => { el.style.transition = ''; }, { once: true });
      });
    }

    const onPointerMove = e => {
      if (e.pointerId !== pointerId) return;
      if (!dragging) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return;
        dragging = true;
        dragEl.setPointerCapture(pointerId);
        dragEl.classList.add('photo-thumb--dragging');
      }
      e.preventDefault();

      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.photo-thumb');
      if (!target || target === dragEl || target.parentElement !== gridEl) return;
      const thumbs = Array.from(gridEl.querySelectorAll('.photo-thumb'));
      const insertAfter = thumbs.indexOf(target) > thumbs.indexOf(dragEl);
      reorderWithSlide(() => {
        gridEl.insertBefore(dragEl, insertAfter ? target.nextSibling : target);
      });
    };

    const cleanup = () => {
      gridEl.removeEventListener('pointermove', onPointerMove);
      gridEl.removeEventListener('pointerup', onPointerUp);
      gridEl.removeEventListener('pointercancel', onPointerCancel);
    };

    function onPointerUp(e) {
      if (e.pointerId !== pointerId) return;
      cleanup();
      if (dragging) {
        dragEl.classList.remove('photo-thumb--dragging');
        const order = Array.from(gridEl.querySelectorAll('.photo-thumb'))
          .map(el => photos[Number(el.dataset.origIndex)]);
        photos = order;
        render();
      }
      dragEl = null;
      dragging = false;
    }

    function onPointerCancel(e) {
      if (e.pointerId !== pointerId) return;
      cleanup();
      if (dragEl) dragEl.classList.remove('photo-thumb--dragging');
      dragging = false;
      render();
    }

    gridEl.addEventListener('pointerdown', e => {
      const thumb = e.target.closest('.photo-thumb');
      if (!thumb || e.target.closest('.photo-thumb-remove')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      dragEl = thumb;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      dragging = false;

      gridEl.addEventListener('pointermove', onPointerMove);
      gridEl.addEventListener('pointerup', onPointerUp);
      gridEl.addEventListener('pointercancel', onPointerCancel);
    });
  }

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

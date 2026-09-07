import { cropSquareToDataUrl, dataUrlToParts } from '../js/image-utils.js';

// Full-screen live-camera modal for capturing multiple square photos in one
// session. Usage:
//
//   <up-camera-session id="camera-session"></up-camera-session>
//   cameraSession.open(maxRemaining);
//   cameraSession.addEventListener('photos-done', e => { ...e.detail.photos });
//
// Only tracks photos captured during the current open() session — the host
// page is responsible for merging e.detail.photos into its own photo list.
class UpCameraSession extends HTMLElement {
  #dialog;
  #video;
  #errorEl;
  #errorMsg;
  #counterEl;
  #doneBtn;
  #shutterBtn;
  #carouselEl;
  #retakeHint;
  #previewImg;
  #previewActions;
  #previewRetakeBtn;
  #previewDeleteBtn;

  #stream = null;
  #sessionPhotos = []; // [{ dataUrl, base64, mimeType }, ...]
  #max = 20;
  #retakeIndex = null;
  #previewIndex = null;

  connectedCallback() {
    this.classList.add('up-camera-session');
    this.innerHTML = `
      <dialog class="ucs-dialog">
        <div class="ucs-inner">
          <header class="ucs-header">
            <button type="button" class="ucs-close-btn" aria-label="Cancel">✕</button>
            <span class="ucs-counter" aria-live="polite">0/20</span>
            <button type="button" class="ucs-done-btn btn btn-primary" disabled>Done</button>
          </header>

          <div class="ucs-viewport">
            <video class="ucs-video" autoplay playsinline muted></video>
            <img class="ucs-preview-img" hidden alt="Selected photo">
            <div class="ucs-error" hidden>
              <p class="ucs-error-msg"></p>
            </div>
          </div>

          <div class="ucs-controls">
            <p class="ucs-retake-hint" hidden>Retaking photo <span></span> — tap shutter</p>
            <button type="button" class="ucs-shutter-btn" aria-label="Take photo"></button>
            <div class="ucs-preview-actions" hidden>
              <button type="button" class="ucs-preview-retake btn btn-outline">Retake</button>
              <button type="button" class="ucs-preview-delete btn btn-danger">Delete</button>
            </div>
          </div>

          <div class="ucs-carousel" aria-label="Captured photos"></div>
        </div>
      </dialog>
    `;

    this.#dialog        = this.querySelector('.ucs-dialog');
    this.#video         = this.querySelector('.ucs-video');
    this.#errorEl       = this.querySelector('.ucs-error');
    this.#errorMsg      = this.querySelector('.ucs-error-msg');
    this.#counterEl     = this.querySelector('.ucs-counter');
    this.#doneBtn       = this.querySelector('.ucs-done-btn');
    this.#shutterBtn    = this.querySelector('.ucs-shutter-btn');
    this.#carouselEl    = this.querySelector('.ucs-carousel');
    this.#retakeHint    = this.querySelector('.ucs-retake-hint');
    this.#previewImg      = this.querySelector('.ucs-preview-img');
    this.#previewActions  = this.querySelector('.ucs-preview-actions');
    this.#previewRetakeBtn = this.querySelector('.ucs-preview-retake');
    this.#previewDeleteBtn = this.querySelector('.ucs-preview-delete');

    this.querySelector('.ucs-close-btn').addEventListener('click', () => this.close());
    this.#dialog.addEventListener('cancel', e => { e.preventDefault(); this.close(); });

    this.#shutterBtn.addEventListener('click', () => this.#capture());
    this.#doneBtn.addEventListener('click', () => this.#finish());
    this.#previewRetakeBtn.addEventListener('click', () => this.#startRetakeFromPreview());
    this.#previewDeleteBtn.addEventListener('click', () => this.#deleteFromPreview());

    this.#carouselEl.addEventListener('click', e => {
      if (e.target.closest('.ucs-thumb-add')) {
        this.#returnToLiveCapture();
        return;
      }
      const removeBtn = e.target.closest('.ucs-thumb-remove');
      if (removeBtn) {
        const i = Number(removeBtn.dataset.index);
        this.#sessionPhotos.splice(i, 1);
        if (this.#retakeIndex === i) this.#retakeIndex = null;
        if (this.#previewIndex === i) this.#closePreview();
        this.#renderCarousel();
        return;
      }
      const thumb = e.target.closest('.ucs-thumb');
      if (thumb) this.#openPreview(Number(thumb.dataset.index));
    });
  }

  // ── Public API ────────────────────────────────────────────

  open(maxRemaining = 20) {
    this.#max = Math.max(0, maxRemaining);
    this.#sessionPhotos = [];
    this.#retakeIndex = null;
    this.#previewIndex = null;
    this.#previewImg.hidden = true;
    this.#previewActions.hidden = true;
    this.#shutterBtn.hidden = false;
    this.#dialog.classList.remove('is-closing');
    this.#dialog.showModal();
    this.#renderCarousel();
    this.#startCamera();
  }

  close() {
    if (this.#dialog.classList.contains('is-closing')) return;
    this.#stopCamera();
    this.#dialog.classList.add('is-closing');
    this.#dialog.addEventListener('animationend', () => {
      this.#dialog.classList.remove('is-closing');
      this.#dialog.close();
    }, { once: true });
  }

  // ── Camera lifecycle ──────────────────────────────────────

  async #startCamera() {
    this.#errorEl.hidden = true;
    this.#video.hidden = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      this.#showError('Live camera isn’t supported in this browser.');
      return;
    }

    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      this.#video.srcObject = this.#stream;
      await this.#video.play();
    } catch (err) {
      this.#showError(
        err?.name === 'NotAllowedError'
          ? 'Camera access was denied.'
          : 'Couldn’t start the camera.'
      );
    }
  }

  #stopCamera() {
    this.#stream?.getTracks().forEach(t => t.stop());
    this.#stream = null;
    this.#video.srcObject = null;
  }

  #showError(message) {
    this.#video.hidden = true;
    this.#errorEl.hidden = false;
    this.#errorMsg.textContent = message;
  }

  // ── Capture ───────────────────────────────────────────────

  #capture() {
    if (this.#sessionPhotos.length >= this.#max && this.#retakeIndex === null) return;
    const dataUrl = cropSquareToDataUrl(this.#video);
    this.#addPhoto(dataUrl);
  }

  #addPhoto(dataUrl) {
    const { base64, mimeType } = dataUrlToParts(dataUrl);
    const photo = { dataUrl, base64, mimeType };

    if (this.#retakeIndex !== null) {
      this.#sessionPhotos[this.#retakeIndex] = photo;
      this.#retakeIndex = null;
    } else {
      this.#sessionPhotos.push(photo);
    }
    this.#renderCarousel();
  }

  #armRetake(index) {
    this.#retakeIndex = index;
    this.#renderCarousel();
  }

  #returnToLiveCapture() {
    if (this.#previewIndex !== null) { this.#closePreview(); return; }
    if (this.#retakeIndex !== null) { this.#retakeIndex = null; this.#renderCarousel(); }
  }

  // ── Preview (view / retake / delete a captured photo) ────────

  #openPreview(index) {
    this.#retakeIndex = null;
    this.#previewIndex = index;
    this.#previewImg.src = this.#sessionPhotos[index].dataUrl;
    this.#previewImg.hidden = false;
    this.#video.hidden = true;
    this.#errorEl.hidden = true;
    this.#shutterBtn.hidden = true;
    this.#retakeHint.hidden = true;
    this.#previewActions.hidden = false;
    this.#renderCarousel();
  }

  #closePreview() {
    this.#previewIndex = null;
    this.#previewImg.hidden = true;
    this.#video.hidden = false;
    this.#shutterBtn.hidden = false;
    this.#previewActions.hidden = true;
    this.#renderCarousel();
  }

  #startRetakeFromPreview() {
    const index = this.#previewIndex;
    this.#closePreview();
    this.#armRetake(index);
  }

  #deleteFromPreview() {
    const index = this.#previewIndex;
    this.#sessionPhotos.splice(index, 1);
    this.#closePreview();
  }

  // ── Rendering ─────────────────────────────────────────────

  #renderCarousel() {
    this.#carouselEl.innerHTML = '';
    this.#sessionPhotos.forEach((photo, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'ucs-thumb'
        + (i === this.#retakeIndex ? ' is-retaking' : '')
        + (i === this.#previewIndex ? ' is-selected' : '');
      thumb.dataset.index = String(i);
      thumb.innerHTML = `
        <img src="${photo.dataUrl}" alt="Photo ${i + 1}">
        <button type="button" class="ucs-thumb-remove" data-index="${i}" aria-label="Remove photo ${i + 1}">&times;</button>
      `;
      this.#carouselEl.appendChild(thumb);
    });

    if (this.#retakeIndex !== null || this.#previewIndex !== null) {
      const addThumb = document.createElement('button');
      addThumb.type = 'button';
      addThumb.className = 'ucs-thumb-add';
      addThumb.setAttribute('aria-label', 'Continue taking photos');
      addThumb.innerHTML = '<span>+</span>';
      this.#carouselEl.appendChild(addThumb);
    }

    const count = this.#sessionPhotos.length;
    this.#counterEl.textContent = `${count}/${this.#max}`;
    this.#counterEl.dataset.max = String(count >= this.#max);

    const atMax = count >= this.#max && this.#retakeIndex === null;
    this.#shutterBtn.disabled = atMax;
    this.#doneBtn.disabled = count === 0;

    if (this.#retakeIndex !== null) {
      this.#retakeHint.hidden = false;
      this.#retakeHint.querySelector('span').textContent = String(this.#retakeIndex + 1);
    } else {
      this.#retakeHint.hidden = true;
    }
  }

  #finish() {
    if (this.#sessionPhotos.length === 0) return;
    this.dispatchEvent(new CustomEvent('photos-done', {
      bubbles: true,
      detail: { photos: this.#sessionPhotos.map(p => ({ ...p })) },
    }));
    this.close();
  }
}

customElements.define('up-camera-session', UpCameraSession);

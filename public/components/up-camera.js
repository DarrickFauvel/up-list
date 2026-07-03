class UpCamera extends HTMLElement {
  connectedCallback() {
    this.classList.add('up-camera');
    this.innerHTML = `
      <div class="uc-preview" role="button" tabindex="0" aria-label="Select or capture photo">
        <span class="uc-placeholder">📷 Tap to add a photo</span>
      </div>
      <div class="uc-actions">
        <button type="button" class="uc-btn uc-btn-camera btn btn-ghost">📷 Take photo</button>
        <button type="button" class="uc-btn uc-btn-library btn btn-ghost">🖼️ Choose from library</button>
      </div>
      <input
        type="file"
        name="${this.getAttribute('name') ?? 'image'}"
        accept="image/*"
        capture="environment"
        class="uc-input uc-input-camera"
        ${this.hasAttribute('required') ? 'required' : ''}
      >
      <input
        type="file"
        accept="image/*"
        class="uc-input uc-input-library"
      >
    `;

    const cameraInput  = this.querySelector('.uc-input-camera');
    const libraryInput = this.querySelector('.uc-input-library');

    cameraInput.addEventListener('change', e => this.#onFile(e));
    libraryInput.addEventListener('change', e => this.#onFile(e));
    this.querySelector('.uc-btn-camera').addEventListener('click', () => cameraInput.click());
    this.querySelector('.uc-btn-library').addEventListener('click', () => libraryInput.click());

    const preview = this.querySelector('.uc-preview');
    preview.addEventListener('click', () => libraryInput.click());
    preview.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); libraryInput.click(); }
    });
  }

  async #onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const dataUrl = await this.#toDataUrl(file);
    const base64  = dataUrl.split(',')[1];

    // Update preview
    const preview = this.querySelector('.uc-preview');
    preview.innerHTML = `<img src="${dataUrl}" alt="Item preview" class="uc-img">`;

    this.dispatchEvent(new CustomEvent('capture', {
      bubbles: true,
      detail: { imageBase64: base64, mimeType: file.type },
    }));
  }

  #toDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

customElements.define('up-camera', UpCamera);

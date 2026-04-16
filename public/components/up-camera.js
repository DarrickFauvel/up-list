class UpCamera extends HTMLElement {
  connectedCallback() {
    this.classList.add('up-camera');
    this.innerHTML = `
      <div class="uc-preview" role="button" tabindex="0" aria-label="Select or capture photo">
        <span class="uc-placeholder">📷 Tap to add a photo</span>
      </div>
      <button type="button" class="uc-btn btn btn-ghost btn-full">Choose photo / camera</button>
      <input
        type="file"
        name="${this.getAttribute('name') ?? 'image'}"
        accept="image/*"
        class="uc-input"
        ${this.hasAttribute('required') ? 'required' : ''}
      >
    `;

    const input   = this.querySelector('.uc-input');
    const trigger = () => input.click();

    input.addEventListener('change', e => this.#onFile(e));
    this.querySelector('.uc-btn').addEventListener('click', trigger);
    const preview = this.querySelector('.uc-preview');
    preview.addEventListener('click', trigger);
    preview.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); }
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

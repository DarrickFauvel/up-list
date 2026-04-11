/**
 * <up-camera>
 *
 * Renders a file-input / camera-capture widget.
 * When a file is selected it:
 *   - shows a preview
 *   - emits a `capture` event with { imageBase64, mimeType }
 *   - optionally writes to Datastar signals via data-bind attributes
 *     (data-bind-imageBase64 and data-bind-imageMimeType)
 *
 * Attributes:
 *   name      — forwarded to the hidden file input (for form submission fallback)
 *   required  — passed through to the file input
 */
class UpCamera extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.render();
    this.shadowRoot.querySelector('input').addEventListener('change', e => this.#onFile(e));
    this.shadowRoot.querySelector('.capture-btn').addEventListener('click', () => {
      this.shadowRoot.querySelector('input').click();
    });
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .preview {
          width: 100%;
          aspect-ratio: 4 / 3;
          border: 2px dashed var(--color-border, #e2e2ef);
          border-radius: var(--radius, 0.5rem);
          background: var(--color-surface, #f8f8fc);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          overflow: hidden;
          cursor: pointer;
          position: relative;
        }
        .preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          inset: 0;
        }
        .preview-placeholder { color: var(--color-muted, #6b6b8a); font-size: 0.9rem; text-align: center; padding: 1rem; }
        .capture-btn {
          width: 100%;
          padding: 0.5rem;
          border: 1.5px solid var(--color-border, #e2e2ef);
          border-radius: var(--radius, 0.5rem);
          background: var(--color-bg, #fff);
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--color-text, #1a1a2e);
          margin-top: 0.5rem;
        }
        input[type="file"] { display: none; }
      </style>

      <div class="preview" role="button" tabindex="0" aria-label="Select or capture photo">
        <span class="preview-placeholder">📷 Tap to add a photo</span>
      </div>
      <button type="button" class="capture-btn">Choose photo / camera</button>
      <input
        type="file"
        name="${this.getAttribute('name') ?? 'image'}"
        accept="image/*"
        capture="environment"
        ${this.hasAttribute('required') ? 'required' : ''}
      >
    `;
  }

  async #onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const dataUrl = await this.#toDataUrl(file);
    const base64  = dataUrl.split(',')[1];

    // Update preview
    const preview = this.shadowRoot.querySelector('.preview');
    let img = preview.querySelector('img');
    if (!img) {
      preview.innerHTML = '';
      img = document.createElement('img');
      img.alt = 'Item preview';
      preview.appendChild(img);
    }
    img.src = dataUrl;

    // Write to Datastar store if bindings are present
    const storeEl = this.closest('[data-store]');
    if (storeEl && typeof window.__datastar !== 'undefined') {
      // Datastar signal update — field names come from data-bind-* attributes
      const base64Attr = this.getAttribute('data-bind-imageBase64')?.replace(/^\$/, '');
      const mimeAttr   = this.getAttribute('data-bind-imageMimeType')?.replace(/^\$/, '');
      if (base64Attr) window.__datastar?.signals?.[base64Attr]?.set(base64);
      if (mimeAttr)   window.__datastar?.signals?.[mimeAttr]?.set(file.type);
    }

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

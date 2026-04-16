class UpDraftField extends HTMLElement {
  static observedAttributes = ['data-streaming'];

  connectedCallback() {
    this.classList.add('field');

    const label     = this.getAttribute('label') ?? '';
    const name      = this.getAttribute('name')  ?? '';
    const multiline = this.hasAttribute('multiline');
    const maxlength = this.getAttribute('maxlength') ?? '';
    const dataBind  = this.getAttribute('data-bind') ?? '';
    const id        = `draft-${name}`;

    const attrs = [
      `id="${id}"`,
      `name="${name}"`,
      `class="udf-input"`,
      dataBind  ? `data-bind="${dataBind}"` : '',
      maxlength ? `maxlength="${maxlength}"` : '',
    ].filter(Boolean).join(' ');

    this.innerHTML = `
      <label for="${id}">${label}</label>
      ${multiline
        ? `<textarea ${attrs} rows="5"></textarea>`
        : `<input type="text" ${attrs}>`
      }
    `;

    // data-bind is now on the inner input; remove from host to avoid double-processing
    this.removeAttribute('data-bind');
  }

  attributeChangedCallback(_name, _old, val) {
    const input = this.querySelector('.udf-input');
    if (input) input.dataset.streaming = val === 'true' ? 'true' : 'false';
  }
}

customElements.define('up-draft-field', UpDraftField);

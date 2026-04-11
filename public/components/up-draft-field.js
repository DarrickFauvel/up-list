/**
 * <up-draft-field>
 *
 * A form field that displays a shimmer skeleton while AI is streaming
 * and becomes an editable input/textarea once the value is populated.
 *
 * Attributes:
 *   label       — visible label text
 *   name        — field name
 *   multiline   — if present, renders a textarea instead of input
 *   maxlength   — forwarded to input
 *   data-streaming — set to "true" while AI is generating (shows shimmer)
 *
 * The host element should carry Datastar data-bind="$fieldName" so the
 * framework keeps the value in sync.
 */
class UpDraftField extends HTMLElement {
  static observedAttributes = ['data-streaming'];

  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.#render();
  }

  attributeChangedCallback(name, _old, val) {
    if (!this.shadowRoot) return;
    const field = this.shadowRoot.querySelector('.field-input');
    if (field) field.dataset.streaming = val ?? 'false';
  }

  #render() {
    const label     = this.getAttribute('label') ?? '';
    const name      = this.getAttribute('name')  ?? '';
    const multiline = this.hasAttribute('multiline');
    const maxlength = this.getAttribute('maxlength') ?? '';
    const id        = `draft-${name}`;

    const inputHtml = multiline
      ? `<textarea id="${id}" name="${name}" rows="5" class="field-input"></textarea>`
      : `<input type="text" id="${id}" name="${name}" class="field-input"${maxlength ? ` maxlength="${maxlength}"` : ''}>`;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: flex; flex-direction: column; gap: 0.25rem; }
        label { font-size: 0.875rem; font-weight: 500; color: var(--color-muted, #6b6b8a); }
        .field-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1.5px solid var(--color-border, #e2e2ef);
          border-radius: var(--radius, 0.5rem);
          background: var(--color-bg, #fff);
          color: var(--color-text, #1a1a2e);
          font: inherit;
          resize: vertical;
          transition: border-color 0.15s;
        }
        .field-input:focus { outline: none; border-color: var(--color-primary, #4f46e5); }

        @keyframes shimmer {
          from { background-position: -200% 0; }
          to   { background-position:  200% 0; }
        }
        .field-input[data-streaming="true"] {
          background: linear-gradient(
            90deg,
            var(--color-surface, #f8f8fc) 25%,
            var(--color-border, #e2e2ef) 50%,
            var(--color-surface, #f8f8fc) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          color: transparent;
          pointer-events: none;
        }
      </style>
      <label for="${id}">${label}</label>
      ${inputHtml}
    `;
  }
}

customElements.define('up-draft-field', UpDraftField);

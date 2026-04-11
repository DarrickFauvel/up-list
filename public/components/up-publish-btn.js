/**
 * <up-publish-btn>
 *
 * Publish to eBay button. Handles loading / success / error states.
 *
 * Attributes:
 *   item-id — the item to publish
 */
class UpPublishBtn extends HTMLElement {
  #state = 'idle'; // idle | loading | success | error

  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.#render();
    this.shadowRoot.querySelector('button').addEventListener('click', () => this.#publish());
  }

  async #publish() {
    if (this.#state === 'loading') return;
    this.#setState('loading');

    try {
      const id   = this.getAttribute('item-id');
      const resp = await fetch(`/items/${id}/publish`, { method: 'POST' });
      const data = await resp.json();

      if (!resp.ok) throw new Error(data.error ?? 'Publish failed');

      this.#setState('success');
      this.dispatchEvent(new CustomEvent('published', { bubbles: true, detail: data }));
    } catch (err) {
      this.#setState('error');
      this.dispatchEvent(new CustomEvent('publish-error', { bubbles: true, detail: { message: err.message } }));
      // Auto-reset after 4 seconds
      setTimeout(() => this.#setState('idle'), 4000);
    }
  }

  #setState(state) {
    this.#state = state;
    this.#render();
  }

  #render() {
    const labels = {
      idle:    'Publish to eBay',
      loading: 'Publishing…',
      success: 'Published!',
      error:   'Failed — retry?',
    };

    this.shadowRoot.innerHTML = `
      <style>
        button {
          display: inline-flex; align-items: center; gap: 0.4rem;
          padding: 0.5em 1.25em;
          border-radius: var(--radius, 0.5rem);
          border: none; font: inherit; font-weight: 500;
          cursor: pointer; transition: background 0.15s;
        }
        button.idle    { background: #e53e3e; color: #fff; }
        button.idle:hover { background: #c53030; }
        button.loading { background: #c53030; color: #fff; opacity: 0.8; cursor: wait; }
        button.success { background: var(--color-success, #16a34a); color: #fff; }
        button.error   { background: var(--color-danger, #dc2626); color: #fff; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
      </style>
      <button class="${this.#state}" ${this.#state === 'loading' ? 'disabled' : ''}>
        ${labels[this.#state]}
      </button>
    `;

    // Re-attach listener after re-render
    this.shadowRoot.querySelector('button').addEventListener('click', () => this.#publish());
  }
}

customElements.define('up-publish-btn', UpPublishBtn);

class UpPublishBtn extends HTMLElement {
  #state = 'idle';

  connectedCallback() {
    this.classList.add('up-publish-btn');
    this.#render();
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
      setTimeout(() => this.#setState('idle'), 4000);
    }
  }

  #setState(s) { this.#state = s; this.#render(); }

  #render() {
    const labels = { idle: 'Publish to eBay', loading: 'Publishing…', success: 'Published!', error: 'Failed — retry?' };
    this.innerHTML = `
      <button
        class="btn upb-btn upb-${this.#state}"
        ${this.#state === 'loading' ? 'disabled' : ''}
      >${labels[this.#state]}</button>
    `;
    this.querySelector('button').addEventListener('click', () => this.#publish());
  }
}

customElements.define('up-publish-btn', UpPublishBtn);

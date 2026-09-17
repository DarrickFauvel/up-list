class UpPublishBtn extends HTMLElement {
  #state    = 'idle';   // idle | loading | success | error
  #status   = 'draft';  // draft | ebay_draft | published | failed
  #hasOffer = false;

  connectedCallback() {
    this.classList.add('up-publish-btn');
    this.#status   = this.getAttribute('status') ?? 'draft';
    this.#hasOffer = this.getAttribute('ebay-offer') === '1';
    this.#render();
  }

  get #goingLive() {
    return this.#status === 'ebay_draft' || (this.#status === 'failed' && this.#hasOffer);
  }

  async #trigger() {
    if (this.#state === 'loading') return;
    this.#setState('loading');

    const goingLive = this.#goingLive;
    try {
      const id     = this.getAttribute('item-id');
      const action = goingLive ? 'go-live' : 'publish';
      const resp   = await fetch(`/items/${id}/${action}`, { method: 'POST' });
      const data   = await resp.json();

      if (!resp.ok) throw new Error(data.error ?? 'Request failed');

      this.#status   = goingLive ? 'published' : 'ebay_draft';
      this.#hasOffer = true;
      this.#setState('success');
      this.dispatchEvent(new CustomEvent('published', { bubbles: true, detail: data }));

      if (this.#status !== 'published') {
        setTimeout(() => this.#setState('idle'), 1800);
      }
    } catch (err) {
      this.#setState('error');
      this.dispatchEvent(new CustomEvent('publish-error', { bubbles: true, detail: { message: err.message } }));
      setTimeout(() => this.#setState('idle'), 4000);
    }
  }

  #setState(s) { this.#state = s; this.#render(); }

  #render() {
    if (this.#status === 'published') {
      this.innerHTML = `<button class="btn upb-btn upb-published" disabled>Published to eBay ✓</button>`;
      return;
    }

    const goingLive = this.#goingLive;
    const labels = {
      idle:    goingLive ? 'Go live on eBay'  : 'Save eBay draft',
      loading: goingLive ? 'Publishing…'      : 'Saving draft…',
      success: 'Draft saved!',
      error:   'Failed — retry?',
    };

    this.innerHTML = `
      <button
        class="btn upb-btn upb-${this.#state}"
        ${this.#state === 'loading' ? 'disabled' : ''}
      >${labels[this.#state]}</button>
      ${goingLive
        ? '<p class="upb-hint">Saved as a draft on eBay — review it in Seller Hub, then click to go live.</p>'
        : ''}
    `;
    this.querySelector('button').addEventListener('click', () => this.#trigger());
  }
}

customElements.define('up-publish-btn', UpPublishBtn);

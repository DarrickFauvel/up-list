class UpItemCard extends HTMLElement {
  connectedCallback() {
    const id     = this.getAttribute('item-id')   ?? '';
    const title  = this.getAttribute('title')     ?? 'Untitled draft';
    const status = this.getAttribute('status')    ?? 'draft';
    const img    = this.getAttribute('image-url') ?? '';
    const price  = this.getAttribute('price')     ?? '';

    this.classList.add('up-item-card');
    this.innerHTML = `
      <a href="/items/${id}" class="uic-link">
        ${img
          ? `<img src="${img}" alt="" class="uic-img" loading="lazy">`
          : `<div class="uic-img uic-img-placeholder" aria-hidden="true">📦</div>`
        }
        <div class="uic-body">
          <p class="uic-title">${title}</p>
          <div class="uic-footer">
            ${price ? `<span class="uic-price">$${Number(price).toFixed(2)}</span>` : ''}
            <span class="badge badge-${status}">${status}</span>
          </div>
        </div>
      </a>
      <button type="button" class="uic-delete" aria-label="Delete listing" title="Delete">✕</button>
    `;

    this.querySelector('.uic-delete').addEventListener('click', async (e) => {
      e.preventDefault();
      if (!await confirmDelete('This listing will be permanently deleted.')) return;
      await fetch(`/items/${id}`, { method: 'DELETE' });
      this.closest('li')?.remove();
    });
  }
}

customElements.define('up-item-card', UpItemCard);

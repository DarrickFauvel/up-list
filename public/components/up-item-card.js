/**
 * <up-item-card>
 *
 * Dashboard card for a single listing draft.
 *
 * Attributes:
 *   item-id    — the item's database ID
 *   title      — listing title
 *   status     — draft | published | failed
 *   image-url  — thumbnail URL (optional)
 *   price      — numeric price (optional)
 */
class UpItemCard extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.#render();
  }

  #render() {
    const id     = this.getAttribute('item-id')  ?? '';
    const title  = this.getAttribute('title')    ?? 'Untitled draft';
    const status = this.getAttribute('status')   ?? 'draft';
    const img    = this.getAttribute('image-url') ?? '';
    const price  = this.getAttribute('price')    ?? '';

    const imgHtml = img
      ? `<img src="${img}" alt="" class="card-img" loading="lazy">`
      : `<div class="card-img card-img-placeholder" aria-hidden="true">📦</div>`;

    const priceHtml = price
      ? `<span class="card-price">$${Number(price).toFixed(2)}</span>`
      : '';

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        a {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--color-border, #e2e2ef);
          border-radius: var(--radius-lg, 1rem);
          overflow: hidden;
          text-decoration: none;
          color: inherit;
          background: var(--color-surface, #f8f8fc);
          transition: box-shadow 0.15s, transform 0.15s;
          container-type: inline-size;
        }
        a:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-2px); }

        .card-img {
          width: 100%;
          aspect-ratio: 4 / 3;
          object-fit: cover;
        }
        .card-img-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-border, #e2e2ef);
          font-size: 2rem;
        }

        .card-body { padding: 0.75rem 1rem 1rem; display: flex; flex-direction: column; gap: 0.4rem; }
        .card-title { font-weight: 600; font-size: 0.95rem; line-height: 1.3;
                      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .card-footer { display: flex; align-items: center; justify-content: space-between; }
        .card-price  { font-size: 1rem; font-weight: 700; color: var(--color-primary, #4f46e5); }

        .badge {
          display: inline-block; padding: 0.15em 0.55em;
          border-radius: 999px; font-size: 0.7rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .badge-draft     { background: #fef3c7; color: #92400e; }
        .badge-published { background: #dcfce7; color: #166534; }
        .badge-failed    { background: #fee2e2; color: #991b1b; }
      </style>

      <a href="/items/${id}">
        ${imgHtml}
        <div class="card-body">
          <p class="card-title">${title}</p>
          <div class="card-footer">
            ${priceHtml}
            <span class="badge badge-${status}">${status}</span>
          </div>
        </div>
      </a>
    `;
  }
}

customElements.define('up-item-card', UpItemCard);

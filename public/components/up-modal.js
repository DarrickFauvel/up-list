class UpModal extends HTMLElement {
  connectedCallback() {
    this.classList.add('up-modal');

    const dialog = document.createElement('dialog');
    dialog.className = 'um-dialog';

    const inner = document.createElement('div');
    inner.className = 'um-inner';

    while (this.firstChild) inner.appendChild(this.firstChild);
    dialog.appendChild(inner);
    this.appendChild(dialog);

    // Close on backdrop click
    dialog.addEventListener('click', e => { if (e.target === dialog) this.close(); });

    // data-action dispatcher
    this.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      if (action === 'close') this.close();
      else this.dispatchEvent(new CustomEvent(action, { bubbles: true }));
    });
  }

  open() {
    const dialog = this.querySelector('dialog');
    if (!dialog) return;
    dialog.classList.remove('is-closing');
    dialog.showModal();
  }

  close() {
    const dialog = this.querySelector('dialog');
    if (!dialog || dialog.classList.contains('is-closing')) return;
    dialog.classList.add('is-closing');
    dialog.addEventListener('animationend', () => {
      dialog.classList.remove('is-closing');
      dialog.close();
    }, { once: true });
  }
}

customElements.define('up-modal', UpModal);

// Programmatic delete-confirmation modal.
// Usage: const ok = await confirmDelete('This will be permanently deleted.');
window.confirmDelete = function(message = 'This item will be permanently deleted.') {
  return new Promise(resolve => {
    const el = document.createElement('up-modal');
    el.innerHTML = `
      <div class="um-icon um-icon--danger" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </div>
      <div class="um-title">Are you sure?</div>
      <p class="um-body">${message}</p>
      <div class="um-actions">
        <button class="btn btn-ghost" data-action="close">Cancel</button>
        <button class="btn btn-danger um-btn-delete">Delete</button>
      </div>
    `;
    document.body.appendChild(el);

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
      el.close();
      setTimeout(() => el.remove(), 350);
    };

    // ESC key / native dialog close
    el.querySelector('dialog').addEventListener('close', () => finish(false), { once: true });
    el.querySelector('.um-btn-delete').addEventListener('click', () => finish(true));

    requestAnimationFrame(() => el.open());
  });
};

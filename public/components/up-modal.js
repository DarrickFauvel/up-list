/**
 * <up-modal>
 *
 * Generic modal shell using the native <dialog> element.
 *
 * Usage:
 *   <up-modal id="confirm-modal">
 *     <span slot="title">Confirm delete</span>
 *     <p>Are you sure?</p>
 *     <div slot="actions">
 *       <button data-action="close">Cancel</button>
 *       <button data-action="confirm">Delete</button>
 *     </div>
 *   </up-modal>
 *
 *   document.getElementById('confirm-modal').open();
 *   modal.addEventListener('confirm', () => { ... });
 */
class UpModal extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        dialog {
          border: none;
          border-radius: 1rem;
          padding: 0;
          max-width: min(90vw, 32rem);
          width: 100%;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        dialog::backdrop { background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); }
        .modal-inner { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
        .modal-title { font-size: 1.1rem; font-weight: 700; }
        .modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; flex-wrap: wrap; }
      </style>
      <dialog>
        <div class="modal-inner">
          <div class="modal-title"><slot name="title"></slot></div>
          <slot></slot>
          <div class="modal-actions"><slot name="actions"></slot></div>
        </div>
      </dialog>
    `;

    const dialog = this.shadowRoot.querySelector('dialog');
    dialog.addEventListener('click', e => {
      if (e.target === dialog) this.close();
    });

    // Bubble slot action events
    this.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      if (action === 'close') this.close();
      else this.dispatchEvent(new CustomEvent(action, { bubbles: true }));
    });
  }

  open()  { this.shadowRoot.querySelector('dialog').showModal(); }
  close() { this.shadowRoot.querySelector('dialog').close(); }
}

customElements.define('up-modal', UpModal);

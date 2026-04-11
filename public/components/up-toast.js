/**
 * <up-toast>
 *
 * Global toast notification host. One instance lives in layout.eta.
 *
 * Usage from JS:
 *   document.querySelector('up-toast').show('Your message', 'success');
 *   // type: 'success' | 'error' | 'info'
 */
class UpToast extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host { position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999; display: flex; flex-direction: column; gap: 0.5rem; }
        .toast {
          padding: 0.75rem 1.25rem;
          border-radius: 0.5rem;
          font-size: 0.9rem;
          font-weight: 500;
          color: #fff;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
          animation: slide-in 0.2s ease;
          max-width: 24rem;
        }
        .toast-success { background: #16a34a; }
        .toast-error   { background: #dc2626; }
        .toast-info    { background: #1d4ed8; }
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(0.5rem); }
          to   { opacity: 1; transform: translateY(0); }
        }
      </style>
    `;
  }

  show(message, type = 'info', duration = 4000) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    this.shadowRoot.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }
}

customElements.define('up-toast', UpToast);

// Convenience global
export function toast(message, type = 'info') {
  document.querySelector('up-toast')?.show(message, type);
}

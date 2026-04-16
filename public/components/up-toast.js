class UpToast extends HTMLElement {
  connectedCallback() {
    this.classList.add('up-toast');
  }

  show(message, type = 'info', duration = 4000) {
    const el = document.createElement('div');
    el.className = `ut-toast ut-${type}`;
    el.textContent = message;
    this.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }
}

customElements.define('up-toast', UpToast);

export function toast(message, type = 'info') {
  document.querySelector('up-toast')?.show(message, type);
}

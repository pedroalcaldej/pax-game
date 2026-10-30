export class PhaseReadyButton {
  constructor(element, onToggle) {
    this.element = element;
    this.onToggle = onToggle;
    this.element?.addEventListener('click', () => this.onToggle());
  }

  update({ ready, readyCount, requiredCount, enabled }) {
    if (!this.element) return;
    this.element.disabled = !enabled;
    this.element.textContent = `${ready ? 'Listo ✓' : 'Listo'} (${readyCount}/${requiredCount})`;
    this.element.title = ready
      ? 'Estás listo. Pulsa de nuevo para retirar tu confirmación'
      : 'Pulsa para marcarte listo; la fase termina cuando todos los jugadores humanos lo estén';
  }
}

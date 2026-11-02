function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function colorizePlayerNames(message, players = []) {
  const entries = players
    .filter((player) => player?.name)
    .sort((left, right) => right.name.length - left.name.length);
  if (!entries.length) return escapeHTML(message);

  const escapedNames = entries.map(({ name }) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(escapedNames.join('|'), 'giu');
  const source = String(message);
  let html = '';
  let lastIndex = 0;
  for (const match of source.matchAll(pattern)) {
    const player = entries.find(({ name }) => name.toLocaleLowerCase() === match[0].toLocaleLowerCase());
    const color = /^#[0-9a-f]{6}$/i.test(player?.color || '') ? player.color : '#cbd5e1';
    html += escapeHTML(source.slice(lastIndex, match.index));
    html += `<strong style="color:${color}">${escapeHTML(match[0])}</strong>`;
    lastIndex = match.index + match[0].length;
  }
  return html + escapeHTML(source.slice(lastIndex));
}

function renderEventMessage(message, players = []) {
  const coordinatePattern = /\((\d+)\s*,\s*(\d+)\)/g;
  let html = '';
  let lastIndex = 0;
  for (const match of String(message).matchAll(coordinatePattern)) {
    html += colorizePlayerNames(String(message).slice(lastIndex, match.index), players);
    html += `<button class="pax-event-coordinate" type="button" data-map-x="${match[1]}" data-map-y="${match[2]}" aria-label="Seleccionar casilla (${match[1]}, ${match[2]})">(${match[1]}, ${match[2]})</button>`;
    lastIndex = match.index + match[0].length;
  }
  return html + colorizePlayerNames(String(message).slice(lastIndex), players);
}

function formatEventTime(timestamp) {
  return new Date(Number(timestamp) || Date.now()).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export class EventLog {
  constructor(element, { onCoordinateHover = () => {}, onCoordinateLeave = () => {}, onCoordinateSelect = () => {} } = {}) {
    this.element = element;
    this.renderSignature = null;
    this.onCoordinateHover = onCoordinateHover;
    this.onCoordinateLeave = onCoordinateLeave;
    this.onCoordinateSelect = onCoordinateSelect;
    this.element?.addEventListener('pointerover', (event) => {
      const coordinate = event.target.closest?.('[data-map-x][data-map-y]');
      if (coordinate) this.onCoordinateHover(Number(coordinate.dataset.mapX), Number(coordinate.dataset.mapY));
    });
    this.element?.addEventListener('pointerout', (event) => {
      const coordinate = event.target.closest?.('[data-map-x][data-map-y]');
      if (coordinate && !coordinate.contains(event.relatedTarget)) this.onCoordinateLeave();
    });
    this.element?.addEventListener('focusin', (event) => {
      const coordinate = event.target.closest?.('[data-map-x][data-map-y]');
      if (coordinate) this.onCoordinateHover(Number(coordinate.dataset.mapX), Number(coordinate.dataset.mapY));
    });
    this.element?.addEventListener('focusout', (event) => {
      if (event.target.matches?.('[data-map-x][data-map-y]')) this.onCoordinateLeave();
    });
    this.element?.addEventListener('click', (event) => {
      const coordinate = event.target.closest?.('[data-map-x][data-map-y]');
      if (coordinate) this.onCoordinateSelect(Number(coordinate.dataset.mapX), Number(coordinate.dataset.mapY));
    });
  }

  render(events = [], players = [], scrollTop = this.element?.scrollTop || 0) {
    if (!this.element) return;
    const signature = [
      events.map((entry) => {
        const event = typeof entry === 'string' ? { message: entry } : entry;
        return `${event.timestamp || ''}:${event.message || ''}`;
      }).join('|'),
      players.map((player) => `${player.id}:${player.name}:${player.color}`).join('|')
    ].join('||');
    if (signature === this.renderSignature) return;
    this.renderSignature = signature;
    this.element.innerHTML = events.map((entry) => {
      const event = typeof entry === 'string' ? { message: entry } : entry;
      const message = renderEventMessage(event.message, players);
      return `<div class="pax-event-entry"><time>${formatEventTime(event.timestamp)}</time> › ${message}</div>`;
    }).join('');
    this.element.scrollTop = scrollTop;
  }
}

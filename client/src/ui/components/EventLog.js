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

function formatEventTime(timestamp) {
  return new Date(Number(timestamp) || Date.now()).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export class EventLog {
  constructor(element) {
    this.element = element;
  }

  render(events, players, scrollTop = this.element?.scrollTop || 0) {
    if (!this.element) return;
    this.element.innerHTML = events.map((entry) => {
      const event = typeof entry === 'string' ? { message: entry } : entry;
      const message = colorizePlayerNames(event.message, players);
      return `<div class="pax-event-entry"><time>${formatEventTime(event.timestamp)}</time> › ${message}</div>`;
    }).join('');
    this.element.scrollTop = scrollTop;
  }
}

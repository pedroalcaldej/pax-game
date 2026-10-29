/**
 * Chat de texto de la partida sincronizado mediante Firebase.
 */

import { NATIONS } from '../../../../shared/Constants.js';

const MAX_MESSAGE_LENGTH = 240;

function formatTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export class Chat {
  constructor(container, { onSend }) {
    this.container = container;
    this.onSend = onSend;
    this.messages = new Map();
    this.identity = { nationName: 'Nación', nationColor: '#94a3b8' };
    this.render();
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.send();
    });
  }

  render() {
    this.container.innerHTML = `
      <section class="pax-chat is-collapsed" aria-label="Chat de la partida">
        <button class="pax-chat-header" type="button" aria-expanded="false">
          <span>Chat de la partida</span>
          <span aria-hidden="true">⌄</span>
        </button>
        <div class="pax-chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
        <form class="pax-chat-form">
          <input type="text" maxlength="${MAX_MESSAGE_LENGTH}" placeholder="Escribe un mensaje…" aria-label="Mensaje" autocomplete="off" />
          <button type="submit">Enviar</button>
        </form>
      </section>
    `;
    this.messagesElement = this.container.querySelector('.pax-chat-messages');
    this.form = this.container.querySelector('.pax-chat-form');
    this.input = this.form.querySelector('input');
    this.header = this.container.querySelector('.pax-chat-header');
    this.header.addEventListener('click', () => this.toggle());
  }

  toggle() {
    const collapsed = this.container.querySelector('.pax-chat').classList.toggle('is-collapsed');
    this.header.setAttribute('aria-expanded', String(!collapsed));
    this.header.lastElementChild.textContent = collapsed ? '⌄' : '⌃';
  }

  setEnabled(enabled) {
    this.container.hidden = !enabled;
    this.form.querySelector('input').disabled = !enabled;
    this.form.querySelector('button').disabled = !enabled;
    this.header.disabled = !enabled;
  }

  setIdentity(player) {
    const nation = NATIONS[player?.nationId];
    this.identity = {
      nationName: player?.name || nation?.name || 'Nación',
      nationColor: player?.color || nation?.color || '#94a3b8'
    };
  }

  clear() {
    this.messages.clear();
    this.messagesElement.innerHTML = '';
  }

  addMessage(message) {
    if (!message?.id || this.messages.has(message.id)) return;
    this.messages.set(message.id, message);
    const color = /^#[0-9A-Fa-f]{6}$/.test(message.nationColor || '')
      ? message.nationColor
      : '#94a3b8';
    this.messagesElement.insertAdjacentHTML('beforeend', `
      <div class="pax-chat-message">
        <time datetime="${escapeHTML(new Date(Number(message.createdAt) || Date.now()).toISOString())}">${formatTime(message.createdAt)}</time>
        <strong style="color:${color}">${escapeHTML(message.nationName || 'Nación')}:</strong>
        <span>${escapeHTML(message.text || '')}</span>
      </div>
    `);
    requestAnimationFrame(() => {
      this.messagesElement.scrollTo({
        top: this.messagesElement.scrollHeight,
        behavior: 'auto'
      });
    });
  }

  send() {
    const text = this.input.value.trim();
    if (!text) return;
    this.input.value = '';
    Promise.resolve(this.onSend?.({
      ...this.identity,
      text: text.slice(0, MAX_MESSAGE_LENGTH)
    })).catch((error) => {
      this.input.value = text;
      this.container.dispatchEvent(new CustomEvent('chaterror', { detail: error }));
    });
  }
}
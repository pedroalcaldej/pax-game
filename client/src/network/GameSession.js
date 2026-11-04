export const SESSION_USER_KEY = 'pax_user_id';
const SESSION_ROOM_KEY = 'pax_room_id';
const SOLO_SESSION_KEY = 'pax_solo_session';

export function readGameSession(session = globalThis.sessionStorage, local = globalThis.localStorage) {
  const roomId = session.getItem(SESSION_ROOM_KEY);
  const userId = session.getItem(SESSION_USER_KEY);
  if (roomId && userId) return { roomId, userId };
  try {
    const saved = JSON.parse(local.getItem(SOLO_SESSION_KEY));
    return saved?.roomId?.startsWith('solo-') && saved.userId ? saved : null;
  } catch { return null; }
}

export function saveGameSession(roomId, userId, session = globalThis.sessionStorage, local = globalThis.localStorage) {
  if (!roomId || !userId) return;
  session.setItem(SESSION_ROOM_KEY, roomId);
  session.setItem(SESSION_USER_KEY, userId);
  if (roomId.startsWith('solo-')) {
    try { local.setItem(SOLO_SESSION_KEY, JSON.stringify({ roomId, userId })); } catch { /* Storage may be unavailable. */ }
  }
}

export function clearGameSession(roomId, session = globalThis.sessionStorage, local = globalThis.localStorage) {
  session.removeItem(SESSION_ROOM_KEY);
  session.removeItem(SESSION_USER_KEY);
  try {
    if (JSON.parse(local.getItem(SOLO_SESSION_KEY))?.roomId === roomId) local.removeItem(SOLO_SESSION_KEY);
  } catch { /* A missing or invalid saved session needs no cleanup. */ }
}

/** Visibility handles tab changes; blur and pagehide cover other windows and closing. */
export function watchGameVisibility(onChange, doc = globalThis.document, win = globalThis.window) {
  let backgrounded = doc.hidden || !doc.hasFocus();
  const update = (value) => { backgrounded = value; onChange(value); };
  const listeners = [
    [doc, 'visibilitychange', () => update(doc.hidden || !doc.hasFocus())],
    [win, 'blur', () => update(true)],
    [win, 'focus', () => update(doc.hidden)],
    [win, 'pagehide', () => update(true)],
    [win, 'pageshow', () => update(doc.hidden || !doc.hasFocus())]
  ];
  for (const [target, event, callback] of listeners) target.addEventListener(event, callback);
  return {
    get backgrounded() { return backgrounded; },
    destroy() {
      for (const [target, event, callback] of listeners) target.removeEventListener(event, callback);
    }
  };
}

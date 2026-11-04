const GAMEPLAY_TRACKS = [
  '/audio/music/chee-zee-jungle.mp3',
  '/audio/music/crossing-the-chasm.mp3',
  '/audio/music/crusade.mp3',
  '/audio/music/interloper.mp3'
];

const TRANSACTION_SOUND = '/audio/sfx/coincollect.mp3';
const CLICK_SOUND = '/audio/sfx/click.mp3';
const AUDIO_SETTINGS_KEY = 'pax-audio-settings';
const DEFAULT_VOLUMES = { music: 0.28, effects: 0.65 };

/** Reproductor de música de partida y efectos de transacciones. */
export class GameAudio {
  constructor() {
    this.music = null;
    this.musicIndex = -1;
    this.playlist = [];
    this.musicMode = null;
    this.transaction = null;
    this.volumes = this.readVolumes();
  }

  readVolumes() {
    try {
      const saved = JSON.parse(globalThis.localStorage?.getItem(AUDIO_SETTINGS_KEY) || 'null');
      return {
        music: Number.isFinite(saved?.music) ? Math.min(1, Math.max(0, saved.music)) : DEFAULT_VOLUMES.music,
        effects: Number.isFinite(saved?.effects) ? Math.min(1, Math.max(0, saved.effects)) : DEFAULT_VOLUMES.effects
      };
    } catch {
      return { ...DEFAULT_VOLUMES };
    }
  }

  saveVolumes() {
    try { globalThis.localStorage?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.volumes)); } catch { /* almacenamiento no disponible */ }
  }

  getVolumes() {
    return { ...this.volumes };
  }

  setMusicVolume(value) {
    this.volumes.music = Math.min(1, Math.max(0, Number(value) || 0));
    if (this.music) this.music.volume = this.volumes.music;
    this.saveVolumes();
  }

  setEffectsVolume(value) {
    this.volumes.effects = Math.min(1, Math.max(0, Number(value) || 0));
    if (this.transaction) this.transaction.volume = this.volumes.effects;
    this.saveVolumes();
  }

  playClick() {
    if (typeof Audio === 'undefined') return;
    this.music?.play().catch(() => {});
    const click = new Audio(CLICK_SOUND);
    click.volume = this.volumes.effects;
    click.play().catch(() => {});
  }

  shufflePlaylist() {
    this.playlist = [...GAMEPLAY_TRACKS];
    for (let index = this.playlist.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [this.playlist[index], this.playlist[swapIndex]] = [this.playlist[swapIndex], this.playlist[index]];
    }
    this.musicIndex = -1;
  }

  startMenuMusic() {
    this.startMusic('menu');
  }

  startGameMusic() {
    this.startMusic('game');
  }

  startMusic(mode = 'game') {
    if (typeof Audio === 'undefined') return;
    if (!this.music) {
      this.music = new Audio();
      this.music.volume = this.volumes.music;
      this.music.addEventListener('ended', () => this.playNextTrack());
    }
    if (this.musicMode !== mode || !this.playlist.length) {
      this.musicMode = mode;
      this.shufflePlaylist();
      this.playNextTrack();
      return;
    }
    if (!this.music.src || this.music.ended) this.playNextTrack();
    else this.music.play().catch(() => {});
  }

  playNextTrack() {
    if (!this.music || !this.playlist.length) return;
    this.musicIndex = (this.musicIndex + 1) % this.playlist.length;
    this.music.src = this.playlist[this.musicIndex];
    this.music.load();
    this.music.play().catch(() => {});
  }

  playTransaction() {
    if (typeof Audio === 'undefined') return;
    this.transaction?.pause();
    this.transaction = new Audio(TRANSACTION_SOUND);
    this.transaction.volume = this.volumes.effects;
    this.transaction.play().catch(() => {});
  }

  stop() {
    this.music?.pause();
    this.music?.removeAttribute('src');
    this.music?.load();
    this.transaction?.pause();
    this.transaction = null;
    this.musicMode = null;
    this.playlist = [];
  }
}

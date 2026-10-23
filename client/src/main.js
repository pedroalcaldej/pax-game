/**
 * client/src/main.js
 * Punto de entrada principal para el bundle de la aplicación web de PAX.
 */

import { GameScreen } from './ui/screens/GameScreen.js';

document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (appContainer) {
    new GameScreen(appContainer);
  }
});
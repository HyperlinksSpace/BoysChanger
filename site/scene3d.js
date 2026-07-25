import { createVoiceScene } from './createVoiceScene.js';

const el = document.getElementById('hero-scene');
if (el) {
  createVoiceScene(el, { density: 'full', accent: '#d4ff4a' });
}

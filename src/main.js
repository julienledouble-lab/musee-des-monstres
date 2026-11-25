import Phaser from 'phaser';
import { createInitialWorld } from './sim/world.js';
import { GameScene } from './render/GameScene.js';
import { createUI } from './render/ui.js';

const world = createInitialWorld(Math.floor(Math.random() * 1e9));
const ui = createUI(world);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#8ecae6',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [new GameScene(world, ui)],
});

// handy for debugging in the browser console
window.__museum = { world, game };

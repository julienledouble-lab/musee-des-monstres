import Phaser from 'phaser';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#8ecae6',
  scale: { mode: Phaser.Scale.RESIZE, width: 1280, height: 720 },
  scene: [],
});

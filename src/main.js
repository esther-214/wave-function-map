const config = {
  type: Phaser.AUTO, // Which renderer to use
  width: 1280, // Canvas width in pixels
  height: 960, // Canvas height in pixels
  parent: "game-container", // ID of the DOM element to add the canvas to
  scene: [Load, TinyTown],
  scale: {
    mode: Phaser.Scale.FIT, // Automatically fit the canvas to the screen
    autoCenter: Phaser.Scale.CENTER_BOTH, // Center the canvas
  },
};

const game = new Phaser.Game(config);

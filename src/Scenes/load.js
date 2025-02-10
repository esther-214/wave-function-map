class Load extends Phaser.Scene {
  constructor() {
    super("loadScene");
  }
  preload() {
    this.load.path = "./assets/";
    this.load.image("terrain-tiles", "mapPack_tilesheet.png");
  }
  create() {
    this.scene.start("TinyTown");
  }
}

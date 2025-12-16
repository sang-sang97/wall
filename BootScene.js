class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    // 배경 이미지 로드
    this.load.image("stage_background", "assets/images/stage_background.png");
  }

  create() {
    if (window.loadGameData) {
      window.loadGameData();
    }
    this.scene.start("MenuScene");
  }
}



class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    // 배경 이미지 로드
    const bgPath = "./assets/images/stage_background.png";
    this.load.image("stage_background", bgPath);
    
    // 플레이어 이미지 로드 (현재는 단일 이미지, 나중에 스프라이트 시트로 교체 가능)
    const playerPath = "./assets/images/player_idle.png";
    console.log("플레이어 이미지 로드 시도:", playerPath);
    this.load.image("player_idle", playerPath);
    
    // 땅 이미지 로드
    this.load.image("ground", "./assets/images/Ground.png");
    
    // 벽 이미지 로드 (1~5번)
    for (let i = 1; i <= 5; i += 1) {
      this.load.image(`wall_${i}`, `./assets/images/wall_0${i}.png`);
    }
    
    // 로드 완료 확인 (더 명확한 이벤트 사용)
    this.load.on("filecomplete", (key, type, data) => {
      console.log("✅ 파일 로드 완료:", key, type);
      if (key === "player_idle") {
        console.log("✅ 플레이어 이미지 로드 성공! 크기:", data.width, "x", data.height);
      }
    });
    
    // 로드 에러 확인
    this.load.on("loaderror", (file) => {
      console.error("❌ 이미지 로드 실패:", file.key, "경로:", file.src);
    });
    
    // 전체 로드 완료
    this.load.on("complete", () => {
      console.log("✅ 모든 에셋 로드 완료");
      // 로드 완료 후 텍스처 확인
      if (this.textures.exists("player_idle")) {
        console.log("✅ 로드 완료 시점에 player_idle 텍스처 확인됨");
      } else {
        console.error("❌ 로드 완료 시점에 player_idle 텍스처 없음!");
      }
    });
  }

  create() {
    // 이미지가 실제로 로드되었는지 확인
    console.log("=== BootScene create() 시작 ===");
    if (this.textures.exists("player_idle")) {
      const texture = this.textures.get("player_idle");
      console.log("✅ create() 시점에 player_idle 텍스처 존재 확인");
      console.log("텍스처 크기:", texture.source[0].width, "x", texture.source[0].height);
    } else {
      console.error("❌ create() 시점에 player_idle 텍스처 없음!");
      console.log("사용 가능한 텍스처 목록:", Object.keys(this.textures.list));
    }
    
    if (window.loadGameData) {
      window.loadGameData();
    }
    this.scene.start("MenuScene");
  }
}



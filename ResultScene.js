class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: "ResultScene" });
  }

  init(data) {
    this.isClear = data.isClear;
    this.timeUsed = data.timeUsed ?? 0;
    this.rewardExp = data.rewardExp ?? 0;
    this.rewardGold = data.rewardGold ?? 0;
    this.stageLevel = data.stageLevel || 1;
  }

  create() {
    const { width, height } = this.scale;

    const title = this.isClear ? "CLEAR!" : "FAILED";
    const titleColor = this.isClear ? "#4caf50" : "#e53935";

    this.add
      .text(width / 2, height / 2 - 140, title, {
        fontSize: "52px",
        color: titleColor,
      })
      .setOrigin(0.5);

    const summaryLines = [
      `소요 시간: ${this.timeUsed.toFixed(1)}초`,
      `획득 경험치: ${this.rewardExp}`,
      `획득 골드: ${this.rewardGold}`,
    ];

    const gameData = window.GameData || null;
    if (gameData) {
      gameData.exp += this.rewardExp;
      gameData.gold += this.rewardGold;

      // 레벨업 처리 (간단 곡선)
      let levelUps = 0;
      while (gameData.exp >= gameData.expToNext) {
        gameData.exp -= gameData.expToNext;
        gameData.level += 1;
        gameData.expToNext = Math.floor(gameData.expToNext * 1.2);
        levelUps += 1;
      }

      // 레벨업 시 스킬포인트 지급
      if (levelUps > 0) {
        gameData.skillPoints += levelUps;
      }

      // 스테이지 해금 (클리어 시에만)
      if (this.isClear) {
        const nextStage = this.stageLevel + 1;
        if (!gameData.highestUnlockedStage) {
          gameData.highestUnlockedStage = 1;
        }
        if (nextStage > gameData.highestUnlockedStage) {
          gameData.highestUnlockedStage = nextStage;
        }
      }

      if (window.saveGameData) {
        window.saveGameData();
      }
    }

    this.add
      .text(width / 2, height / 2 - 40, summaryLines.join("\n"), {
        fontSize: "20px",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5);

    const retryText = this.add
      .text(width / 2, height / 2 + 80, "재시작", {
        fontSize: "24px",
        color: "#ffffff",
        backgroundColor: "#333333",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const menuText = this.add
      .text(width / 2, height / 2 + 140, "홈으로 가기", {
        fontSize: "20px",
        color: "#cccccc",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    retryText.on("pointerup", () => {
      this.scene.start("GameScene", { stageLevel: this.stageLevel });
    });

    menuText.on("pointerup", () => {
      this.scene.start("MenuScene");
    });

    this.input.keyboard.on("keydown-ENTER", () => {
      this.scene.start("GameScene", { stageLevel: this.stageLevel });
    });
  }
}



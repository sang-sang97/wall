class MenuScene extends Phaser.Scene {
    constructor() {
      super({ key: "MenuScene" });
    }
  
    create() {
      const { width, height } = this.scale;
  
      const gameData = window.GameData || {
        level: 1,
        exp: 0,
        expToNext: 100,
        gold: 0,
        highestUnlockedStage: 1,
        skillPoints: 0,
      };
  
      // 재화 표시 텍스트 (업데이트 가능하도록 저장)
      this.statsText = this.add
        .text(
          40,
          40,
          `Lv.${gameData.level}\nSP: ${gameData.skillPoints}\nEXP: ${gameData.exp} / ${gameData.expToNext}\nGOLD: ${gameData.gold}`,
          {
            fontSize: "18px",
            color: "#ffffff",
          }
        )
        .setOrigin(0, 0);
      
      // 재화 업데이트 함수
      this.updateStatsText = () => {
        if (this.statsText && window.GameData) {
          const gd = window.GameData;
          this.statsText.setText(`Lv.${gd.level}\nSP: ${gd.skillPoints}\nEXP: ${gd.exp} / ${gd.expToNext}\nGOLD: ${gd.gold}`);
        }
      };
  
      // 스테이지 선택
      this.highestUnlockedStage = gameData.highestUnlockedStage || 1;
      const lastStage = gameData.lastSelectedStage || 1;
      this.currentStage = Math.min(this.highestUnlockedStage, lastStage);
  
      this.stageText = this.add
        .text(width / 2, height / 2 - 40, "", {
          fontSize: "28px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
  
      this.stageRewardText = this.add
        .text(width / 2, height / 2, "", {
          fontSize: "18px",
          color: "#cccccc",
        })
        .setOrigin(0.5);
      this.refreshStageText();
  
      // 스테이지 좌우 화살표
      const leftArrow = this.add
        .text(width / 2 - 140, height / 2 - 40, "<", {
          fontSize: "32px",
          color: "#cccccc",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
  
      const rightArrow = this.add
        .text(width / 2 + 140, height / 2 - 40, ">", {
          fontSize: "32px",
          color: "#cccccc",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
  
      leftArrow.on("pointerup", () => {
        if (this.currentStage > 1) {
          this.currentStage -= 1;
          this.refreshStageText();
        }
      });
  
      rightArrow.on("pointerup", () => {
        if (this.currentStage < this.highestUnlockedStage) {
          this.currentStage += 1;
          this.refreshStageText();
        }
      });
  
      // 게임 시작 버튼
      const startButton = this.add
        .text(width / 2, height / 2 + 60, "게임 시작", {
          fontSize: "22px",
          color: "#ffffff",
          backgroundColor: "#2e7d32",
          padding: { x: 20, y: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
  
      startButton.on("pointerup", () => {
        this.startGame();
      });
  
      this.input.keyboard.on("keydown-ENTER", () => {
        this.startGame();
      });
  
      // 메인 메뉴 버튼들: 일일던전, 상점, 스킬, 장비, 강화
      const buttonLabels = [
        "일일던전",
        "상점",
        "스킬",
        "장비",
        "강화",
      ];
      const buttonY = height - 80;
      const spacing = 120;
      const startX = width / 2 - ((buttonLabels.length - 1) * spacing) / 2;
  
      buttonLabels.forEach((label, index) => {
        const x = startX + spacing * index;
        const btn = this.add
          .text(x, buttonY, label, {
            fontSize: "18px",
            color: "#ffffff",
            backgroundColor: label === "강화" || label === "스킬" ? "#455a64" : "#333333",
            padding: { x: 10, y: 6 },
          })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
  
        btn.on("pointerup", () => {
          if (label === "강화") {
            this.openUpgradePopup();
          } else if (label === "스킬") {
            this.openSkillPopup();
          } else if (label === "일일던전") {
            this.openDailyDungeonPopup();
          } else {
            if (label === "일일던전") {
        this.openDailyDungeonPopup();
      } else {
        this.showComingSoon(label);
      }
          }
        });
      });
    }
  
    refreshStageText() {
      if (!this.stageText) return;
      this.stageText.setText(`STAGE ${this.currentStage}`);
  
      if (this.stageRewardText) {
        const expReward = 50 * this.currentStage;
        const goldReward = 30 * this.currentStage;
        this.stageRewardText.setText(
          `보상: EXP ${expReward} / GOLD ${goldReward}`
        );
      }
    }
  
    showComingSoon(label) {
      const { width, height } = this.scale;
      const overlay = this.add.rectangle(
        width / 2,
        height / 2,
        width,
        height,
        0x000000,
        0.6
      );
  
      const text = this.add
        .text(width / 2, height / 2, `${label}\n준비중입니다.`, {
          fontSize: "24px",
          color: "#ffffff",
          align: "center",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
  
      const close = () => {
        overlay.destroy();
        text.destroy();
      };
  
      text.on("pointerup", close);
      this.input.keyboard.once("keydown-ESC", close);
    }
  
    startGame() {
      const gameData = window.GameData;
      if (gameData) {
        gameData.lastSelectedStage = this.currentStage;
        if (window.saveGameData) window.saveGameData();
      }
      this.scene.start("GameScene", { stageLevel: this.currentStage });
    }
  
    openUpgradePopup() {
      const { width, height } = this.scale;
      const gameData = window.GameData;
      if (!gameData) return;
  
      const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
      const box = this.add.rectangle(width / 2, height / 2, 460, 280, 0x263238, 0.95);
      box.setStrokeStyle(2, 0xffffff);
  
      const title = this.add
        .text(width / 2, height / 2 - 100, "강화", {
          fontSize: "22px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
  
      const lines = ["공격력", "공격속도", "치명타 확률", "치명타 피해"];
      const keys = ["attack", "attackSpeed", "critChance", "critDamage"];
      const costs = [100, 100, 150, 150];
  
      const uiItems = [];
  
      lines.forEach((label, i) => {
        const y = height / 2 - 40 + i * 40;
        const key = keys[i];
        const cost = costs[i];
  
        const current = gameData.upgrades[key];
        const next = current + 5;
  
        const labelText =
          key === "attack"
            ? `${label}: ${10 + current} → ${10 + next}   (비용: ${cost}G)`
            : `${label}: ${current}% → ${next}%   (비용: ${cost}G)`;
  
        const text = this.add
          .text(width / 2 - 200, y, labelText, {
            fontSize: "16px",
            color: "#ffffff",
          })
          .setOrigin(0, 0.5);
  
        const btn = this.add
          .text(width / 2 + 200, y, "강화", {
            fontSize: "16px",
            color: "#ffffff",
            backgroundColor: "#2e7d32",
            padding: { x: 10, y: 4 },
          })
          .setOrigin(1, 0.5)
          .setInteractive({ useHandCursor: true });
  
        btn.on("pointerup", () => {
          if (gameData.gold >= cost) {
            gameData.gold -= cost;
            gameData.upgrades[key] += 5;
            if (window.saveGameData) window.saveGameData();
            const updated = gameData.upgrades[key];
            const updatedNext = updated + 5;
            const updatedLabel =
              key === "attack"
                ? `${label}: ${10 + updated} → ${10 + updatedNext}   (비용: ${cost}G)`
                : `${label}: ${updated}% → ${updatedNext}%   (비용: ${cost}G)`;
            text.setText(updatedLabel);
            // 재화 즉시 반영
            if (this.updateStatsText) this.updateStatsText();
          }
        });
  
        uiItems.push(text, btn);
      });
  
      const closeText = this.add
        .text(width / 2, height / 2 + 110, "닫기 (ESC)", {
          fontSize: "16px",
          color: "#cccccc",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
  
      const close = () => {
        overlay.destroy();
        box.destroy();
        title.destroy();
        closeText.destroy();
        uiItems.forEach((it) => it.destroy());
        this.scene.restart();
      };
  
      closeText.on("pointerup", close);
      this.input.keyboard.once("keydown-ESC", close);
    }
  
    openSkillPopup() {
      const { width, height } = this.scale;
      const gameData = window.GameData;
      if (!gameData) return;
  
      const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
      const box = this.add.rectangle(width / 2, height / 2, 600, 380, 0x263238, 0.95);
      box.setStrokeStyle(2, 0xffffff);
  
      const title = this.add
        .text(width / 2, height / 2 - 160, "스킬", {
          fontSize: "22px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
  
      const skillDefs = [
        {
          key: "doubleJump",
          label: "더블점프",
          maxLevel: 1,
          desc: "점프 중 한 번 더 점프하며 앞으로 대시합니다.",
        },
        {
          key: "doubleAttack",
          label: "더블공격",
          maxLevel: 10,
          desc: "연속 2타 공격. 레벨당 공격력 +5% 효과.",
          requiresSkill: null,
        },
        {
          key: "tripleAttack",
          label: "트리플공격",
          maxLevel: 10,
          desc: "연속 3타 공격. 레벨당 공격력 +5% 효과.",
          requiresSkill: "doubleAttack",
          requiresLevel: 10,
        },
      ];
  
      const uiItems = [];
  
      skillDefs.forEach((def, i) => {
        const y = height / 2 - 110 + i * 100;
        const level = gameData.skills[def.key] || 0;
  
        // 선행 스킬 체크
        let isLocked = false;
        let lockReason = "";
        if (def.requiresSkill) {
          const reqLevel = gameData.skills[def.requiresSkill] || 0;
          if (reqLevel < def.requiresLevel) {
            isLocked = true;
            lockReason = `(${skillDefs.find(s => s.key === def.requiresSkill).label} ${def.requiresLevel}레벨 필요)`;
          }
        }
  
        const levelText = this.add
          .text(
            width / 2 - 260,
            y,
            `${def.label}  ${level}/${def.maxLevel} ${isLocked ? lockReason : ""}`,
            {
              fontSize: "16px",
              color: isLocked ? "#888888" : "#ffffff",
            }
          )
          .setOrigin(0, 0.5);
  
        const descText = this.add
          .text(width / 2 - 260, y + 24, def.desc, {
            fontSize: "14px",
            color: isLocked ? "#666666" : "#bbbbbb",
            wordWrap: { width: 400 }
          })
          .setOrigin(0, 0.5);
  
        // 해금/강화 버튼
        let buttonLabel = "";
        if (isLocked && level === 0) {
          buttonLabel = ""; // 잠김 상태
        } else if (level === 0) {
          buttonLabel = "해금 (SP 1)";
        } else if (def.key !== "doubleJump" && level < def.maxLevel) {
          buttonLabel = "강화 (SP 1)";
        }
  
        let levelUpPreview = "";
        if (def.key === "doubleJump") {
          levelUpPreview =
            level === 0 ? "해금 시: 더블점프 가능" : "최대 레벨입니다.";
        } else {
          const perLevel = 5;
          levelUpPreview =
            level < def.maxLevel
              ? `다음 레벨: 공격력 추가 +${perLevel}%`
              : "최대 레벨입니다.";
        }
  
        const previewText = this.add
          .text(width / 2 + 80, y, levelUpPreview, {
            fontSize: "14px",
            color: "#cccccc",
          })
          .setOrigin(0, 0.5);
  
        let btn = null;
        if (buttonLabel) {
          btn = this.add
            .text(width / 2 + 80, y + 26, buttonLabel, {
              fontSize: "16px",
              color: "#ffffff",
              backgroundColor: "#512da8",
              padding: { x: 10, y: 4 },
            })
            .setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true });
  
          btn.on("pointerup", () => {
            if (gameData.skillPoints > 0) {
              if (def.key === "doubleJump" && level >= def.maxLevel) return;
              if (def.key !== "doubleJump" && level >= def.maxLevel) return;

              gameData.skillPoints -= 1;
              gameData.skills[def.key] = (gameData.skills[def.key] || 0) + 1;
              if (window.saveGameData) window.saveGameData();
              const newLevel = gameData.skills[def.key];

              levelText.setText(`${def.label}  ${newLevel}/${def.maxLevel}`);

              if (def.key === "doubleJump") {
                previewText.setText("최대 레벨입니다.");
                btn.destroy();
              } else {
                if (newLevel >= def.maxLevel) {
                  previewText.setText("최대 레벨입니다.");
                  btn.destroy();
                } else {
                  previewText.setText("다음 레벨: 공격력 추가 +5%");
                }
              }
              
              // 재화 즉시 반영
              if (this.updateStatsText) this.updateStatsText();
            }
          });
        }
  
        uiItems.push(levelText, descText, previewText);
        if (btn) uiItems.push(btn);
  
        // 더블점프를 제외한 스킬 키 설정
        if (def.key !== "doubleJump" && !isLocked) {
          const currentKey =
            (gameData.skillKeys && gameData.skillKeys[def.key]) || "S";
          const keyLabel = this.add
            .text(width / 2 - 260, y + 50, `단축키: ${currentKey} (클릭하여 S/D/F 변경)`, {
              fontSize: "14px",
              color: "#ffffff",
              backgroundColor: "#37474f",
              padding: { x: 8, y: 4 },
            })
            .setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true });
  
          keyLabel.on("pointerup", () => {
            const keys = ["S", "D", "F"];
            const currentIndex = keys.indexOf(
              (gameData.skillKeys && gameData.skillKeys[def.key]) || "S"
            );
            const nextIndex = (currentIndex + 1) % keys.length;
            const nextKey = keys[nextIndex];
            gameData.skillKeys[def.key] = nextKey;
            if (window.saveGameData) window.saveGameData();
            keyLabel.setText(`단축키: ${nextKey} (클릭하여 S/D/F 변경)`);
          });
  
          uiItems.push(keyLabel);
        }
      });
  
      const closeText = this.add
        .text(width / 2, height / 2 + 160, "닫기 (ESC)", {
          fontSize: "16px",
          color: "#cccccc",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
  
      const close = () => {
        overlay.destroy();
        box.destroy();
        title.destroy();
        closeText.destroy();
        uiItems.forEach((it) => it.destroy());
        this.scene.restart();
      };
  
      closeText.on("pointerup", close);
      this.input.keyboard.once("keydown-ESC", close);
    }

    openDailyDungeonPopup() {
      const { width, height } = this.scale;
      const gameData = window.GameData;
      if (!gameData) return;

      const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
      const box = this.add.rectangle(width / 2, height / 2, 500, 300, 0x263238, 0.95);
      box.setStrokeStyle(2, 0xffffff);

      const title = this.add
        .text(width / 2, height / 2 - 100, "일일 던전", {
          fontSize: "24px",
          color: "#ffffff",
        })
        .setOrigin(0.5);

      // 한국 시간 기준 오늘 날짜 확인 (00:00 초기화)
      const now = new Date();
      const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      const today = koreaTime.toISOString().split("T")[0]; // "YYYY-MM-DD"
      
      const lastExpDate = gameData.dailyDungeon?.lastExpDungeonDate;
      const lastGoldDate = gameData.dailyDungeon?.lastGoldDungeonDate;
      const canPlayExp = lastExpDate !== today;
      const canPlayGold = lastGoldDate !== today;

      const expDungeonLevel = gameData.dailyDungeon?.expDungeonLevel || 1;
      
      // 도전 가능 횟수 (일일 1회 + 입장권 개수)
      const expDungeonTickets = (canPlayExp ? 1 : 0) + (gameData.dailyDungeon?.expDungeonTickets || 0);
      const goldDungeonTickets = (canPlayGold ? 1 : 0) + (gameData.dailyDungeon?.goldDungeonTickets || 0);

      // closeText를 먼저 선언 (다른 곳에서 참조하기 전에)
      const closeText = this.add
        .text(width / 2, height / 2 + 100, "닫기 (ESC)", {
          fontSize: "16px",
          color: "#cccccc",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      // 경험치 던전 버튼
      const expDungeonBtn = this.add
        .text(width / 2, height / 2 - 20, `경험치 던전 (레벨 ${expDungeonLevel}) 🔑 ${expDungeonTickets}`, {
          fontSize: "18px",
          color: "#ffffff",
          backgroundColor: expDungeonTickets > 0 ? "#2e7d32" : "#666666",
          padding: { x: 15, y: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: expDungeonTickets > 0 });

      if (expDungeonTickets > 0) {
        expDungeonBtn.on("pointerup", () => {
          overlay.destroy();
          box.destroy();
          title.destroy();
          expDungeonBtn.destroy();
          goldDungeonBtn.destroy();
          closeText.destroy();
          if (infoText) infoText.destroy();
          
          // 입장권 사용 또는 일일 제한 적용
          gameData.dailyDungeon = gameData.dailyDungeon || {};
          if (canPlayExp) {
            // 일일 제한 사용
            gameData.dailyDungeon.lastExpDungeonDate = today;
          } else {
            // 입장권 사용
            gameData.dailyDungeon.expDungeonTickets = Math.max(0, (gameData.dailyDungeon.expDungeonTickets || 0) - 1);
          }
          if (window.saveGameData) window.saveGameData();
          
          this.scene.start("DailyDungeonScene", { level: expDungeonLevel });
        });
      }

      // 골드 던전 버튼
      const goldDungeonBtn = this.add
        .text(width / 2, height / 2 + 40, `골드 던전 🔑 ${goldDungeonTickets}`, {
          fontSize: "18px",
          color: "#ffffff",
          backgroundColor: goldDungeonTickets > 0 ? "#f57c00" : "#666666",
          padding: { x: 15, y: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: goldDungeonTickets > 0 });

      let infoText = null;
      if (goldDungeonTickets > 0) {
        goldDungeonBtn.on("pointerup", () => {
          overlay.destroy();
          box.destroy();
          title.destroy();
          expDungeonBtn.destroy();
          goldDungeonBtn.destroy();
          closeText.destroy();
          if (infoText) infoText.destroy();
          
          // 입장권 사용 또는 일일 제한 적용
          gameData.dailyDungeon = gameData.dailyDungeon || {};
          if (canPlayGold) {
            // 일일 제한 사용
            gameData.dailyDungeon.lastGoldDungeonDate = today;
          } else {
            // 입장권 사용
            gameData.dailyDungeon.goldDungeonTickets = Math.max(0, (gameData.dailyDungeon.goldDungeonTickets || 0) - 1);
          }
          if (window.saveGameData) window.saveGameData();
          
          this.scene.start("GoldDungeonScene");
        });
      }
      
      // 정보 텍스트
      if (!canPlayExp && !canPlayGold) {
        infoText = this.add
          .text(width / 2, height / 2 + 70, "오늘 이미 모든 던전을 플레이했습니다.", {
            fontSize: "14px",
            color: "#ff9800",
          })
          .setOrigin(0.5);
        closeText.y = height / 2 + 110;
      } else if (!canPlayExp) {
        infoText = this.add
          .text(width / 2, height / 2 + 70, "경험치 던전은 오늘 이미 플레이했습니다.", {
            fontSize: "14px",
            color: "#ff9800",
          })
          .setOrigin(0.5);
        closeText.y = height / 2 + 110;
      } else if (!canPlayGold) {
        infoText = this.add
          .text(width / 2, height / 2 + 70, "골드 던전은 오늘 이미 플레이했습니다.", {
            fontSize: "14px",
            color: "#ff9800",
          })
          .setOrigin(0.5);
        closeText.y = height / 2 + 110;
      }

      const close = () => {
        overlay.destroy();
        box.destroy();
        title.destroy();
        expDungeonBtn.destroy();
        goldDungeonBtn.destroy();
        closeText.destroy();
        if (infoText) infoText.destroy();
      };

      closeText.on("pointerup", close);
      this.input.keyboard.once("keydown-ESC", close);
    }
  }
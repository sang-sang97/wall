const WALL_CONFIG = {
  count: 5,
  hpByIndex: [80, 90, 100, 110, 120],
};

const WALL_X_POSITIONS = [930, 930, 930, 930, 930];

const CAMERA_CENTER_LIMITS = [0, 1425, 1890, 2355, 2820];
const CAMERA_SCROLL_LIMITS = CAMERA_CENTER_LIMITS.map((center, index) => {
  if (index === 0) return 0;
  return center - 480;
});

const BUFF_POOL = [
  {
    id: "ATK_UP_SMALL",
    name: "공격력 +20%",
    desc: "기본 공격력이 20% 증가합니다.",
    apply: (stats) => {
      stats.attackBonus += 20;
    },
  },
  {
    id: "ATK_UP_LARGE",
    name: "공격력 +40%",
    desc: "기본 공격력이 40% 증가합니다.",
    apply: (stats) => {
      stats.attackBonus += 40;
    },
  },
  {
    id: "AS_UP",
    name: "공격 속도 +20%",
    desc: "공격 쿨타임이 20% 감소합니다.",
    apply: (stats) => {
      stats.attackSpeedBonus += 20;
    },
  },
  {
    id: "CRIT_CHANCE",
    name: "치명타 확률 +15%",
    desc: "치명타 확률이 15% 증가합니다.",
    apply: (stats) => {
      stats.critChanceBonus += 15;
    },
  },
  {
    id: "CRIT_DAMAGE",
    name: "치명타 피해 +50%",
    desc: "치명타 피해 배율이 50% 증가합니다.",
    apply: (stats) => {
      stats.critDamageBonus += 50;
    },
  },
];

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
    this.gameState = "INTRO";
  }

  init(data) {
    this.stageLevel = data.stageLevel || 1;
  }

  create() {
    const { width, height } = this.scale;

    // 배경 이미지 추가 (가장 뒤쪽 레이어)
    // 이미지가 로드되었는지 확인 후 스케일 계산
    if (this.textures.exists("stage_background")) {
      this.background = this.add.image(width / 2, height / 2, "stage_background");
      this.background.setOrigin(0.5, 0.5);
      
      // 배경이 화면 크기에 맞게 스케일 조정 (cover 방식 - 화면을 완전히 채움)
      const bgWidth = this.background.width;
      const bgHeight = this.background.height;
      
      if (bgWidth > 0 && bgHeight > 0) {
        const bgScaleX = width / bgWidth;
        const bgScaleY = height / bgHeight;
        const bgScale = Math.max(bgScaleX, bgScaleY); // 화면을 완전히 채우도록
        this.background.setScale(bgScale);
      }
      
      // 배경이 카메라 스크롤과 함께 움직이지 않도록 설정
      this.background.setScrollFactor(0, 0);
      // 배경을 가장 뒤로 보내기
      this.background.setDepth(-1000);
    } else {
      console.warn("배경 이미지가 로드되지 않았습니다.");
    }

    this.gameState = "INTRO";
    this.timeLimit = 60;
    this.elapsedTime = 0;
    this.currentWallIndex = 0;
    this.selectedBuffs = [];

    const gameData = window.GameData || null;

    const baseAttack = 10 + ((gameData && gameData.upgrades.attack) || 0);
    this.playerStats = {
      moveSpeed: 240,
      jumpPower: 350,
      baseAttack,
      baseCooldown: 0.4,
      attackBonus: 0,
      attackSpeedBonus: (gameData && gameData.upgrades.attackSpeed) || 0,
      critChanceBonus: (gameData && gameData.upgrades.critChance) || 0,
      critDamageBonus: (gameData && gameData.upgrades.critDamage) || 0,
    };

    // 스킬 레벨에 따른 공격력 보너스 추가
    const skills = (gameData && gameData.skills) || {};
    const doubleAttackLevel = skills.doubleAttack || 0;
    const tripleAttackLevel = skills.tripleAttack || 0;
    this.playerStats.attackBonus += doubleAttackLevel * 5;
    this.playerStats.attackBonus += tripleAttackLevel * 5;

    this.facing = 1;
    this.jumpCount = 0;
    this.isDashing = false;

    const groundHeight = 40;
    const ground = this.add.rectangle(
      1300,
      height - groundHeight / 2,
      2600,
      groundHeight,
      0x333333
    );
    this.physics.add.existing(ground, true);

    this.player = this.add.rectangle(
      100,
      height - groundHeight - 60,
      40,
      80,
      0x5c6bc0
    );
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body;
    this.playerBody.setCollideWorldBounds(true);
    this.playerBody.setBounce(0.0);

    this.physics.add.collider(this.player, ground);

    this.handOffsetX = 28;
    this.handOffsetY = -20;
    this.hand = this.add.rectangle(
      this.player.x + this.handOffsetX,
      this.player.y + this.handOffsetY,
      16,
      16,
      0xffeb3b
    );

    this.walls = [];
    this.currentWall = null;
    this.wallGraphicsGroup = this.add.group();

    for (let i = 0; i < WALL_CONFIG.count; i += 1) {
      const wallX = WALL_X_POSITIONS[i];
      const wallY = height - groundHeight - 100;
      const maxHp = WALL_CONFIG.hpByIndex[i];

      const wallRect = this.add.rectangle(wallX, wallY, 60, 200, 0x888888);
      this.physics.add.existing(wallRect, true);
      if (i > 0) {
        wallRect.visible = false;
      }

      const wallData = {
        index: i,
        maxHp,
        hp: maxHp,
        sprite: wallRect,
        state: "alive",
      };
      this.walls.push(wallData);
    }

    this.currentWall = this.walls[this.currentWallIndex];

    const worldWidth =
      WALL_X_POSITIONS[WALL_X_POSITIONS.length - 1] + width * 0.5;
    this.physics.world.setBounds(0, 0, worldWidth, height);
    this.cameras.main.setBounds(0, 0, worldWidth, height);
    this.cameras.main.scrollX = 0;
    this.cameras.main.scrollY = 0;
    this.cameraMaxScroll = CAMERA_SCROLL_LIMITS[0] || 0;

    this.updateMovementBounds();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    
    // 스킬 키 설정
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);

    this.timeText = this.add
      .text(width / 2, 20, "TIME: 60.0", {
        fontSize: "20px",
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0);

    this.wallText = this.add
      .text(20, 20, "WALL: 1 / 5", {
        fontSize: "20px",
        color: "#ffffff",
      })
      .setScrollFactor(0);

    this.wallHpBarBg = this.add
      .rectangle(width / 2, 64, 320, 14, 0x222222)
      .setScrollFactor(0)
      .setOrigin(0.5, 0);
    this.wallHpBar = this.add
      .rectangle(width / 2 - 160, 64, 320, 14, 0x4caf50)
      .setScrollFactor(0)
      .setOrigin(0, 0);
    this.wallHpPercentText = this.add
      .text(width / 2, 64 + 16, "", {
        fontSize: "14px",
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0);
    this.wallHpBarBg.setVisible(false);
    this.wallHpBar.setVisible(false);
    this.wallHpPercentText.setVisible(false);

    this.statsText = this.add
      .text(20, 50, "", {
        fontSize: "16px",
        color: "#ffffff",
      })
      .setScrollFactor(0);
    this.refreshStatsUI();

    this.settingsButton = this.add
      .rectangle(width - 30, 52, 40, 26, 0x263238)
      .setScrollFactor(0)
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(width - 30 - 20, 52 + 4, "=", {
        fontSize: "20px",
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0);

    this.settingsButton.on("pointerup", () => {
      this.openSettingsMenu();
    });

    this.gameState = "PLAY";
    this.lastAttackTime = 0;
  }

  update(time, delta) {
    if (this.gameState === "PLAY") {
      this.updateTimer(delta);
      this.handleMovement();
      this.handleAttack(time);
    }

    this.updateHandPosition();

    const cam = this.cameras.main;
    if (cam.scrollX < 0) cam.scrollX = 0;
    if (cam.scrollX > this.cameraMaxScroll) cam.scrollX = this.cameraMaxScroll;
  }

  updateTimer(delta) {
    this.elapsedTime += delta / 1000;
    const remaining = Math.max(this.timeLimit - this.elapsedTime, 0);
    this.timeText.setText(`TIME: ${remaining.toFixed(1)}`);

    if (remaining <= 0) {
      if (this.currentWallIndex < WALL_CONFIG.count) {
        this.goToResult(false);
      }
    }
  }

  handleMovement() {
    const body = this.playerBody;
    const cursors = this.cursors;

    let vx = body.velocity.x;
    if (!this.isDashing) {
      vx = 0;
      if (cursors.left.isDown) {
        vx = -this.playerStats.moveSpeed;
        this.facing = -1;
      } else if (cursors.right.isDown) {
        vx = this.playerStats.moveSpeed;
        this.facing = 1;
      }
      body.setVelocityX(vx);
    }

    const canDoubleJump =
      window.GameData &&
      window.GameData.skills &&
      window.GameData.skills.doubleJump > 0;

    if (body.blocked.down) {
      this.jumpCount = 0;
      this.isDashing = false;
    }

    if (Phaser.Input.Keyboard.JustDown(cursors.space)) {
      if (body.blocked.down) {
        body.setVelocityY(-this.playerStats.jumpPower);
        this.jumpCount = 1;
      } else if (canDoubleJump && this.jumpCount < 2) {
        this.jumpCount += 1;
        // 땅에 닿을 때까지 대시 유지
        this.isDashing = true;
        body.setVelocityY(-this.playerStats.jumpPower * 0.8);
        body.setVelocityX(this.facing * this.playerStats.moveSpeed * 2.5);
      }
    }

    const bounds = this.currentMovementBounds;
    if (this.player.x < bounds.minX) {
      this.player.x = bounds.minX;
      body.setVelocityX(0);
    }
    if (this.player.x > bounds.maxX) {
      this.player.x = bounds.maxX;
      body.setVelocityX(0);
    }
  }

  handleAttack(time) {
    if (!this.currentWall || this.currentWall.state !== "alive") return;

    const gameData = window.GameData;
    const skills = (gameData && gameData.skills) || {};
    const skillKeys = (gameData && gameData.skillKeys) || {};

    // 어떤 키가 눌렸는지 확인
    let attackType = null;
    
    if (this.keyA.isDown) {
      attackType = "basic";
    } else if (skills.tripleAttack > 0 && this.keyMatchesSkill("tripleAttack", skillKeys)) {
      attackType = "triple";
    } else if (skills.doubleAttack > 0 && this.keyMatchesSkill("doubleAttack", skillKeys)) {
      attackType = "double";
    }

    if (!attackType) return;

    const effectiveCooldown =
      this.playerStats.baseCooldown /
      (1 + this.playerStats.attackSpeedBonus / 100);
    const elapsedSinceLast = (time - this.lastAttackTime) / 1000;
    if (elapsedSinceLast < effectiveCooldown) return;

    const distance = Math.abs(this.currentWall.sprite.x - this.player.x);
    const attackRange = 80;

    if (distance <= attackRange) {
      this.lastAttackTime = time;
      this.performComboAttack(attackType);
    }
  }

  keyMatchesSkill(skillKey, skillKeys) {
    const assignedKey = skillKeys[skillKey] || "S";
    if (assignedKey === "S" && this.keyS.isDown) return true;
    if (assignedKey === "D" && this.keyD.isDown) return true;
    if (assignedKey === "F" && this.keyF.isDown) return true;
    return false;
  }

  performComboAttack(attackType) {
    let hits = 1;
    if (attackType === "double") hits = 2;
    if (attackType === "triple") hits = 3;

    for (let i = 0; i < hits; i += 1) {
      this.time.addEvent({
        delay: i * 120,
        callback: () => {
          this.performHit();
        },
      });
    }
  }

  performHit() {
    if (this.gameState !== "PLAY") return;
    if (!this.currentWall || this.currentWall.state !== "alive") return;

    const attackMultiplier = 1 + this.playerStats.attackBonus / 100;
    let damage = this.playerStats.baseAttack * attackMultiplier;

    const critChance = this.playerStats.critChanceBonus / 100;
    const isCrit = Math.random() < critChance;
    if (isCrit) {
      const critMult = 1 + this.playerStats.critDamageBonus / 100;
      damage *= critMult;
    }

    this.currentWall.hp -= damage;
    this.currentWall.hp = Math.max(this.currentWall.hp, 0);

    if (!window.GameData || window.GameData.screenShake) {
      this.cameras.main.shake(80, 0.005);
    }

    this.spawnDebris(this.currentWall.sprite.x, this.currentWall.sprite.y);
    this.showDamageText(
      this.currentWall.sprite.x,
      this.currentWall.sprite.y - 80,
      Math.round(damage)
    );

    this.updateWallVisual(this.currentWall);
    this.updateWallHpBar();

    if (this.currentWall.hp <= 0) {
      this.onWallDestroyed();
    }
  }

  spawnDebris(x, y) {
    for (let i = 0; i < 6; i += 1) {
      const size = Phaser.Math.Between(4, 8);
      const rect = this.add.rectangle(x, y, size, size, 0xb0bec5);
      this.physics.add.existing(rect);
      const body = rect.body;
      body.setVelocity(
        Phaser.Math.Between(-150, 150),
        Phaser.Math.Between(-300, -100)
      );
      body.setGravityY(800);
      body.setBounce(0.4);

      this.time.addEvent({
        delay: 500,
        callback: () => {
          rect.destroy();
        },
      });
    }
  }

  updateWallVisual(wall) {
    const ratio = wall.hp / wall.maxHp;
    let color = 0x888888;
    if (ratio <= 0) {
      color = 0xffffff;
    } else if (ratio <= 0.1) {
      color = 0xff6f00;
    } else if (ratio <= 0.4) {
      color = 0xffa000;
    } else if (ratio <= 0.7) {
      color = 0xffd54f;
    }
    wall.sprite.fillColor = color;
  }

  onWallDestroyed() {
    const wall = this.currentWall;
    wall.state = "destroyed";

    if (!window.GameData || window.GameData.screenShake) {
      this.cameras.main.shake(150, 0.01);
    }

    wall.sprite.visible = false;

    const destroyedCount = this.currentWallIndex + 1;

    if (destroyedCount >= WALL_CONFIG.count) {
      this.goToResult(true);
      return;
    }

    // 버프 선택 UI 표시 전에 일시정지
    this.gameState = "CHOICE";
    
    // 플레이어 물리 상태 저장 및 정지
    this.savedVelocity = {
      x: this.playerBody.velocity.x,
      y: this.playerBody.velocity.y
    };
    this.playerBody.setVelocity(0, 0);
    
    this.showBuffChoiceUI();
  }

  showBuffChoiceUI() {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(
      this.cameras.main.worldView.x + width / 2,
      this.cameras.main.worldView.y + height / 2,
      width,
      height,
      0x000000,
      0.6
    );

    const shuffled = Phaser.Utils.Array.Shuffle(BUFF_POOL.slice());
    const options = shuffled.slice(0, 3);

    const optionTexts = [];
    const optionBoxes = [];
    const baseX = this.cameras.main.worldView.x + width / 2;
    const baseY = this.cameras.main.worldView.y + height / 2;
    const spacing = 200;

    options.forEach((buff, i) => {
      const x = baseX + (i - 1) * spacing;
      const y = baseY;

      const box = this.add.rectangle(x, y, 180, 130, 0x263238, 0.9);
      box.setStrokeStyle(2, 0xffffff);

      const text = this.add
        .text(x, y, `${buff.name}\n\n${buff.desc}`, {
          fontSize: "16px",
          color: "#ffffff",
          align: "center",
          wordWrap: { width: 160 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      text.on("pointerup", () => {
        buff.apply(this.playerStats);
        this.selectedBuffs.push(buff.id);
        this.refreshStatsUI();

        overlay.destroy();
        optionBoxes.forEach((b) => b.destroy());
        optionTexts.forEach((t) => t.destroy());

        this.currentWallIndex += 1;
        this.currentWall = this.walls[this.currentWallIndex];
        if (this.currentWall && this.currentWall.sprite) {
          this.currentWall.sprite.visible = true;
        }
        this.wallText.setText(
          `WALL: ${this.currentWallIndex + 1} / ${WALL_CONFIG.count}`
        );

        this.updateMovementBounds();

        // 게임 재개
        this.gameState = "PLAY";
      });

      optionTexts.push(text);
      optionBoxes.push(box);
    });
  }

  updateMovementBounds() {
    const currentWallX = this.walls[this.currentWallIndex].sprite.x;
    const minX = 50;
    const maxX = currentWallX - 40;
    this.currentMovementBounds = { minX, maxX };
  }

  goToResult(isClear) {
    this.gameState = "RESULT";

    const clearedWalls = this.currentWallIndex + (isClear ? 1 : 0);
    const timeUsed = Math.min(this.elapsedTime, this.timeLimit);

    const rewardExp = isClear ? 50 * this.stageLevel : 10 * this.stageLevel;
    const rewardGold = isClear ? 30 * this.stageLevel : 5 * this.stageLevel;

    this.scene.start("ResultScene", {
      isClear,
      timeUsed,
      rewardExp,
      rewardGold,
      stageLevel: this.stageLevel,
    });
  }

  updateWallHpBar() {
    if (!this.currentWall || !this.wallHpBar || !this.wallHpBarBg) return;

    const ratio =
      this.currentWall.maxHp > 0
        ? this.currentWall.hp / this.currentWall.maxHp
        : 0;
    const clamped = Phaser.Math.Clamp(ratio, 0, 1);
    const fullWidth = 320;

    this.wallHpBarBg.setVisible(true);
    this.wallHpBar.setVisible(true);
    this.wallHpPercentText.setVisible(true);
    this.wallHpBar.width = fullWidth * clamped;

    let color = 0x4caf50;
    if (clamped <= 0.1) {
      color = 0xff5252;
    } else if (clamped <= 0.4) {
      color = 0xffa000;
    } else if (clamped <= 0.7) {
      color = 0xffd54f;
    }
    this.wallHpBar.fillColor = color;
    const percentText = `${Math.round(clamped * 100)}%`;
    this.wallHpPercentText.setText(percentText);
  }

  refreshStatsUI() {
    if (!this.statsText) return;

    const lines = [
      `공격력: ${this.playerStats.attackBonus.toFixed(0)}%`,
      `공격속도: ${this.playerStats.attackSpeedBonus.toFixed(0)}%`,
      `치명타 확률: ${this.playerStats.critChanceBonus.toFixed(0)}%`,
      `치명타 피해: ${this.playerStats.critDamageBonus.toFixed(0)}%`,
    ];

    this.statsText.setText(lines.join("  "));
  }

  openSettingsMenu() {
    if (this.gameState !== "PLAY") return;

    this.gameState = "PAUSE";

    const { width, height } = this.scale;
    const viewX = this.cameras.main.worldView.x;
    const viewY = this.cameras.main.worldView.y;

    const overlay = this.add.rectangle(
      viewX + width / 2,
      viewY + height / 2,
      width,
      height,
      0x000000,
      0.6
    );

    const box = this.add.rectangle(
      viewX + width / 2,
      viewY + height / 2,
      380,
      280,
      0x263238,
      0.95
    );
    box.setStrokeStyle(2, 0xffffff);

    const title = this.add
      .text(viewX + width / 2, viewY + height / 2 - 80, "설정", {
        fontSize: "22px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const gameData = window.GameData || {
      sound: true,
      screenShake: true,
    };

    const makeToggleLabel = (key, label, yOffset) => {
      const value = gameData[key];
      const txt = this.add
        .text(
          viewX + width / 2,
          viewY + height / 2 + yOffset,
          `${label}: ${value ? "ON" : "OFF"}`,
          {
            fontSize: "18px",
            color: "#ffffff",
            backgroundColor: "#37474f",
            padding: { x: 12, y: 6 },
          }
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      txt.on("pointerup", () => {
        gameData[key] = !gameData[key];
        txt.setText(`${label}: ${gameData[key] ? "ON" : "OFF"}`);
        window.GameData = gameData;
        if (window.saveGameData) {
          window.saveGameData();
        }
      });

      return txt;
    };

    const soundText = makeToggleLabel("sound", "사운드", -40);
    const shakeText = makeToggleLabel("screenShake", "화면 흔들림", 0);

    const restartText = this.add
      .text(viewX + width / 2, viewY + height / 2 + 100, "재시작", {
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#388e3c",
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const resumeText = this.add
      .text(viewX + width / 2, viewY + height / 2 + 60, "게임으로 돌아가기", {
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#1976d2",
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const homeText = this.add
      .text(viewX + width / 2, viewY + height / 2 + 140, "홈으로 돌아가기", {
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#ef5350",
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const closeMenu = () => {
      overlay.destroy();
      box.destroy();
      title.destroy();
      soundText.destroy();
      shakeText.destroy();
      resumeText.destroy();
      restartText.destroy();
      homeText.destroy();
      this.gameState = "PLAY";
    };

    resumeText.on("pointerup", () => {
      closeMenu();
    });

    restartText.on("pointerup", () => {
      if (window.saveGameData) {
        window.saveGameData();
      }
      this.scene.restart({ stageLevel: this.stageLevel });
    });

    homeText.on("pointerup", () => {
      if (window.saveGameData) {
        window.saveGameData();
      }
      this.scene.start("MenuScene");
    });

    overlay.setInteractive();
  }

  updateHandPosition() {
    if (!this.hand) return;
    const offsetX = this.handOffsetX * this.facing;
    this.hand.x = this.player.x + offsetX;
    this.hand.y = this.player.y + this.handOffsetY;
  }

  showDamageText(x, y, damage) {
    const txt = this.add
      .text(x, y, `${damage}`, {
        fontSize: "20px",
        color: "#ffeb3b",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: txt,
      y: y - 40,
      alpha: 0,
      duration: 800,
      ease: "Quad.easeOut",
      onComplete: () => {
        txt.destroy();
      },
    });
  }
}
class DailyDungeonScene extends Phaser.Scene {
  constructor() {
    super({ key: "DailyDungeonScene" });
  }

  init(data) {
    this.dungeonLevel = data.level || 1;
  }

  create() {
    const { width, height } = this.scale;

    // 배경 이미지
    if (this.textures.exists("stage_background")) {
      this.background = this.add.image(width / 2, height / 2, "stage_background");
      this.background.setOrigin(0.5, 0.5);
      const bgTexture = this.textures.get("stage_background");
      const bgWidth = bgTexture.source[0].width;
      const bgHeight = bgTexture.source[0].height;
      if (bgWidth > 0 && bgHeight > 0) {
        const bgScaleX = width / bgWidth;
        const bgScaleY = height / bgHeight;
        const bgScale = Math.max(bgScaleX, bgScaleY);
        this.background.setScale(bgScale);
      }
      this.background.setScrollFactor(0, 0);
      this.background.setDepth(-1000);
    }

    // 땅
    let groundHeight = 40;
    let ground;
    if (this.textures.exists("ground")) {
      const groundTexture = this.textures.get("ground");
      const actualGroundHeight = groundTexture.source[0].height;
      groundHeight = actualGroundHeight;
      const groundWidth = 2600;
      ground = this.add.tileSprite(1300, height - groundHeight / 2, groundWidth, groundHeight, "ground");
      ground.setOrigin(0.5, 0.5);
      ground.setDepth(-500);
      this.physics.add.existing(ground, true);
    } else {
      ground = this.add.rectangle(1300, height - groundHeight / 2, 2600, groundHeight, 0x333333);
      this.physics.add.existing(ground, true);
    }

    // 플레이어
    const gameData = window.GameData || null;
    const baseAttack = 10 + ((gameData && gameData.upgrades.attack) || 0);
    this.playerStats = {
      moveSpeed: 240,
      jumpPower: 350,
      baseAttack,
      baseCooldown: 0.4,
      attackBonus: 0,
      attackSpeedBonus: 0,
      critChanceBonus: 0,
      critDamageBonus: 0,
    };

    this.facing = 1;
    this.jumpCount = 0;
    this.isDashing = false;

    if (this.textures.exists("player_idle")) {
      this.player = this.add.sprite(100, height - groundHeight, "player_idle");
      this.player.setOrigin(0.5, 1);
      const targetHeight = 150;
      const currentHeight = this.player.height;
      if (currentHeight > targetHeight) {
        const scale = targetHeight / currentHeight;
        this.player.setScale(scale);
      }
    } else {
      this.player = this.add.rectangle(100, height - groundHeight, 40, 80, 0x5c6bc0);
    }

    this.physics.add.existing(this.player);
    this.playerBody = this.player.body;
    if (this.textures.exists("player_idle")) {
      const displayWidth = this.player.displayWidth || this.player.width;
      const displayHeight = this.player.displayHeight || this.player.height;
      this.playerBody.setSize(displayWidth * 0.8, displayHeight * 0.8);
      this.playerBody.setOffset(
        (displayWidth - this.playerBody.width) / 2,
        displayHeight - this.playerBody.height + 550
      );
    } else {
      this.playerBody.setSize(40, 80);
    }
    this.playerBody.setCollideWorldBounds(true);
    this.playerBody.setBounce(0.0);
    this.playerBody.setGravityY(800);
    this.physics.add.collider(this.player, ground);

    // 벽 생성 (30개, 중간부터 오른쪽으로)
    this.walls = [];
    this.currentWallIndex = 0;
    this.destroyedWalls = 0;
    this.timeLimit = 30; // 30초
    this.elapsedTime = 0;

    // 1번째 벽을 화면 중앙에 배치
    const firstWallX = width / 2;
    const wallSpacing = 100; // 벽 간격

    for (let i = 0; i < 30; i += 1) {
      const wallX = firstWallX + i * wallSpacing;
      const wallY = height - groundHeight + 10;
      
      // 벽 HP 설정
      let wallHp;
      let wallImageKey;
      if (i < 10) {
        wallHp = 100;
        wallImageKey = "wall_1";
      } else if (i < 20) {
        wallHp = 500;
        wallImageKey = "wall_2";
      } else {
        wallHp = 1000;
        wallImageKey = "wall_3";
      }

      let wallSprite;
      if (this.textures.exists(wallImageKey)) {
        wallSprite = this.add.sprite(wallX, wallY, wallImageKey);
        wallSprite.setOrigin(0.5, 1);
        const targetHeight = 400;
        const currentHeight = wallSprite.height;
        if (currentHeight > targetHeight) {
          const scale = targetHeight / currentHeight;
          wallSprite.setScale(scale);
        }
      } else {
        wallSprite = this.add.rectangle(wallX, wallY, 60, 200, 0x888888);
      }

      this.physics.add.existing(wallSprite, true);
      // 모든 벽을 처음부터 보이게 설정
      wallSprite.visible = true;

      const wallData = {
        index: i,
        maxHp: wallHp,
        hp: wallHp,
        sprite: wallSprite,
        state: "alive",
      };
      this.walls.push(wallData);
    }

    this.currentWall = this.walls[0];
    this.cameraMaxScroll = 0; // 카메라 최대 스크롤

    // 카메라 설정
    const worldWidth = firstWallX + 30 * wallSpacing + width * 0.5;
    this.physics.world.setBounds(0, 0, worldWidth, height);
    this.cameras.main.setBounds(0, 0, worldWidth, height);
    this.cameras.main.scrollX = 0;

    // 입력
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);

    // UI
    this.timeText = this.add
      .text(width / 2, 20, "TIME: 30.0", {
        fontSize: "20px",
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0);

    this.wallText = this.add
      .text(20, 20, "벽: 0 / 30", {
        fontSize: "20px",
        color: "#ffffff",
      })
      .setScrollFactor(0);

    this.gameState = "PLAY";
    this.lastAttackTime = 0;

    // 모바일 감지 및 컨트롤 추가
    this.isMobile = this.sys.game.device.input.touch || window.innerWidth <= 768;
    this.joystick = null;
    this.mobileButtons = {};

    if (this.isMobile) {
      this.createMobileControls();
    }
  }

  createMobileControls() {
    const { width, height } = this.scale;

    // 조이스틱 (왼쪽 하단)
    const joystickRadius = 60;
    const joystickX = 80;
    const joystickY = height - 80;

    const joystickBg = this.add.circle(joystickX, joystickY, joystickRadius, 0x333333, 0.7);
    joystickBg.setScrollFactor(0);
    joystickBg.setDepth(1000);
    joystickBg.setInteractive();

    const joystickHandle = this.add.circle(joystickX, joystickY, 30, 0x666666, 0.9);
    joystickHandle.setScrollFactor(0);
    joystickHandle.setDepth(1001);

    this.joystick = {
      bg: joystickBg,
      handle: joystickHandle,
      centerX: joystickX,
      centerY: joystickY,
      radius: joystickRadius - 30,
      isActive: false,
      direction: 0,
    };

    joystickBg.on("pointerdown", (pointer) => {
      this.joystick.isActive = true;
      this.updateJoystick(pointer);
    });

    this.input.on("pointermove", (pointer) => {
      if (this.joystick && this.joystick.isActive) {
        this.updateJoystick(pointer);
      }
    });

    this.input.on("pointerup", () => {
      if (this.joystick) {
        this.joystick.isActive = false;
        this.joystick.handle.x = this.joystick.centerX;
        this.joystick.handle.y = this.joystick.centerY;
        this.joystick.direction = 0;
      }
    });

    // 버튼들 (오른쪽)
    const buttonY = height - 80;
    const buttonSpacing = 70;
    const startX = width - 100;

    const jumpBtn = this.add.circle(startX, buttonY - 40, 35, 0x4caf50, 0.8);
    jumpBtn.setScrollFactor(0);
    jumpBtn.setDepth(1000);
    jumpBtn.setInteractive({ useHandCursor: true });
    this.add.text(startX, buttonY - 40, "↑", {
      fontSize: "24px",
      color: "#ffffff",
    }).setScrollFactor(0).setDepth(1001).setOrigin(0.5);

    jumpBtn.on("pointerdown", () => {
      this.mobileButtons.jump = true;
    });
    jumpBtn.on("pointerup", () => {
      this.mobileButtons.jump = false;
    });

    const attackBtn = this.add.circle(startX, buttonY + 40, 35, 0xe53935, 0.8);
    attackBtn.setScrollFactor(0);
    attackBtn.setDepth(1000);
    attackBtn.setInteractive({ useHandCursor: true });
    this.add.text(startX, buttonY + 40, "A", {
      fontSize: "20px",
      color: "#ffffff",
      fontWeight: "bold",
    }).setScrollFactor(0).setDepth(1001).setOrigin(0.5);

    attackBtn.on("pointerdown", () => {
      this.mobileButtons.attack = true;
    });
    attackBtn.on("pointerup", () => {
      this.mobileButtons.attack = false;
    });

    const gameData = window.GameData;
    const skills = (gameData && gameData.skills) || {};
    const skillKeys = (gameData && gameData.skillKeys) || {};

    if (skills.doubleAttack > 0) {
      const skillKey = skillKeys.doubleAttack || "S";
      const skillBtnX = startX - buttonSpacing;
      const skillBtn = this.add.circle(skillBtnX, buttonY, 30, 0x512da8, 0.8);
      skillBtn.setScrollFactor(0);
      skillBtn.setDepth(1000);
      skillBtn.setInteractive({ useHandCursor: true });
      this.add.text(skillBtnX, buttonY, skillKey, {
        fontSize: "18px",
        color: "#ffffff",
        fontWeight: "bold",
      }).setScrollFactor(0).setDepth(1001).setOrigin(0.5);

      skillBtn.on("pointerdown", () => {
        this.mobileButtons[skillKey.toLowerCase()] = true;
      });
      skillBtn.on("pointerup", () => {
        this.mobileButtons[skillKey.toLowerCase()] = false;
      });
    }

    if (skills.tripleAttack > 0) {
      const skillKey = skillKeys.tripleAttack || "D";
      const skillBtnX = startX - buttonSpacing * 2;
      const skillBtn = this.add.circle(skillBtnX, buttonY, 30, 0x7b1fa2, 0.8);
      skillBtn.setScrollFactor(0);
      skillBtn.setDepth(1000);
      skillBtn.setInteractive({ useHandCursor: true });
      this.add.text(skillBtnX, buttonY, skillKey, {
        fontSize: "18px",
        color: "#ffffff",
        fontWeight: "bold",
      }).setScrollFactor(0).setDepth(1001).setOrigin(0.5);

      skillBtn.on("pointerdown", () => {
        this.mobileButtons[skillKey.toLowerCase()] = true;
      });
      skillBtn.on("pointerup", () => {
        this.mobileButtons[skillKey.toLowerCase()] = false;
      });
    }

    this.mobileButtons = {
      jump: false,
      attack: false,
      s: false,
      d: false,
      f: false,
    };
  }

  updateJoystick(pointer) {
    if (!this.joystick) return;

    const dx = pointer.x - this.joystick.centerX;
    const dy = pointer.y - this.joystick.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > this.joystick.radius) {
      const angle = Math.atan2(dy, dx);
      this.joystick.handle.x = this.joystick.centerX + Math.cos(angle) * this.joystick.radius;
      this.joystick.handle.y = this.joystick.centerY + Math.sin(angle) * this.joystick.radius;
    } else {
      this.joystick.handle.x = pointer.x;
      this.joystick.handle.y = pointer.y;
    }

    const normalizedDx = (this.joystick.handle.x - this.joystick.centerX) / this.joystick.radius;
    if (Math.abs(normalizedDx) > 0.3) {
      this.joystick.direction = normalizedDx > 0 ? 1 : -1;
    } else {
      this.joystick.direction = 0;
    }
  }

  vibrate(duration = 50) {
    if (navigator.vibrate && this.isMobile) {
      navigator.vibrate(duration);
    }
  }

  update(time, delta) {
    if (this.gameState === "PLAY") {
      this.updateTimer(delta);
      this.handleMovement();
      this.handleAttack(time);
      this.updateCamera();
    }

    if (this.textures.exists("player_idle") && this.player.setFlipX) {
      if (this.facing === -1) {
        this.player.setFlipX(false);
      } else {
        this.player.setFlipX(true);
      }
    }
  }

  updateCamera() {
    // 카메라가 플레이어를 따라가되, 최대 스크롤 제한
    const cam = this.cameras.main;
    const { width } = this.scale;
    
    // 플레이어가 화면 중앙에 오도록 카메라 이동
    const targetX = this.player.x - width / 2;
    const clampedX = Phaser.Math.Clamp(targetX, 0, this.cameraMaxScroll);
    
    // 부드럽게 이동
    cam.scrollX = Phaser.Math.Linear(cam.scrollX, clampedX, 0.1);
  }

  updateTimer(delta) {
    this.elapsedTime += delta / 1000;
    const remaining = Math.max(this.timeLimit - this.elapsedTime, 0);
    this.timeText.setText(`TIME: ${remaining.toFixed(1)}`);

    if (remaining <= 0) {
      this.endDungeon();
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

    let jumpPressed = false;
    if (this.isMobile && this.mobileButtons) {
      jumpPressed = this.mobileButtons.jump && !this.jumpPressedLastFrame;
    } else {
      jumpPressed = Phaser.Input.Keyboard.JustDown(cursors.space);
    }
    this.jumpPressedLastFrame = this.isMobile ? (this.mobileButtons?.jump || false) : cursors.space.isDown;

    if (jumpPressed) {
      if (body.blocked.down) {
        body.setVelocityY(-this.playerStats.jumpPower);
        this.jumpCount = 1;
      } else if (canDoubleJump && this.jumpCount < 2) {
        this.jumpCount += 1;
        this.isDashing = true;
        body.setVelocityY(-this.playerStats.jumpPower * 0.8);
        body.setVelocityX(this.facing * this.playerStats.moveSpeed * 2.5);
      }
    }

    // 이동 범위 제한
    if (this.currentWall) {
      const wallX = this.currentWall.sprite.x;
      const wallWidth = this.currentWall.sprite.displayWidth || this.currentWall.sprite.width || 60;
      const playerWidth = this.player.displayWidth || this.player.width || 40;
      const maxX = wallX - wallWidth / 2 - playerWidth / 2 + 18;
      
      if (this.player.x > maxX) {
        this.player.x = maxX;
        body.setVelocityX(0);
      }
    }
  }

  handleAttack(time) {
    if (!this.currentWall || this.currentWall.state !== "alive") return;

    const gameData = window.GameData;
    const skills = (gameData && gameData.skills) || {};
    const skillKeys = (gameData && gameData.skillKeys) || {};

    let attackType = null;
    
    if (this.isMobile && this.mobileButtons) {
      if (this.mobileButtons.attack) {
        attackType = "basic";
      } else if (skills.tripleAttack > 0 && this.mobileButtons[skillKeys.tripleAttack?.toLowerCase() || "d"]) {
        attackType = "triple";
      } else if (skills.doubleAttack > 0 && this.mobileButtons[skillKeys.doubleAttack?.toLowerCase() || "s"]) {
        attackType = "double";
      }
    } else {
      if (this.keyA.isDown) {
        attackType = "basic";
      } else if (skills.tripleAttack > 0 && this.keyMatchesSkill("tripleAttack", skillKeys)) {
        attackType = "triple";
      } else if (skills.doubleAttack > 0 && this.keyMatchesSkill("doubleAttack", skillKeys)) {
        attackType = "double";
      }
    }

    if (!attackType) return;

    const effectiveCooldown =
      this.playerStats.baseCooldown /
      (1 + this.playerStats.attackSpeedBonus / 100);
    const elapsedSinceLast = (time - this.lastAttackTime) / 1000;
    if (elapsedSinceLast < effectiveCooldown) return;

    const distance = Math.abs(this.currentWall.sprite.x - this.player.x);
    const attackRange = 120;

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

    // 진동 (모바일)
    if (this.isMobile) {
      this.vibrate(50);
    }

    if (!window.GameData || window.GameData.screenShake) {
      this.cameras.main.shake(80, 0.005);
    }

    this.spawnDebris(this.currentWall.sprite.x, this.currentWall.sprite.y);
    this.showDamageText(
      this.currentWall.sprite.x,
      this.currentWall.sprite.y - 80,
      Math.round(damage)
    );

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

  onWallDestroyed() {
    const wall = this.currentWall;
    wall.state = "destroyed";
    this.destroyedWalls += 1;

    if (!window.GameData || window.GameData.screenShake) {
      this.cameras.main.shake(150, 0.01);
    }

    wall.sprite.visible = false;

    if (this.destroyedWalls >= 30) {
      // 30번째 벽을 부쉈으면 다음 레벨 해금
      if (window.GameData) {
        window.GameData.dailyDungeon.expDungeonLevel = Math.max(
          window.GameData.dailyDungeon.expDungeonLevel || 1,
          this.dungeonLevel + 1
        );
        if (window.saveGameData) window.saveGameData();
      }
      this.endDungeon();
      return;
    }

    // 다음 벽으로 이동
    this.currentWallIndex += 1;
    this.currentWall = this.walls[this.currentWallIndex];
    this.wallText.setText(`벽: ${this.destroyedWalls} / 30`);

    // 카메라 시점 이동 (30번째 벽이 보일 때까지)
    if (this.currentWall) {
      const nextWallX = this.currentWall.sprite.x;
      const { width } = this.scale;
      // 다음 벽이 화면에 보이도록 카메라 이동
      const targetScrollX = Math.max(0, nextWallX - width / 2);
      // 30번째 벽이 보일 때까지만 이동
      const lastWallX = this.walls[29].sprite.x;
      const maxScrollX = Math.max(0, lastWallX - width / 2);
      this.cameraMaxScroll = Math.min(targetScrollX, maxScrollX);
    }
  }

  endDungeon() {
    this.gameState = "RESULT";

    // 경험치 계산 (부순 벽 개수 * 레벨 * 10)
    const rewardExp = this.destroyedWalls * this.dungeonLevel * 10;

    this.scene.start("ResultScene", {
      isClear: true,
      timeUsed: this.elapsedTime,
      rewardExp,
      rewardGold: 0,
      stageLevel: this.dungeonLevel,
      isDailyDungeon: true,
      destroyedWalls: this.destroyedWalls,
    });
  }
}


class GoldDungeonScene extends Phaser.Scene {
  constructor() {
    super({ key: "GoldDungeonScene" });
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

    // 벽 생성 (하나만, 오른쪽에, 무한 HP)
    const wallX = width - 50; // 오른쪽에 붙임
    const wallY = height - groundHeight + 10;

    let wallSprite;
    if (this.textures.exists("wall_6")) {
      wallSprite = this.add.sprite(wallX, wallY, "wall_6");
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

    this.wall = {
      sprite: wallSprite,
      hp: Infinity, // 무한 HP
    };

    // 카메라 설정
    this.physics.world.setBounds(0, 0, width, height);
    this.cameras.main.setBounds(0, 0, width, height);
    this.cameras.main.scrollX = 0;

    // 입력
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);

    // 점수 (받은 데미지의 합)
    this.totalDamage = 0;
    this.timeLimit = 20; // 20초
    this.elapsedTime = 0;

    // UI
    this.timeText = this.add
      .text(width / 2, 20, "TIME: 20.0", {
        fontSize: "20px",
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0);

    this.scoreText = this.add
      .text(width / 2, 50, "점수: 0", {
        fontSize: "24px",
        color: "#ffeb3b",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0);

    this.gameState = "PLAY";
    this.lastAttackTime = 0;
  }

  update(time, delta) {
    if (this.gameState === "PLAY") {
      this.updateTimer(delta);
      this.handleMovement();
      this.handleAttack(time);
    }

    if (this.textures.exists("player_idle") && this.player.setFlipX) {
      if (this.facing === -1) {
        this.player.setFlipX(false);
      } else {
        this.player.setFlipX(true);
      }
    }
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
      
      let moveLeft = false;
      let moveRight = false;
      
      if (this.isMobile && this.joystick) {
        if (this.joystick.direction === -1) {
          moveLeft = true;
        } else if (this.joystick.direction === 1) {
          moveRight = true;
        }
      } else {
        moveLeft = cursors.left.isDown;
        moveRight = cursors.right.isDown;
      }
      
      if (moveLeft) {
        vx = -this.playerStats.moveSpeed;
        this.facing = -1;
      } else if (moveRight) {
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
    const wallX = this.wall.sprite.x;
    const wallWidth = this.wall.sprite.displayWidth || this.wall.sprite.width || 60;
    const playerWidth = this.player.displayWidth || this.player.width || 40;
    const maxX = wallX - wallWidth / 2 - playerWidth / 2 + 18;
    
    if (this.player.x > maxX) {
      this.player.x = maxX;
      body.setVelocityX(0);
    }
  }

  handleAttack(time) {
    if (this.gameState !== "PLAY") return;

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

    const distance = Math.abs(this.wall.sprite.x - this.player.x);
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

    const attackMultiplier = 1 + this.playerStats.attackBonus / 100;
    let damage = this.playerStats.baseAttack * attackMultiplier;

    const critChance = this.playerStats.critChanceBonus / 100;
    const isCrit = Math.random() < critChance;
    if (isCrit) {
      const critMult = 1 + this.playerStats.critDamageBonus / 100;
      damage *= critMult;
    }

    // 점수에 데미지 추가
    this.totalDamage += damage;
    this.scoreText.setText(`점수: ${Math.round(this.totalDamage)}`);

    // 진동 (모바일)
    if (this.isMobile) {
      this.vibrate(50);
    }

    if (!window.GameData || window.GameData.screenShake) {
      this.cameras.main.shake(80, 0.005);
    }

    this.spawnDebris(this.wall.sprite.x, this.wall.sprite.y);
    this.showDamageText(
      this.wall.sprite.x,
      this.wall.sprite.y - 80,
      Math.round(damage)
    );
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

  endDungeon() {
    this.gameState = "RESULT";

    // 골드 계산 (점수 / 10)
    const rewardGold = Math.floor(this.totalDamage / 10);

    this.scene.start("ResultScene", {
      isClear: true,
      timeUsed: this.elapsedTime,
      rewardExp: 0,
      rewardGold,
      stageLevel: 1,
      isGoldDungeon: true,
      totalScore: this.totalDamage,
    });
  }
}


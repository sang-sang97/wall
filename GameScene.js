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

    console.log("=== GameScene create() 시작 ===");
    console.log("사용 가능한 텍스처:", Object.keys(this.textures.list));
    
    // 플레이어 이미지 확인
    if (this.textures.exists("player_idle")) {
      const texture = this.textures.get("player_idle");
      console.log("✅ GameScene: player_idle 텍스처 존재, 크기:", texture.source[0].width, "x", texture.source[0].height);
    } else {
      console.error("❌ GameScene: player_idle 텍스처 없음!");
      console.log("사용 가능한 텍스처 목록:", Object.keys(this.textures.list));
    }

    // 배경 이미지 추가 (가장 뒤쪽 레이어)
    if (this.textures.exists("stage_background")) {
      const bgTexture = this.textures.get("stage_background");
      this.background = this.add.image(width / 2, height / 2, "stage_background");
      this.background.setOrigin(0.5, 0.5);
      
      const bgWidth = bgTexture.source[0].width;
      const bgHeight = bgTexture.source[0].height;
      
      console.log("배경 이미지 크기:", bgWidth, "x", bgHeight);
      
      if (bgWidth > 0 && bgHeight > 0) {
        const bgScaleX = width / bgWidth;
        const bgScaleY = height / bgHeight;
        const bgScale = Math.max(bgScaleX, bgScaleY);
        this.background.setScale(bgScale);
        console.log("배경 스케일:", bgScale);
      }
      
      this.background.setScrollFactor(0, 0);
      this.background.setDepth(-1000);
    } else {
      console.error("배경 이미지가 로드되지 않았습니다.");
    }

    this.createGameObjects();
  }

  createGameObjects() {
    const { width, height } = this.scale;

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
      attackBonus: 0, // 스테이지 시작 시 0%
      attackSpeedBonus: 0, // 스테이지 시작 시 0%
      critChanceBonus: 0, // 스테이지 시작 시 0%
      critDamageBonus: 0, // 스테이지 시작 시 0%
    };

    this.facing = 1;
    this.jumpCount = 0;
    this.isDashing = false;

    // 땅 이미지 사용
    let groundHeight = 40; // 기본 높이
    let ground;
    
    if (this.textures.exists("ground")) {
      const groundTexture = this.textures.get("ground");
      const actualGroundWidth = groundTexture.source[0].width;
      const actualGroundHeight = groundTexture.source[0].height;
      groundHeight = actualGroundHeight; // 실제 이미지 높이 사용
      
      console.log("땅 이미지 크기:", actualGroundWidth, "x", actualGroundHeight);
      
      const groundWidth = 2600; // 땅의 가로 길이
      
      // 타일 스프라이트로 반복하여 긴 땅 만들기
      ground = this.add.tileSprite(
        1300,
        height - groundHeight / 2,
        groundWidth,
        groundHeight,
        "ground"
      );
      ground.setOrigin(0.5, 0.5); // 중앙 기준
      ground.setDepth(-500); // 배경보다 앞, 플레이어보다 뒤
      
      // 타일 스프라이트를 물리 바디로 변환
      this.physics.add.existing(ground, true);
      console.log("땅 이미지 적용됨, 높이:", groundHeight);
    } else {
      // 이미지가 없으면 사각형 사용
      console.warn("땅 이미지가 없어서 사각형 사용");
      ground = this.add.rectangle(
        1300,
        height - groundHeight / 2,
        2600,
        groundHeight,
        0x333333
      );
      this.physics.add.existing(ground, true);
    }

    // 플레이어 스프라이트 생성 (현재는 단일 이미지, 나중에 스프라이트 시트로 교체)
    // 이미지가 로드되었는지 확인
    if (this.textures.exists("player_idle")) {
      this.player = this.add.sprite(
        100,
        height - groundHeight, // 땅 위에 정확히 배치 (origin이 하단이므로)
        "player_idle"
      );
      this.player.setOrigin(0.5, 1); // 하단 중앙 기준
      
      // 캐릭터 크기 조정 (원본 이미지가 크면 스케일 다운)
      // 기본적으로 150픽셀 높이로 맞춤
      const targetHeight = 150;
      const currentHeight = this.player.height;
      if (currentHeight > targetHeight) {
        const scale = targetHeight / currentHeight;
        this.player.setScale(scale);
        console.log("플레이어 스케일 조정:", scale, "원본 크기:", currentHeight);
      }
      
      console.log("플레이어 이미지로 스프라이트 생성됨, 크기:", this.player.width, "x", this.player.height);
    } else {
      // 이미지가 없으면 임시로 사각형 사용 (나중에 이미지 로드되면 교체)
      console.warn("플레이어 이미지가 로드되지 않음. 임시 사각형 사용");
      this.player = this.add.rectangle(
        100,
        height - groundHeight, // 땅 위에 정확히 배치
        40,
        80,
        0x5c6bc0
      );
    }
    
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body;
    
    // 충돌 박스 설정 (이미지가 있을 때만)
    if (this.textures.exists("player_idle")) {
      // 스케일 적용된 크기 기준으로 충돌 박스 설정
      const displayWidth = this.player.displayWidth || this.player.width;
      const displayHeight = this.player.displayHeight || this.player.height;
      this.playerBody.setSize(displayWidth * 0.8, displayHeight * 0.8);
      // offset을 0으로 설정하여 충돌 박스가 스프라이트 하단에 맞도록
      this.playerBody.setOffset(
        (displayWidth - this.playerBody.width) / 2,
        displayHeight - this.playerBody.height + 550
      );
    } else {
      // 사각형일 때는 기본 크기 사용
      this.playerBody.setSize(40, 80);
      this.playerBody.setOffset(0, 0);
    }
    
    this.playerBody.setCollideWorldBounds(true);
    this.playerBody.setBounce(0.0);
    this.playerBody.setGravityY(800); // 중력 설정 (점프를 위해 필요)
    
    // 플레이어가 땅 위에 정확히 서도록 위치 조정
    // 충돌 박스 설정 후 다시 위치 조정
    this.player.y = height - groundHeight;

    this.physics.add.collider(this.player, ground);

    // 플레이어 애니메이션 상태
    this.playerState = "idle"; // idle, walk, jump, attack
    
    // 손은 제거 (스프라이트에 포함되어 있다고 가정)
    this.hand = null;

    this.walls = [];
    this.currentWall = null;
    this.wallGraphicsGroup = this.add.group();

    for (let i = 0; i < WALL_CONFIG.count; i += 1) {
      const wallX = WALL_X_POSITIONS[i];
      const wallY = height - groundHeight + 10;
      const maxHp = WALL_CONFIG.hpByIndex[i];

      // 벽 이미지 사용 (1~5번)
      const wallImageKey = `wall_${i + 1}`;
      let wallSprite;
      
      if (this.textures.exists(wallImageKey)) {
        // 이미지가 있으면 이미지 스프라이트 사용
        // X 위치 조정 (왼쪽으로 이동하려면 숫자를 빼기)
        const adjustedWallX = wallX - 25; // ← 이 숫자를 조정 (예: -10, -20 등)
        
        wallSprite = this.add.sprite(adjustedWallX, wallY, wallImageKey);
        wallSprite.setOrigin(0.5, 1); // 하단 중앙 기준
        
        // 벽 크기 조정 (세로 길이 줄이기)
        const targetHeight = 400; // ← 원하는 높이(픽셀)로 변경
        const currentHeight = wallSprite.height;
        if (currentHeight > targetHeight) {
          const scale = targetHeight / currentHeight;
          wallSprite.setScale(scale);
          console.log(`벽 ${i + 1} 스케일 조정:`, scale, "원본 높이:", currentHeight);
        }
        
        console.log(`벽 ${i + 1} 이미지 적용됨`);
      } else {
        // 이미지가 없으면 사각형 사용
        console.warn(`벽 ${i + 1} 이미지 없음, 사각형 사용`);
        wallSprite = this.add.rectangle(wallX, wallY, 60, 200, 0x888888);
      }
      
      this.physics.add.existing(wallSprite, true);
      if (i > 0) {
        wallSprite.visible = false;
      }

      const wallData = {
        index: i,
        maxHp,
        hp: maxHp,
        sprite: wallSprite,
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

    // 모바일 감지 및 컨트롤 추가
    this.isMobile = this.sys.game.device.input.touch || window.innerWidth <= 768;
    this.virtualControls = null;
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

    // 조이스틱 배경
    const joystickBg = this.add.circle(joystickX, joystickY, joystickRadius, 0x333333, 0.7);
    joystickBg.setScrollFactor(0);
    joystickBg.setDepth(1000);
    joystickBg.setInteractive();

    // 조이스틱 핸들
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
      direction: 0, // -1: left, 0: none, 1: right
    };

    // 조이스틱 터치 이벤트
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

    // 점프 버튼
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

    // 공격 버튼 (A)
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

    // 스킬 버튼들 (S, D, F)
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

    // 방향 계산
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
    }

    // 손 위치 업데이트는 제거 (스프라이트에 포함)

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
    let newState = "idle";
    
    if (!this.isDashing) {
      vx = 0;
      
      // 모바일 조이스틱 또는 키보드 입력
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
        newState = "walk";
      } else if (moveRight) {
        vx = this.playerStats.moveSpeed;
        this.facing = 1;
        newState = "walk";
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
    } else {
      newState = "jump";
    }

    // 점프 입력 (키보드 또는 모바일)
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
        newState = "jump";
      } else if (canDoubleJump && this.jumpCount < 2) {
        this.jumpCount += 1;
        this.isDashing = true;
        body.setVelocityY(-this.playerStats.jumpPower * 0.8);
        body.setVelocityX(this.facing * this.playerStats.moveSpeed * 2.5);
        newState = "jump";
      }
    }

    // 플레이어 방향 설정 (스프라이트일 때만)
    // facing === -1: 왼쪽, facing === 1: 오른쪽
    // 원본 이미지가 오른쪽을 바라보고 있다면, 왼쪽을 바라볼 때만 반전
    // 원본 이미지가 왼쪽을 바라보고 있다면, 오른쪽을 바라볼 때만 반전
    if (this.textures.exists("player_idle") && this.player.setFlipX) {
      // 현재 반대로 되어 있으니 반대로 적용
      if (this.facing === -1) {
        // 왼쪽을 바라볼 때: 이미지 정상 (false) - 원본이 왼쪽을 바라보고 있다고 가정
        this.player.setFlipX(false);
      } else {
        // 오른쪽을 바라볼 때: 이미지 반전 (true) - 원본이 왼쪽을 바라보고 있으니 반전
        this.player.setFlipX(true);
      }
    }

    // 애니메이션 상태 업데이트 (현재는 단일 이미지이므로 나중에 스프라이트 시트로 교체 시 사용)
    if (newState !== this.playerState) {
      this.playerState = newState;
      // 나중에 스프라이트 시트가 있으면 여기서 애니메이션 재생
      // this.player.anims.play(`player_${newState}`, true);
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

    // 어떤 키가 눌렸는지 확인 (키보드 또는 모바일)
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
    const attackRange = 120; // 공격 범위 (픽셀) - 필요시 조정 가능

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
    // 공격 애니메이션 상태 설정
    this.playerState = "attack";
    // 나중에 스프라이트 시트가 있으면: this.player.anims.play("player_attack", true);
    
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
    
    // 공격 애니메이션 후 idle로 복귀 (대략적인 시간)
    this.time.addEvent({
      delay: hits * 120 + 200,
      callback: () => {
        if (this.playerState === "attack") {
          this.playerState = "idle";
        }
      },
    });
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
    
    // 이미지 스프라이트인 경우 틴트 효과 사용
    if (wall.sprite.setTint) {
      // 이미지 스프라이트: 틴트로 색상 변경
      if (ratio <= 0) {
        wall.sprite.setTint(0xffffff); // 흰색
      } else if (ratio <= 0.1) {
        wall.sprite.setTint(0xff6f00); // 주황색
      } else if (ratio <= 0.4) {
        wall.sprite.setTint(0xffa000); // 노란주황
      } else if (ratio <= 0.7) {
        wall.sprite.setTint(0xffd54f); // 노란색
      } else {
        wall.sprite.clearTint(); // 원래 색상
      }
    } else {
      // 사각형인 경우 기존 방식 사용
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
    const currentWall = this.walls[this.currentWallIndex];
    const currentWallX = currentWall.sprite.x;
    const wallWidth = currentWall.sprite.displayWidth || currentWall.sprite.width || 60;
    const playerWidth = this.player.displayWidth || this.player.width || 40;
    
    const minX = 50;
    // 벽의 왼쪽 가장자리에서 플레이어가 겹치지 않도록 여유 공간 추가
    const maxX = currentWallX - wallWidth / 2 - playerWidth / 2 + 18;
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

    // 버튼 순서: 재시작, 게임으로 돌아가기, 홈으로 돌아가기
    const restartText = this.add
      .text(viewX + width / 2, viewY + height / 2 + 60, "재시작", {
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#388e3c",
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const resumeText = this.add
      .text(viewX + width / 2, viewY + height / 2 + 100, "게임으로 돌아가기", {
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

  // updateHandPosition 제거됨 (스프라이트에 손이 포함되어 있음)

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
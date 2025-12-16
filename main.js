const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

function createDefaultGameData() {
  return {
    level: 1,
    exp: 0,
    expToNext: 100,
    gold: 0,
    highestUnlockedStage: 1,
    sound: true,
    screenShake: true,
    skillPoints: 0,
    skills: {
      doubleJump: 0,
      doubleAttack: 0,
      tripleAttack: 0,
    },
    upgrades: {
      attack: 0,
      attackSpeed: 0,
      critChance: 0,
      critDamage: 0,
    },
    skillKeys: {
      doubleAttack: "S",
      tripleAttack: "D",
    },
  };
}

window.loadGameData = function loadGameData() {
  try {
    const raw = localStorage.getItem("wallBreakerGameData");
    if (raw) {
      window.GameData = JSON.parse(raw);
    } else {
      window.GameData = createDefaultGameData();
    }
  } catch (e) {
    window.GameData = createDefaultGameData();
  }

  const defaults = createDefaultGameData();
  window.GameData = { ...defaults, ...window.GameData };
  window.GameData.skills = { ...defaults.skills, ...(window.GameData.skills || {}) };
  window.GameData.upgrades = {
    ...defaults.upgrades,
    ...(window.GameData.upgrades || {}),
  };
  window.GameData.skillKeys = {
    ...defaults.skillKeys,
    ...(window.GameData.skillKeys || {}),
  };
};

window.saveGameData = function saveGameData() {
  try {
    if (window.GameData) {
      localStorage.setItem(
        "wallBreakerGameData",
        JSON.stringify(window.GameData)
      );
    }
  } catch (e) {
    // ignore storage errors
  }
};

window.addEventListener("load", () => {
  const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: "game-root",
    backgroundColor: "#1b1b1f",
    physics: {
      default: "arcade",
      arcade: {
        gravity: { y: 800 },
        debug: false,
      },
    },
    scene: [BootScene, MenuScene, GameScene, ResultScene],
  };

  new Phaser.Game(config);
});
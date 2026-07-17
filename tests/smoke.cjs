const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const animationManifest = require("../animation-manifest.js");

const markup = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const gameSource = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
assert.match(markup, /pause-controls-grid/, "Pause menu should expose the complete controls");
assert.match(markup, /WASD \+ UIJK/, "Pause menu should list Player 1 controls");
assert.match(markup, /FLECHAS \+ NM,\./, "Pause menu should list Player 2 controls");
assert.match(markup, /SPACE<\/kbd><span>mantener \+ cualquier golpe/, "Pause menu should explain the body modifier");
assert.match(markup, /animation-manifest\.js[\s\S]*game\.js/, "Animation manifest must load before the game");
assert.match(markup, /Tres asaltos de 3 minutos/, "Menu should explain round duration");
assert.match(markup, /data-mode="practice"/, "Menu should expose practice mode");
assert.match(markup, /Sin reloj · daño visible por golpe/, "Practice mode should explain its damage display");
assert.match(markup, /brillante = stamina actual · tenue = límite recuperable/, "Pause menu should explain both stamina layers");
assert.match(
  gameSource,
  /context\.translate\(this\.x, guardY\);[\s\S]*context\.scale\(this\.facing, 1\);[\s\S]*context\.arc\(22, 0, 48/,
  "Guard indicator must mirror with the fighter facing",
);
assert.equal(Object.keys(animationManifest.strikes).length, 8, "Catalog should expose eight isolated strikes");
assert.equal(Object.keys(animationManifest.outcomes).length, 4, "Catalog should expose four finish outcomes");
assert.equal(animationManifest.outcomes.headKnockdown.result, "knockdown");
assert.equal(animationManifest.outcomes.bodyKnockdown.target, "body");
assert.equal(animationManifest.outcomes.headKnockout.frameLabels[9], "final-ko-pose");
assert.equal(animationManifest.outcomes.bodyKnockout.frameCount, 10);
assert.equal(animationManifest.strikes.leftPunchBody.limb, "left-hand");
assert.equal(animationManifest.strikes.leftPunchBody.target, "body");
assert.match(animationManifest.strikes.leftPunchBody.file, /left-punch-body-v5\.png$/);
assert.match(animationManifest.strikes.rightKickHead.file, /right-kick-head-v5\.png$/);
assert.match(animationManifest.strikes.rightKickBody.file, /right-kick-body-v5\.png$/);
for (const id of ["leftPunchBody", "rightKickHead", "rightKickBody"]) {
  assert.deepEqual(animationManifest.strikes[id].grid, {
    columns: 5,
    rows: 2,
    fallbackWidth: 1920,
    fallbackHeight: 682,
  });
}

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, forced) {
    if (forced === true) this.values.add(name);
    else if (forced === false) this.values.delete(name);
    else if (this.values.has(name)) this.values.delete(name);
    else this.values.add(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.style = {};
    this.textContent = "";
    this.innerHTML = "";
    this.offsetWidth = 100;
  }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }

  dispatch(type, event = {}) {
    for (const callback of this.listeners.get(type) || []) callback(event);
  }

  focus() {}

  setAttribute() {}

  async requestFullscreen() {
    document.fullscreenElement = this;
  }
}

const gradient = { addColorStop() {} };
const context = new Proxy({}, {
  get(target, property) {
    if (property === "createLinearGradient" || property === "createRadialGradient") {
      return () => gradient;
    }
    if (!(property in target)) target[property] = () => {};
    return target[property];
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  },
});

const canvas = new FakeElement();
canvas.width = 1280;
canvas.height = 720;
canvas.getContext = () => context;

const selectors = new Map();
const make = (selector) => {
  const element = selector === "#game" ? canvas : new FakeElement();
  selectors.set(selector, element);
  return element;
};

[
  "#game",
  "#game-shell",
  "#menu-screen",
  "#pause-screen",
  "#result-screen",
  "#round-message",
  "#round-kicker",
  "#round-title",
  "#result-kicker",
  "#result-title",
  "#result-copy",
  "#sound-button",
  "#sound-icon",
  "#combat-controls",
  "#resume-button",
  "#rematch-button",
  "#fullscreen-button",
  ".brand",
].forEach(make);

const modeButtons = [
  new FakeElement({ mode: "cpu" }),
  new FakeElement({ mode: "local" }),
  new FakeElement({ mode: "practice" }),
];
const menuButtons = [new FakeElement(), new FakeElement()];
const windowListeners = new Map();
const animationFrames = [];
const imageSources = [];

global.document = {
  fullscreenElement: null,
  querySelector(selector) {
    assert(selectors.has(selector), `Missing fake element for ${selector}`);
    return selectors.get(selector);
  },
  querySelectorAll(selector) {
    if (selector === "[data-mode]") return modeButtons;
    if (selector === ".menu-button") return menuButtons;
    return [];
  },
  async exitFullscreen() {
    this.fullscreenElement = null;
  },
};

global.window = {
  addEventListener(type, callback) {
    if (!windowListeners.has(type)) windowListeners.set(type, []);
    windowListeners.get(type).push(callback);
  },
};

global.Image = class FakeImage {
  constructor() {
    this.complete = true;
  }

  set src(value) {
    this.source = value;
    imageSources.push(value);
  }

  get naturalWidth() {
    if (this.source?.includes("fighter-mma")) return 1774;
    if (this.source?.includes("-v5.png")) return 1920;
    return this.source?.includes("/animations/strikes/") ? 1536 : 1920;
  }

  get naturalHeight() {
    if (this.source?.includes("fighter-mma")) return 887;
    if (this.source?.includes("-knock")) return 682;
    if (this.source?.includes("-v5.png")) return 682;
    return this.source?.includes("/animations/strikes/") ? 1023 : 1364;
  }
};

global.requestAnimationFrame = (callback) => {
  animationFrames.push(callback);
};

const { game, ATTACKS } = require("../game.js");

assert.deepEqual(globalThis.NEON_BRAWL_GAMEPLAY_RULES, {
  roundTimeSeconds: 180,
  strikeDamageScale: 0.5,
  bodyDamageScale: 0.85,
  strikeStaminaScale: 1,
  inefficientStrikeStaminaScale: 1.5,
  minimumFighterDistance: 168,
  guaranteedStrikeDistance: 178,
  criticalKnockdownChance: 0.2,
  criticalAttackerMaxSpeed: 38,
  criticalTargetMinSpeed: 70,
  criticalDamageMultiplier: 1.75,
  criticalStunSeconds: 1,
  minLongTermStamina: 35,
  cornerLongTermRecovery: 4,
});
assert.match(gameSource, /spendStrikeStamina\(definition\.stamina\)/, "Every standing strike should spend long-term stamina");
assert.match(gameSource, /attacker\.attack\?\.stationaryStart[\s\S]*Math\.abs\(target\.velocityX\)/, "Critical hits should require a stationary attacker and moving target");
assert.match(gameSource, /severity: critical \? "critical" : "clean"/, "Clean and critical hits should use distinct reactions");
assert.match(gameSource, /target\.blockReaction = \{/, "Blocked strikes should trigger a subtle guard reaction");
assert.match(gameSource, /drawStaminaBar\(context, fighter/, "HUD should draw short and long-term stamina together");
assert.match(gameSource, /this\.mode !== "practice"[\s\S]*this\.timer/, "Practice mode should not consume the timer");
assert.match(gameSource, /spawnDamageNumber\(/, "Practice impacts should show numeric damage");

const attacker = game.fighterOne;
const defender = game.fighterTwo;
attacker.resetMatchStamina();
attacker.resetRound(400, 1);
const restedCapacity = attacker.longTermStamina;
attacker.spendStrikeStamina(20);
assert.equal(attacker.stamina, 80, "A clean 20-point strike should cost 20 short-term stamina");
const restedCapacityLoss = restedCapacity - attacker.longTermStamina;
attacker.stamina = 20;
const fatiguedCapacity = attacker.longTermStamina;
attacker.spendStrikeStamina(10);
assert(
  fatiguedCapacity - attacker.longTermStamina > restedCapacityLoss,
  "A strike thrown while fatigued should cause greater long-term loss",
);

attacker.resetMatchStamina();
attacker.resetRound(400, 1);
defender.resetMatchStamina();
defender.resetRound(900, -1);
attacker.startAttack("leftPunchHead");
assert.equal(attacker.stamina, 95, "Starting a strike should spend 100% of its base stamina");
attacker.attack.elapsed = ATTACKS.leftPunchHead.startup
  + ATTACKS.leftPunchHead.active
  + ATTACKS.leftPunchHead.recovery;
attacker.updateAttack(1 / 60, defender);
assert.equal(attacker.stamina, 92.5, "A missed strike should spend 150% stamina in total");

attacker.resetMatchStamina();
attacker.resetRound(400, 1);
defender.resetMatchStamina();
defender.resetRound(491, -1);
attacker.attack = {
  type: "leftPunchHead",
  elapsed: 0,
  connected: true,
  facing: 1,
  stationaryStart: true,
};
defender.velocityX = 70;
const originalRandom = Math.random;
Math.random = () => 0.9;
game.resolveAttack(attacker, defender, ATTACKS.leftPunchHead, { x: 480, y: 350 });
Math.random = originalRandom;
assert(Math.abs(defender.headHealth - 94.75) < 0.0001, "Critical strike should use half base damage times 1.75");
assert.equal(defender.stun, 1, "Critical strike should apply a one-second stun");
assert.equal(defender.hitReaction.severity, "critical");

attacker.resetRound(400, 1);
defender.resetRound(491, -1);
attacker.resetMatchStamina();
attacker.startAttack("leftPunchHead");
attacker.attack.connected = true;
defender.guard = "high";
defender.velocityX = 90;
game.resolveAttack(attacker, defender, ATTACKS.leftPunchHead, { x: 480, y: 350 });
assert(defender.blockReaction, "Matching guard should trigger a block reaction");
assert.equal(defender.hitReaction, null, "Blocked strike should not play a clean reaction");
assert.equal(attacker.stamina, 92.5, "A blocked strike should spend 150% stamina in total");

attacker.resetRound(400, 1);
defender.resetRound(491, -1);
attacker.attack = {
  type: "leftPunchHead",
  elapsed: 0,
  connected: true,
  inefficientPenaltyApplied: false,
  facing: 1,
  stationaryStart: true,
};
defender.velocityX = 70;
Math.random = () => 0.19;
game.resolveAttack(attacker, defender, ATTACKS.leftPunchHead, { x: 480, y: 350 });
Math.random = originalRandom;
assert(defender.knockdownTimer > 0, "A critical roll below 0.20 should trigger a knockdown");
assert.equal(defender.knockdownTarget, "head");
assert.equal(defender.getVisualFrame().animation, "headKnockdown");

attacker.resetRound(400, 1);
defender.resetRound(568, -1);
game.knockDown(attacker, defender, "body");
assert.equal(defender.getVisualFrame().animation, "bodyKnockdown");

attacker.resetRound(400, 1);
defender.resetRound(568, -1);
game.state = "fighting";
game.finishFight(attacker, "BODY K.O.", defender, "body");
assert.equal(game.state, "roundOver");
assert.equal(defender.getVisualFrame().animation, "bodyKnockout");
assert.equal(selectors.get("#round-message").classList.contains("is-hidden"), true, "KO banner should wait for the fall");
game.update(1.2);
assert.equal(selectors.get("#round-title").textContent, "BODY K.O.", "KO banner should appear after the finish animation begins");
game.returnToMenu();

attacker.resetRound(400, 1);
defender.resetRound(450, -1);
game.resolveFighterSpacing();
assert.equal(Math.abs(defender.x - attacker.x), 168, "Fighters should never overlap closer than the visual contact distance");
for (const [type, definition] of Object.entries(ATTACKS).filter(([, attack]) => attack.target !== "takedown")) {
  attacker.attack = {
    type,
    elapsed: definition.startup + definition.active / 2,
    connected: false,
    inefficientPenaltyApplied: false,
    facing: 1,
    stationaryStart: true,
  };
  defender.x = attacker.x + 178;
  assert(game.findAttackContact(attacker, defender, definition), `${type} should connect at 178px`);
  defender.x = attacker.x + 179;
  assert.equal(game.findAttackContact(attacker, defender, definition), null, `${type} should miss beyond 178px`);
}

attacker.resetMatchStamina();
attacker.resetRound(400, 1);
defender.resetMatchStamina();
defender.resetRound(484, -1);
attacker.attack = {
  type: "leftPunchBody",
  elapsed: 0,
  connected: true,
  inefficientPenaltyApplied: false,
  facing: 1,
  stationaryStart: true,
};
game.mode = "practice";
game.damageNumbers.length = 0;
game.resolveAttack(attacker, defender, ATTACKS.leftPunchBody, { x: 475, y: 430 });
assert(Math.abs(defender.bodyHealth - 96.6) < 0.0001, "Body strikes should receive the additional 0.85 damage scale");
assert.equal(game.damageNumbers[0].text, "3.40", "Practice mode should show exact damage with two decimals");
defender.bodyHealth = 1;
game.resolveAttack(attacker, defender, ATTACKS.leftPunchBody, { x: 475, y: 430 });
assert.equal(game.state, "menu", "Practice damage should not end the session");
assert(defender.practiceResetTimer > 0, "A depleted practice dummy should schedule an automatic reset");
defender.update(0.9, game.emptyInput(), attacker);
assert.equal(defender.bodyHealth, 100, "The practice dummy should recover after the reset delay");
game.mode = "cpu";

assert.equal(animationFrames.length, 1, "The game should schedule its animation loop");
assert.equal(modeButtons[0].listeners.has("click"), true, "CPU mode should be interactive");
assert.equal(modeButtons[2].listeners.has("click"), true, "Practice mode should be interactive");
assert.equal(imageSources.length, 16, "All modular combat animation sheets should preload");
for (const movement of Object.values(animationManifest.strikes)) {
  assert(imageSources.includes(movement.file), `${movement.id} should preload its own sheet`);
}
for (const movement of Object.values(animationManifest.outcomes)) {
  assert(imageSources.includes(movement.file), `${movement.id} should preload its own sheet`);
}
assert(imageSources.includes("/assets/animations/support/hit-reactions-v4.png"));
assert(imageSources.includes("/assets/animations/support/footwork-v3.png"));
assert(imageSources.includes("/assets/animations/support/guards-v3.png"));

modeButtons[2].dispatch("click");
game.state = "fighting";
game.timer = 42;
game.update(0.5);
assert.equal(game.timer, 42, "Practice mode should keep an infinite timer");
game.returnToMenu();

modeButtons[0].dispatch("click");
assert.equal(selectors.get("#menu-screen").classList.contains("is-hidden"), true);

const sendKey = (type, code) => {
  for (const listener of windowListeners.get(type) || []) {
    listener({ code, repeat: false, preventDefault() {} });
  }
};

const tapFrames = new Map([
  [130, "KeyU"],
  [175, "KeyI"],
  [235, "KeyJ"],
  [305, "KeyK"],
  [390, "KeyU"],
]);

let time = performance.now();
for (let frame = 0; frame < 450; frame += 1) {
  time += 1000 / 60;
  const callback = animationFrames.shift();
  assert(callback, `Missing animation frame ${frame}`);
  callback(time);

  if (frame === 112) sendKey("keydown", "KeyD");
  if (frame === 114) sendKey("keydown", "KeyW");
  if (frame === 120) sendKey("keyup", "KeyW");
  if (frame === 121) sendKey("keydown", "KeyS");
  if (frame === 126) sendKey("keyup", "KeyS");
  if (frame === 126) sendKey("keyup", "KeyD");
  if (frame === 389) sendKey("keydown", "Space");
  if (frame === 391) sendKey("keyup", "Space");
  const tappedKey = tapFrames.get(frame);
  if (tappedKey) sendKey("keydown", tappedKey);
  const releasedKey = tapFrames.get(frame - 1);
  if (releasedKey) sendKey("keyup", releasedKey);
}

sendKey("keydown", "Escape");
assert.equal(selectors.get("#pause-screen").classList.contains("is-hidden"), false);
selectors.get("#resume-button").dispatch("click");
assert.equal(selectors.get("#pause-screen").classList.contains("is-hidden"), true);

console.log("Smoke test passed: spacing, guaranteed contact, critical knockdowns, finish animations, practice lab and controls.");

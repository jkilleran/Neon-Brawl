const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const animationManifest = require("../animation-manifest.js");

const markup = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const gameSource = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
assert.match(markup, /pause-controls-grid/, "Pause menu should expose the complete controls");
assert.match(markup, /WASD \+ TYGH/, "Pause menu should list Player 1 controls");
assert.match(markup, /FLECHAS \+ IOKL/, "Pause menu should list Player 2 controls");
assert.match(markup, /SPACE \/ SHIFT<\/kbd><span>mantener \+ cualquier golpe/, "Pause menu should explain the body modifier");
assert.match(markup, /animation-manifest\.js[\s\S]*game\.js/, "Animation manifest must load before the game");
assert.match(markup, /Tres asaltos de 3 minutos/, "Menu should explain round duration");
assert.match(markup, /data-mode="practice"/, "Menu should expose practice mode");
assert.match(markup, /data-mode="online"/, "Menu should expose online mode");
assert.match(markup, /BUSCANDO PARTIDA AHORA MISMO/, "Online lobby should show live matchmaking presence");
assert.match(markup, /id="online-latency"[\s\S]*SERVER RTT/, "Online lobby should show server round-trip latency");
assert.match(markup, /id="result-scorecard"/, "Result screen should expose the per-round scorecard");
assert.match(markup, /online-client\.js[\s\S]*game\.js/, "Online client must load before the game");
assert.match(markup, /Sin reloj · daño visible por golpe/, "Practice mode should explain its damage display");
assert.match(markup, /brillante = stamina actual · tenue = límite recuperable/, "Pause menu should explain both stamina layers");
assert.match(gameSource, /ONLINE_SNAPSHOT_INTERVAL = 1 \/ 30/, "Online snapshots should run at 30 Hz");
assert.match(gameSource, /sendOnlineInputNow/, "Guest controls should support immediate input delivery");
assert.match(
  gameSource,
  /context\.translate\(this\.x, guardY\);[\s\S]*context\.scale\(this\.facing, 1\);[\s\S]*context\.arc\(22, 0, 48/,
  "Guard indicator must mirror with the fighter facing",
);
assert.equal(Object.keys(animationManifest.strikes).length, 8, "Catalog should expose eight isolated strikes");
assert.equal(Object.keys(animationManifest.outcomes).length, 18, "Catalog should expose ten knockdowns and eight knockouts");
assert.equal(Object.keys(animationManifest.characters).length, 2, "Catalog should expose one library per fighter");
assert.equal(Object.keys(animationManifest.movements).length, 33, "Each fighter should expose 33 movements");
assert.equal(Object.keys(animationManifest.support).length, 6, "Support atlases should be split into six movements");
assert.equal(animationManifest.outcomes.headKnockdown.result, "knockdown");
assert.equal(animationManifest.outcomes.bodyKnockdown.target, "body");
assert.equal(animationManifest.outcomes.headKnockdownForward.variant, "forward-hands-and-knee");
assert.equal(animationManifest.outcomes.bodyKnockdownKneel.variant, "double-knee-solar-plexus");
assert.equal(animationManifest.outcomes.headKnockdownSeated.variant, "rotational-seated-recovery");
assert.equal(animationManifest.outcomes.bodyKnockdownSeated.variant, "backward-seated-body-recovery");
assert.equal(animationManifest.outcomes.headKnockout.frameLabels[9], "final-ko-pose");
assert.equal(animationManifest.outcomes.bodyKnockout.frameCount, 10);
assert.equal(animationManifest.outcomes.headKnockoutProne.variant, "forward-prone-finish");
assert.equal(animationManifest.outcomes.bodyKnockoutProne.variant, "kneeling-prone-body-finish");
assert.equal(animationManifest.outcomes.headKnockdownShoulderRoll.variant, "corkscrew-shoulder-roll-recovery");
assert.equal(animationManifest.outcomes.headKnockdownKneeDrop.variant, "delayed-one-knee-recovery");
assert.equal(animationManifest.outcomes.bodyKnockdownElbowFold.variant, "compact-liver-elbow-hip-recovery");
assert.equal(animationManifest.outcomes.bodyKnockdownThreePoint.variant, "solar-plexus-three-point-recovery");
assert.equal(animationManifest.outcomes.headKnockoutSide.variant, "spinning-side-finish");
assert.equal(animationManifest.outcomes.headKnockoutKneeCollapse.variant, "delayed-double-knee-side-finish");
assert.equal(animationManifest.outcomes.bodyKnockoutSupine.variant, "backward-supine-body-finish");
assert.equal(animationManifest.outcomes.bodyKnockoutSeatedSlump.variant, "seated-side-slump-body-finish");
assert.equal(animationManifest.strikes.leftPunchBody.limb, "left-hand");
assert.equal(animationManifest.strikes.leftPunchBody.target, "body");
assert.equal(animationManifest.strikes.leftPunchBody.input.p2, "Shift + I");
assert.match(animationManifest.strikes.leftPunchBody.folder, /body\/left-punch$/);
assert.match(animationManifest.strikes.rightKickHead.folder, /head\/right-kick$/);
assert.match(animationManifest.strikes.rightKickBody.folder, /body\/right-kick$/);
for (const id of ["leftPunchBody", "rightKickHead", "rightKickBody"]) {
  assert.equal(animationManifest.strikes[id].grid.columns, 5);
  assert.equal(animationManifest.strikes[id].grid.rows, 2);
  assert.equal(animationManifest.strikes[id].grid.frames, 10);
  assert.equal(animationManifest.strikes[id].grid.fallbackWidth, 1920);
  assert.equal(animationManifest.strikes[id].grid.fallbackHeight, 682);
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
  "#result-scorecard",
  "#sound-button",
  "#sound-icon",
  "#combat-controls",
  "#online-screen",
  "#online-connect-form",
  "#online-name",
  "#online-presence",
  "#online-status",
  "#online-latency",
  "#online-latency-value",
  "#online-latency-quality",
  "#online-player-count",
  "#online-player-list",
  "#online-challenge",
  "#online-challenger-name",
  "#online-accept",
  "#online-decline",
  "#online-back",
  "#resume-button",
  "#rematch-button",
  "#fullscreen-button",
  ".brand",
].forEach(make);

const modeButtons = [
  new FakeElement({ mode: "cpu" }),
  new FakeElement({ mode: "local" }),
  new FakeElement({ mode: "practice" }),
  new FakeElement({ mode: "online" }),
];
const menuButtons = [new FakeElement(), new FakeElement()];
const windowListeners = new Map();
const animationFrames = [];
const imageSources = [];
const animationSheetsBySource = new Map(
  Object.values(animationManifest.characters).flatMap((character) => (
    Object.values(character.sheets).map((sheet) => [sheet.src, sheet])
  )),
);

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
    return animationSheetsBySource.get(this.source)?.fallbackWidth ?? 0;
  }

  get naturalHeight() {
    return animationSheetsBySource.get(this.source)?.fallbackHeight ?? 0;
  }
};

global.requestAnimationFrame = (callback) => {
  animationFrames.push(callback);
};

const { game, ATTACKS } = require("../game.js");

assert.deepEqual(globalThis.NEON_BRAWL_GAMEPLAY_RULES, {
  roundTimeSeconds: 180,
  strikeDamageScale: 0.40375,
  criticalStrikeDamageScale: 0.425,
  bodyDamageScale: 0.85,
  strikeStaminaScale: 1,
  inefficientStrikeStaminaScale: 1.5,
  minimumFighterDistance: 168,
  guaranteedStrikeDistance: 178,
  criticalKnockdownChance: 1 / 2.2,
  criticalAttackerMaxSpeed: 38,
  criticalTargetMinSpeed: 70,
  vulnerableCriticalHealthThresholdByRound: [45, 65, 75],
  vulnerableCriticalChance: 1 / 3.5,
  criticalDamageMultiplier: 1.75,
  criticalStunSeconds: 1,
  minLongTermStamina: 35,
  cornerLongTermRecovery: 4,
});
assert.match(gameSource, /spendStrikeStamina\(definition\.stamina\)/, "Every standing strike should spend long-term stamina");
assert.match(gameSource, /attacker\.attack\?\.stationaryStart[\s\S]*Math\.abs\(target\.velocityX\)/, "Critical hits should require a stationary attacker and moving target");
assert.match(gameSource, /vulnerableCriticalHealthThresholdByRound[\s\S]*targetedHealth < vulnerableThreshold[\s\S]*GAMEPLAY_RULES\.vulnerableCriticalChance/, "Targeted health should use the round-specific vulnerability threshold");
assert.match(gameSource, /critical\s*\? GAMEPLAY_RULES\.criticalStrikeDamageScale[\s\S]*GAMEPLAY_RULES\.strikeDamageScale/, "Critical strikes should preserve their previous damage scale");
assert.match(gameSource, /severity: critical \? "critical" : "clean"/, "Clean and critical hits should use distinct reactions");
assert.match(gameSource, /target\.blockReaction = \{/, "Blocked strikes should trigger a subtle guard reaction");
assert.match(gameSource, /drawStaminaBar\(context, fighter/, "HUD should draw short and long-term stamina together");
assert.match(gameSource, /this\.mode !== "practice"[\s\S]*this\.timer/, "Practice mode should not consume the timer");
assert.match(gameSource, /spawnDamageNumber\(/, "Practice impacts should show numeric damage");
assert.doesNotMatch(gameSource, /knockdownsSuffered\s*>=/, "Knockdown count must not trigger a TKO");

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
assert.equal(attacker.roundStats.thrown, 1, "Starting a standing strike should count as thrown");
assert.equal(attacker.roundStats.missed, 1, "A strike with no contact should count as missed");

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
assert(Math.abs(defender.headHealth - 95.5375) < 0.0001, "Critical strike should use the reduced 0.425 damage scale times 1.75");
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
assert.equal(attacker.roundStats.blocked, 1, "A guarded strike should be tracked separately from a clean landing");
assert.equal(attacker.roundStats.landed, 0, "A guarded strike should not count as landed");

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
const criticalRolls = [0.249, 0.3];
Math.random = () => criticalRolls.shift() ?? 0.5;
game.resolveAttack(attacker, defender, ATTACKS.leftPunchHead, { x: 480, y: 350 });
Math.random = originalRandom;
assert(defender.knockdownTimer > 0, "A critical roll below 1/2.2 should trigger a knockdown");
assert.equal(defender.knockdownTarget, "head");
assert.equal(defender.getVisualFrame().animation, "headKnockdownForward");

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
Math.random = () => 1 / 2.2;
game.resolveAttack(attacker, defender, ATTACKS.leftPunchHead, { x: 480, y: 350 });
Math.random = originalRandom;
assert.equal(defender.knockdownTimer, 0, "A critical roll exactly at 1/2.2 should not trigger a knockdown");

attacker.resetMatchStamina();
attacker.resetRound(400, 1);
defender.resetRound(491, -1);
defender.headHealth = 44;
attacker.attack = {
  type: "leftPunchHead",
  elapsed: 0,
  connected: true,
  inefficientPenaltyApplied: false,
  facing: 1,
  stationaryStart: false,
};
defender.velocityX = 0;
const vulnerabilityRolls = [0.28, 0.9];
Math.random = () => vulnerabilityRolls.shift() ?? 0.5;
game.resolveAttack(attacker, defender, ATTACKS.leftPunchHead, { x: 480, y: 350 });
Math.random = originalRandom;
assert(Math.abs(defender.headHealth - 39.5375) < 0.0001, "A head bar below 45% should allow a 1-in-3.5 critical");
assert.equal(defender.hitReaction.severity, "critical");
assert.equal(defender.stun, 1);

attacker.resetRound(400, 1);
defender.resetRound(491, -1);
defender.headHealth = 44;
attacker.attack = {
  type: "leftPunchHead",
  elapsed: 0,
  connected: true,
  inefficientPenaltyApplied: false,
  facing: 1,
  stationaryStart: false,
};
defender.velocityX = 0;
Math.random = () => 1 / 3.5;
game.resolveAttack(attacker, defender, ATTACKS.leftPunchHead, { x: 480, y: 350 });
Math.random = originalRandom;
assert.equal(defender.hitReaction.severity, "clean", "A vulnerability roll exactly at 1/3.5 should not be critical");

attacker.resetRound(400, 1);
defender.resetRound(491, -1);
defender.headHealth = 45;
attacker.attack = {
  type: "leftPunchHead",
  elapsed: 0,
  connected: true,
  inefficientPenaltyApplied: false,
  facing: 1,
  stationaryStart: false,
};
defender.velocityX = 0;
Math.random = () => 0;
game.resolveAttack(attacker, defender, ATTACKS.leftPunchHead, { x: 480, y: 350 });
Math.random = originalRandom;
assert.equal(defender.hitReaction.severity, "clean", "The vulnerability threshold should be strictly below 45%");

attacker.resetRound(400, 1);
defender.resetRound(491, -1);
defender.bodyHealth = 44;
attacker.attack = {
  type: "leftPunchHead",
  elapsed: 0,
  connected: true,
  inefficientPenaltyApplied: false,
  facing: 1,
  stationaryStart: false,
};
defender.velocityX = 0;
Math.random = () => 0;
game.resolveAttack(attacker, defender, ATTACKS.leftPunchHead, { x: 480, y: 350 });
Math.random = originalRandom;
assert.equal(defender.hitReaction.severity, "clean", "A low body bar must not make a head strike vulnerable-critical");

attacker.resetMatchStamina();
attacker.resetRound(400, 1);
defender.resetRound(484, -1);
defender.bodyHealth = 44;
attacker.attack = {
  type: "leftPunchBody",
  elapsed: 0,
  connected: true,
  inefficientPenaltyApplied: false,
  facing: 1,
  stationaryStart: false,
};
defender.velocityX = 0;
const bodyVulnerabilityRolls = [0.28, 0.9];
Math.random = () => bodyVulnerabilityRolls.shift() ?? 0.5;
game.resolveAttack(attacker, defender, ATTACKS.leftPunchBody, { x: 475, y: 430 });
Math.random = originalRandom;
assert(Math.abs(defender.bodyHealth - 38.9425) < 0.0001, "A body bar below 45% should allow its own 1-in-3.5 critical");
assert.equal(defender.hitReaction.severity, "critical");

const resolveRoundHeadVulnerability = (round, health, vulnerabilityRoll) => {
  attacker.resetMatchStamina();
  attacker.resetRound(400, 1);
  defender.resetRound(491, -1);
  defender.headHealth = health;
  attacker.attack = {
    type: "leftPunchHead",
    elapsed: 0,
    connected: true,
    inefficientPenaltyApplied: false,
    facing: 1,
    stationaryStart: false,
  };
  defender.velocityX = 0;
  game.round = round;
  const rolls = [vulnerabilityRoll, 0.99];
  Math.random = () => rolls.shift() ?? 0.5;
  game.resolveAttack(attacker, defender, ATTACKS.leftPunchHead, { x: 480, y: 350 });
  Math.random = originalRandom;
  return defender.hitReaction.severity;
};

assert.equal(resolveRoundHeadVulnerability(2, 64, 0.28), "critical", "Round 2 should unlock vulnerability criticals below 65%");
assert.equal(resolveRoundHeadVulnerability(2, 65, 0), "clean", "Round 2 threshold should be strictly below 65%");
assert.equal(resolveRoundHeadVulnerability(3, 74, 0.28), "critical", "Round 3 should unlock vulnerability criticals below 75%");
assert.equal(resolveRoundHeadVulnerability(3, 75, 0), "clean", "Round 3 threshold should be strictly below 75%");
game.round = 1;

attacker.resetRound(400, 1);
defender.resetRound(568, -1);
Math.random = () => 0.99;
game.knockDown(attacker, defender, "body");
Math.random = originalRandom;
assert.equal(defender.getVisualFrame().animation, "bodyKnockdownThreePoint");

attacker.resetRound(400, 1);
defender.resetRound(568, -1);
defender.knockdownsSuffered = 12;
game.state = "fighting";
Math.random = () => 0;
game.knockDown(attacker, defender, "head");
Math.random = originalRandom;
assert.equal(defender.knockdownsSuffered, 13, "Knockdown count should continue without a limit");
assert.equal(game.state, "fighting", "Knockdown count must never trigger an automatic TKO");

attacker.resetRound(400, 1);
defender.resetRound(568, -1);
game.state = "fighting";
Math.random = () => 0.99;
game.finishFight(attacker, "BODY K.O.", defender, "body");
Math.random = originalRandom;
assert.equal(game.state, "roundOver");
assert.equal(defender.getVisualFrame().animation, "bodyKnockoutSeatedSlump");
assert.equal(selectors.get("#round-message").classList.contains("is-hidden"), true, "KO banner should wait for the fall");
game.update(1.2);
assert.equal(selectors.get("#round-title").textContent, "BODY K.O.", "KO banner should appear after the finish animation begins");
game.returnToMenu();

attacker.resetRound(400, 1);
defender.resetRound(568, -1);
game.state = "fighting";
Math.random = () => 0.99;
game.finishFight(attacker, "K.O.", defender, "head");
Math.random = originalRandom;
assert.equal(defender.getVisualFrame().animation, "headKnockoutKneeCollapse");
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
assert(Math.abs(defender.bodyHealth - 97.2545) < 0.0001, "Normal body strikes should combine the 0.40375 global and 0.85 body damage scales");
assert.equal(game.damageNumbers[0].text, "2.75", "Practice mode should show exact damage with two decimals");
defender.bodyHealth = 1;
game.resolveAttack(attacker, defender, ATTACKS.leftPunchBody, { x: 475, y: 430 });
assert.equal(game.state, "menu", "Practice damage should not end the session");
assert(defender.practiceResetTimer > 0, "A depleted practice dummy should schedule an automatic reset");
defender.update(0.9, game.emptyInput(), attacker);
assert.equal(defender.bodyHealth, 100, "The practice dummy should recover after the reset delay");
game.mode = "cpu";

attacker.resetRound(400, 1);
defender.resetRound(568, -1);
attacker.roundStats = { thrown: 12, landed: 7, missed: 3, blocked: 2, critical: 1, headLanded: 5, bodyLanded: 2 };
defender.roundStats = { thrown: 9, landed: 4, missed: 4, blocked: 1, critical: 0, headLanded: 3, bodyLanded: 1 };
attacker.roundDamage = 28.25;
defender.roundDamage = 16.5;
game.roundHistory = [];
game.recordedRounds.clear();
game.round = 1;
game.recordRound({ winner: attacker, method: "DECISION", scoreOne: 10, scoreTwo: 9 });
game.renderScorecard();
assert.match(selectors.get("#result-scorecard").innerHTML, /12/);
assert.match(selectors.get("#result-scorecard").innerHTML, /28\.25/);
assert.match(selectors.get("#result-scorecard").innerHTML, /10/);
assert.match(selectors.get("#result-scorecard").innerHTML, /9/);

assert.equal(animationFrames.length, 1, "The game should schedule its animation loop");
assert.equal(modeButtons[0].listeners.has("click"), true, "CPU mode should be interactive");
assert.equal(modeButtons[2].listeners.has("click"), true, "Practice mode should be interactive");
assert.equal(imageSources.length, 66, "All 33 movements for both fighters should preload");
for (const [characterId, character] of Object.entries(animationManifest.characters)) {
  for (const [movementId, sheet] of Object.entries(character.sheets)) {
    assert(imageSources.includes(sheet.src), `${characterId}/${movementId} should preload its own sheet`);
  }
}
assert(imageSources.includes("/assets/characters/rook/animations/reactions/body-hit/sheet.png"));
assert(imageSources.includes("/assets/characters/vex/animations/defense/high-guard/sheet.png"));

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
  [130, "KeyT"],
  [175, "KeyY"],
  [235, "KeyG"],
  [305, "KeyH"],
  [390, "KeyT"],
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

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const combatConfig = require("../combat-config.js");
const animationManifest = require("../animation-manifest.js");
const arenaMetadata = require("../public/assets/arenas/neon-octagon/arena.json");
const { OnlineMatchSimulation } = require("../online-simulation.cjs");

const markup = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const gameSource = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const onlineServerSource = fs.readFileSync(path.join(__dirname, "..", "server.cjs"), "utf8");
assert.match(markup, /pause-controls-grid/, "Pause menu should expose the complete controls");
assert.match(markup, /id="game-viewport" class="game-viewport"/, "Canvas and overlays should share one responsive viewport");
assert.match(markup, /WASD \+ TYGH/, "Pause menu should list Player 1 controls");
assert.match(markup, /FLECHAS \+ IOKL/, "Pause menu should list Player 2 controls");
assert.match(markup, /SPACE \/ SHIFT<\/kbd><span>mantener \+ cualquier golpe/, "Pause menu should explain the body modifier");
assert.match(markup, /combat-config\.js[\s\S]*animation-manifest\.js[\s\S]*game\.js/, "Shared combat config and animation manifest must load before the game");
assert.match(markup, /Tres asaltos de 3 minutos/, "Menu should explain round duration");
assert.match(markup, /data-menu-target="local"/, "Main menu should expose the local category");
assert.match(markup, /data-menu-target="online"/, "Main menu should expose the online category");
assert.match(markup, /data-menu-panel="local"[\s\S]*data-mode="cpu"[\s\S]*data-mode="practice"/, "Local category should contain local game modes");
assert.match(markup, /data-menu-panel="online"[\s\S]*data-mode="online"/, "Online category should contain online game modes");
assert.match(markup, /data-mode="practice"/, "Menu should expose practice mode");
assert.match(markup, /data-mode="online"/, "Menu should expose online mode");
assert.match(markup, /BUSCANDO PARTIDA AHORA MISMO/, "Online lobby should show live matchmaking presence");
assert.match(markup, /id="online-latency"[\s\S]*SERVER RTT/, "Online lobby should show server round-trip latency");
assert.match(markup, /id="online-connect-button"[\s\S]*CONECTAR/, "Online lobby should expose explicit connection state");
assert.match(markup, /id="online-outgoing-challenge"[\s\S]*RETO ENVIADO/, "Online lobby should show outgoing challenge state");
assert.match(markup, /id="result-scorecard"/, "Result screen should expose the per-round scorecard");
assert.match(markup, /online-client\.js[\s\S]*game\.js/, "Online client must load before the game");
assert.match(markup, /Sin reloj · daño visible por golpe/, "Practice mode should explain its damage display");
assert.match(markup, /brillante = stamina actual · tenue = límite recuperable/, "Pause menu should explain both stamina layers");
assert.equal(combatConfig.snapshotHz, 30, "Server snapshots should use a bandwidth-safe 30 Hz cadence");
assert.equal(combatConfig.simulationHz, 60, "The neutral server simulation should use a fixed 60 Hz step");
assert.equal(combatConfig.guardTransitionRate, 6, "Guard transitions should expose all ten frames at 60 Hz");
assert.equal(arenaMetadata.runtimeAsset, "/assets/arenas/neon-octagon/arena.png");
assert.deepEqual(arenaMetadata.viewport.effectiveSourceCrop, { x: 0, y: 56, width: 1536, height: 864 });
assert.deepEqual(
  [arenaMetadata.fighterLayout.rookSpawnX, arenaMetadata.fighterLayout.vexSpawnX, arenaMetadata.fighterLayout.floorY],
  [380, 900, 604],
  "Arena metadata should preserve the approved fighter composition",
);
assert.deepEqual(arenaMetadata.shadow.standingRadius, [76, 7], "Standing shadows should remain thin and grounded");
assert.equal(arenaMetadata.shadow.standingBaselineOffsetY, -7, "Standing shadows should compensate for sprite bottom padding");
assert.deepEqual(arenaMetadata.shadow.footContactOffsetsX, [-76, 62], "Each planted foot should have an independent contact shadow");
assert.equal(arenaMetadata.ambientAnimation.arenaBitmapFrames, 1, "The cage and floor must remain one fixed bitmap");
assert.equal(arenaMetadata.ambientAnimation.crowdBitmapFrames, 3, "The audience should expose three restrained motion states");
assert.equal(arenaMetadata.layers.crowd.transition, "smooth-crossfade", "Crowd frames should never hard-cut");
assert.equal(arenaMetadata.ambientAnimation.cycleSeconds, 10, "Ambient motion should remain slow but clearly visible");
assert(arenaMetadata.ambientAnimation.layers.includes("moving-light-beams"), "The arena should expose moving cage lighting");
assert(arenaMetadata.ambientAnimation.layers.includes("traveling-rail-pulses"), "The arena should expose visible rail motion");
assert.match(gameSource, /predictOnlineLocalInput/, "Both players should predict their own controls locally");
assert.match(gameSource, /reconcileGuardPresentation/, "Online guards should have a snapshot-safe presentation layer");
assert.match(gameSource, /queueOnlineSnapshot/, "The browser should coalesce snapshot bursts before rendering");
assert.match(onlineServerSource, /authority: "server"/, "The Node service should own authoritative match state");
assert.match(onlineServerSource, /const serializedPayload = JSON\.stringify\(payload\)/, "The server should serialize each shared snapshot only once");
assert.match(gameSource, /ONLINE_MAX_EXTRAPOLATION_SECONDS = 0\.2/, "Remote motion extrapolation should be bounded");
assert.match(gameSource, /sendOnlineInputNow/, "Guest controls should support immediate input delivery");
assert.match(onlineServerSource, /MAX_REALTIME_BUFFER_BYTES = 24 \* 1024/, "The relay should shed stale snapshots early");
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
  "#online-connect-button",
  "#online-presence",
  "#online-status",
  "#online-latency",
  "#online-latency-value",
  "#online-latency-quality",
  "#online-player-count",
  "#online-player-list",
  "#online-challenge",
  "#online-challenger-name",
  "#online-outgoing-challenge",
  "#online-outgoing-name",
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
const menuPanels = [
  new FakeElement({ menuPanel: "root" }),
  new FakeElement({ menuPanel: "local" }),
  new FakeElement({ menuPanel: "online" }),
];
menuPanels[1].classList.add("is-hidden");
menuPanels[2].classList.add("is-hidden");
const menuCategoryButtons = [
  new FakeElement({ menuTarget: "local" }),
  new FakeElement({ menuTarget: "online" }),
];
const menuBackButtons = [new FakeElement(), new FakeElement()];
const menuButtons = [new FakeElement(), new FakeElement()];
selectors.get("#menu-screen").dataset.menuSection = "root";
const windowListeners = new Map();
const animationFrames = [];
const imageSources = [];
const animationSheetsBySource = new Map(
  Object.values(animationManifest.characters).flatMap((character) => (
    Object.values(character.sheets).map((sheet) => [sheet.src, sheet])
  )),
);
animationSheetsBySource.set(arenaMetadata.runtimeAsset, {
  fallbackWidth: arenaMetadata.source.width,
  fallbackHeight: arenaMetadata.source.height,
});
animationSheetsBySource.set(arenaMetadata.layers.foreground, {
  fallbackWidth: arenaMetadata.source.width,
  fallbackHeight: arenaMetadata.source.height,
});
for (const crowdFrame of arenaMetadata.layers.crowd.frames) {
  animationSheetsBySource.set(crowdFrame, {
    fallbackWidth: arenaMetadata.source.width,
    fallbackHeight: arenaMetadata.source.height,
  });
}

global.document = {
  fullscreenElement: null,
  hidden: false,
  querySelector(selector) {
    assert(selectors.has(selector), `Missing fake element for ${selector}`);
    return selectors.get(selector);
  },
  querySelectorAll(selector) {
    if (selector === "[data-mode]") return modeButtons;
    if (selector === "[data-menu-panel]") return menuPanels;
    if (selector === "[data-menu-target]") return menuCategoryButtons;
    if (selector === "[data-menu-back]") return menuBackButtons;
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

const { game, ATTACKS, getHudHealthState } = require("../game.js");

assert.equal(getHudHealthState(100).tier, "stable", "Healthy fighters should show a calm status icon");
assert.equal(getHudHealthState(69).tier, "worn", "Moderate damage should turn the status icon yellow");
assert.equal(getHudHealthState(44).tier, "danger", "Heavy damage should turn the status icon orange");
assert.equal(getHudHealthState(19).tier, "critical", "Critical damage should turn the status icon red");
assert.equal(getHudHealthState(Number.NaN).tier, "critical", "Invalid health must fail safely as critical");

for (const [attackId, serverDefinition] of Object.entries(combatConfig.attacks)) {
  for (const [field, value] of Object.entries(serverDefinition)) {
    assert.equal(
      ATTACKS[attackId][field],
      value,
      `${attackId}.${field} must share one browser/server combat definition`,
    );
  }
}

const dispatchWindowKey = (type, code) => {
  for (const listener of windowListeners.get(type) || []) {
    listener({ code, repeat: false, preventDefault() {} });
  }
};
game.mode = "online";
game.onlineRole = "player2";
dispatchWindowKey("keydown", "KeyA");
assert.equal(game.getOnlineKeyboardInput().move, -1, "Online A must always send screen-left movement");
dispatchWindowKey("keyup", "KeyA");
dispatchWindowKey("keydown", "KeyD");
assert.equal(game.getOnlineKeyboardInput().move, 1, "Online D must always send screen-right movement");
dispatchWindowKey("keyup", "KeyD");

game.fighterOne.resetRound(380, 1);
game.fighterTwo.resetRound(900, -1);
game.online = { latencyMs: 160, jitterMs: 18 };
game.state = "fighting";

game.predictOnlineLocalInput({
  ...game.emptyInput(),
  leftPunch: true,
}, 43);
assert.equal(game.fighterTwo.attack.type, "leftPunchHead", "A guest strike should animate immediately");
assert.equal(game.onlinePredictedAttack.sequence, 43, "Predicted strikes must retain their input sequence");
game.onlinePredictedAttack.elapsed = 0.18;
game.onlineLastAcknowledgedInput = 43;
game.reconcilePredictedAttack({
  ...game.onlinePredictedAttack.attack,
  elapsed: 0.04,
});
assert(
  game.fighterTwo.attack.elapsed >= 0.18,
  "An authoritative snapshot must not rewind a predicted strike animation",
);
game.reconcilePredictedAttack(null);
assert.equal(game.onlinePredictedAttack, null, "A completed host strike should clear its prediction");
assert.equal(game.fighterTwo.attack, null, "Host completion should not leave a phantom strike");

game.predictOnlineLocalInput({
  ...game.emptyInput(),
  rightPunch: true,
}, 44);
game.fighterTwo.stun = 0.2;
game.reconcilePredictedAttack(null);
assert.equal(game.onlinePredictedAttack, null, "Authoritative stun should cancel an invalid prediction");
assert.equal(game.fighterTwo.attack, null, "A cancelled prediction should not leave a phantom strike");
game.fighterTwo.stun = 0;

game.fighterTwo.x = 900;
game.fighterTwo.velocityX = 0;
game.onlinePositionTargets.fighterTwo = null;
dispatchWindowKey("keydown", "KeyA");
game.updateOnlineLocalPrediction(1 / 60);
dispatchWindowKey("keyup", "KeyA");
assert(game.fighterTwo.x < 900, "The challenged player should see advancing movement immediately");

game.fighterTwo.x = 900;
game.fighterTwo.velocityX = 0;
game.onlinePositionTargets.fighterTwo = { x: 850, velocityX: 0, age: 0 };
game.onlineLastControlChangeSequence = 50;
game.onlineLastAcknowledgedInput = 49;
game.updateOnlineLocalPrediction(1 / 60);
assert.equal(
  game.fighterTwo.x,
  900,
  "A stale snapshot must not pull against a newer local direction change",
);
game.onlineLastAcknowledgedInput = 50;
game.updateOnlineLocalPrediction(1 / 60);
assert(
  game.fighterTwo.x < 900 && game.fighterTwo.x > 850,
  "Guest reconciliation should correct position smoothly instead of teleporting",
);

game.onlineRole = "player1";
game.fighterOne.resetRound(380, 1);
game.fighterTwo.resetRound(900, -1);
game.state = "fighting";
game.onlinePredictedAttack = null;
dispatchWindowKey("keydown", "KeyD");
game.updateOnlineLocalPrediction(1 / 60);
dispatchWindowKey("keyup", "KeyD");
assert(game.fighterOne.x > 380, "The challenger should see its advancing movement immediately");
game.fighterOne.x = 380;
game.fighterOne.velocityX = 0;
game.predictOnlineLocalInput({ ...game.emptyInput(), rightPunch: true }, 51);
assert.equal(game.fighterOne.attack.type, "rightPunchHead", "The challenger should use the same local prediction path");
game.onlinePredictedAttack = null;
game.fighterOne.attack = null;

const neutralSnapshot = new OnlineMatchSimulation().snapshot();
neutralSnapshot.inputAcknowledgements = { player1: 51, player2: 44 };
game.onlineLastSnapshot = -1;
game.onlineLastAcknowledgedInput = 0;
game.applyOnlineSnapshot({ sequence: 1, snapshot: neutralSnapshot });
assert.equal(game.onlineLastAcknowledgedInput, 51, "Rook should consume its own server acknowledgement");
game.onlineRole = "player2";
game.onlineLastSnapshot = -1;
game.onlineLastAcknowledgedInput = 0;
game.applyOnlineSnapshot({ sequence: 1, snapshot: neutralSnapshot });
assert.equal(game.onlineLastAcknowledgedInput, 44, "Vex should consume its own server acknowledgement");

game.onlineRole = "player1";
game.mode = "online";
game.state = "fighting";
game.onlinePredictedAttack = null;
game.onlineLastSnapshot = 1;
game.fighterOne.guard = "high";
game.fighterOne.guardVisual = "high";
game.fighterOne.guardBlend = 0.8;
dispatchWindowKey("keydown", "KeyW");
const staleGuardSnapshot = new OnlineMatchSimulation().snapshot();
staleGuardSnapshot.state = "fighting";
staleGuardSnapshot.fighterOne.guard = null;
staleGuardSnapshot.fighterOne.guardVisual = null;
staleGuardSnapshot.fighterOne.guardBlend = 0;
game.applyOnlineSnapshot({ sequence: 2, snapshot: staleGuardSnapshot });
assert.equal(game.fighterOne.guard, "high", "A stale snapshot must not drop the locally held guard");
assert.equal(game.fighterOne.guardBlend, 0.8, "A stale snapshot must not rewind the local guard animation");

game.fighterOne.guardBlend = 1;
dispatchWindowKey("keyup", "KeyW");
staleGuardSnapshot.fighterOne.guard = "high";
staleGuardSnapshot.fighterOne.guardVisual = "high";
staleGuardSnapshot.fighterOne.guardBlend = 0.4;
game.applyOnlineSnapshot({ sequence: 3, snapshot: staleGuardSnapshot });
assert.equal(game.fighterOne.guard, null, "A stale snapshot must not re-raise a locally released guard");
assert.equal(game.fighterOne.guardBlend, 1, "Guard release should continue from the visible pose without jumping");
game.updateOnlineLocalPrediction(1 / 60);
assert(game.fighterOne.guardBlend < 1 && game.fighterOne.guardBlend > 0, "Guard release should animate smoothly");

const completedAttack = {
  type: "leftPunchHead",
  elapsed: 0.34,
  connected: false,
  inefficientPenaltyApplied: false,
  facing: 1,
  stationaryStart: true,
};
game.fighterOne.attack = null;
game.fighterOne.guard = "high";
game.fighterOne.guardVisual = "high";
game.fighterOne.guardBlend = 0.6;
game.onlinePredictedAttack = {
  sequence: 70,
  type: "leftPunchHead",
  attack: completedAttack,
  elapsed: 0.34,
  totalDuration: 0.34,
  completed: true,
  acknowledged: true,
  acknowledgedElapsed: 0.2,
  authoritySeen: true,
};
dispatchWindowKey("keydown", "KeyW");
const delayedRecoverySnapshot = new OnlineMatchSimulation().snapshot();
delayedRecoverySnapshot.state = "fighting";
delayedRecoverySnapshot.inputAcknowledgements.player1 = 70;
delayedRecoverySnapshot.fighterOne.attack = { ...completedAttack, elapsed: 0.25 };
delayedRecoverySnapshot.fighterOne.guard = null;
delayedRecoverySnapshot.fighterOne.guardVisual = null;
delayedRecoverySnapshot.fighterOne.guardBlend = 0;
game.onlineLastSnapshot = 9;
game.applyOnlineSnapshot({ sequence: 10, snapshot: delayedRecoverySnapshot });
assert.equal(game.fighterOne.attack, null, "A delayed recovery snapshot must not replay a completed strike");
assert.equal(game.fighterOne.guard, "high", "Guard should resume immediately after the predicted strike completes");
assert.equal(game.fighterOne.guardBlend, 0.6, "Strike recovery snapshots must not restart the guard transition");
dispatchWindowKey("keyup", "KeyW");
game.onlinePredictedAttack = null;

const queuedOlder = { sequence: 11, snapshot: staleGuardSnapshot };
const queuedNewer = { sequence: 12, snapshot: staleGuardSnapshot };
game.onlinePendingSnapshot = null;
game.queueOnlineSnapshot(queuedNewer);
game.queueOnlineSnapshot(queuedOlder);
assert.equal(game.onlinePendingSnapshot.sequence, 12, "Snapshot bursts should retain only the newest state");
game.onlinePendingSnapshot = null;

game.onlineRole = null;
game.mode = "cpu";
game.state = "menu";

const safeReplicaX = game.fighterTwo.x;
game.applyFighterSnapshot(game.fighterTwo, {
  x: null,
  facing: null,
  attack: { type: "missingAttack", elapsed: null },
  knockdownAnimation: "missingAnimation",
  finishAnimation: { animation: "missingAnimation", elapsed: null, duration: null },
});
assert.equal(game.fighterTwo.x, safeReplicaX, "Invalid snapshot coordinates must not move a replica off canvas");
assert.equal(game.fighterTwo.facing, -1, "Invalid right-side facing must recover to the canonical orientation");
assert.equal(game.fighterTwo.attack, null, "Unknown remote attacks must not break rendering");
assert.equal(game.fighterTwo.finishAnimation, null, "Unknown remote finish animations must be discarded");
assert.doesNotThrow(
  () => game.fighterTwo.draw(context, { animation: "missingAnimation", frame: Number.NaN, facing: 0 }),
  "A malformed visual state must fall back to an idle sprite instead of hiding the fighter",
);

game.handleOnlineWelcome({ name: "Johan" });
assert.equal(selectors.get("#online-status").textContent, "CONECTADO // JOHAN");
assert.equal(selectors.get("#online-connect-button").textContent, "CONECTADO");
assert.equal(selectors.get("#online-connect-button").disabled, true);
game.showOutgoingChallenge({ name: "Friend" });
assert.equal(selectors.get("#online-outgoing-name").textContent, "Friend");
assert.equal(selectors.get("#online-outgoing-challenge").classList.contains("is-hidden"), false);
assert.match(selectors.get("#online-status").textContent, /RETO ENVIADO A FRIEND/);
game.handleChallengeDeclined({ name: "Friend" });
assert.equal(selectors.get("#online-outgoing-challenge").classList.contains("is-hidden"), true);

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
assert.match(gameSource, /drawHealthStatusIcon\(context, "head"/, "HUD should represent head health with an icon");
assert.match(gameSource, /drawHealthStatusIcon\(context, "body"/, "HUD should represent body health with an icon");
assert.match(gameSource, /traceRoundedRect\(context, panelX, panelY, panelWidth, panelHeight, 15\)/, "Fighter HUD panels should use clean rounded geometry");
assert.match(gameSource, /context\.arc\(centerX, centerY, 22/, "Health status badges should use circular illustrated geometry");
assert.doesNotMatch(gameSource, /this\.drawBar\(context[\s\S]{0,120}displayHead/, "HUD should not expose a direct head-health bar");
assert.doesNotMatch(gameSource, /this\.drawBar\(context[\s\S]{0,120}displayBody/, "HUD should not expose a direct body-health bar");
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
assert.equal(menuCategoryButtons[0].listeners.has("click"), true, "Local category should be interactive");
assert.equal(menuCategoryButtons[1].listeners.has("click"), true, "Online category should be interactive");
menuCategoryButtons[0].dispatch("click");
assert.equal(selectors.get("#menu-screen").dataset.menuSection, "local");
assert.equal(menuPanels[0].classList.contains("is-hidden"), true, "Opening Local should hide category selection");
assert.equal(menuPanels[1].classList.contains("is-hidden"), false, "Opening Local should show local modes");
menuBackButtons[0].dispatch("click");
assert.equal(selectors.get("#menu-screen").dataset.menuSection, "root");
assert.equal(modeButtons[0].listeners.has("click"), true, "CPU mode should be interactive");
assert.equal(modeButtons[2].listeners.has("click"), true, "Practice mode should be interactive");
assert.equal(imageSources.length, 71, "The layered arena and all 33 movements for both fighters should preload");
assert(imageSources.includes(arenaMetadata.runtimeAsset), "The approved arena plate should preload");
assert(imageSources.includes(arenaMetadata.layers.foreground), "The fixed transparent arena layer should preload");
for (const crowdFrame of arenaMetadata.layers.crowd.frames) {
  assert(imageSources.includes(crowdFrame), `${crowdFrame} should preload`);
}
assert.match(gameSource, /ARENA_VERTICAL_CROP_ANCHOR = 0\.35/, "Arena crop should preserve the approved composition");
assert.match(gameSource, /drawFighterShadow\(context, drawX, drawY, scale, facing\)/, "Every fighter should render a mirrored contact shadow");
assert.match(gameSource, /shadowY = drawY \+ \(groundedOutcome \? 2 : -7\)/, "Standing shadows should touch the visible feet");
assert.match(gameSource, /footContactOffsets = \[-76, 62\]/, "Standing fighters should use two foot contact points");
assert.match(gameSource, /Math\.min\(2, \(cssWidth \* deviceScale\) \/ WIDTH\)/, "Canvas resolution should adapt to high-density screens");
assert.match(stylesSource, /container: game \/ inline-size/, "All overlays should respond to the rendered game viewport");
assert.match(stylesSource, /@container game \(max-width: 1000px\)/, "Medium game viewports should use compact menus");
assert.match(stylesSource, /@container game \(max-width: 720px\)/, "Small game viewports should use single-column menus");
assert.match(stylesSource, /@container game \(max-width: 520px\)/, "Extra-small game viewports should preserve usable dialogs");
assert.doesNotMatch(stylesSource, /\.game-viewport::before/, "The disconnected upper-left corner bracket should be removed");
assert.doesNotMatch(stylesSource, /\.game-viewport::after/, "The disconnected lower-right corner bracket should be removed");
assert.match(gameSource, /drawArenaAmbience\(context\)/, "The octagon should render a lightweight ambient pass");
assert.match(gameSource, /ARENA_CROWD_FRAME_SECONDS = 1\.8/, "Crowd motion should use slow transitions");
assert.match(gameSource, /smoothMix = linearMix \* linearMix \* \(3 - 2 \* linearMix\)/, "Crowd frames should crossfade without brightness jumps");
assert.match(gameSource, /drawArenaCrowd\(context\)[\s\S]*drawArenaLayer\(context, arenaForegroundImage\)/, "The fixed arena should render over the changing crowd");
assert.doesNotMatch(
  gameSource,
  /traceRoundedRect\(context, x, y - 6, width, height \+ 12, 10\)/,
  "Stamina bars should not retain the heavy outer capsule",
);
assert.match(gameSource, /ARENA_AMBIENT_CYCLE_SECONDS = 10/, "The ambient lighting cycle should be visible without becoming distracting");
assert.match(gameSource, /globalCompositeOperation = "screen"/, "Ambient light should blend without replacing the arena image");
assert.match(gameSource, /drawLightBeam\(242, 430/, "The crowd should receive visible cyan and magenta light beams");
assert.match(gameSource, /railPulseX/, "The upper rail should receive a traveling highlight");
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

const sendKey = dispatchWindowKey;

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

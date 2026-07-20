(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const shell = document.querySelector("#game-shell");
  const menuScreen = document.querySelector("#menu-screen");
  const pauseScreen = document.querySelector("#pause-screen");
  const resultScreen = document.querySelector("#result-screen");
  const roundMessage = document.querySelector("#round-message");
  const roundKicker = document.querySelector("#round-kicker");
  const roundTitle = document.querySelector("#round-title");
  const resultKicker = document.querySelector("#result-kicker");
  const resultTitle = document.querySelector("#result-title");
  const resultCopy = document.querySelector("#result-copy");
  const resultScorecard = document.querySelector("#result-scorecard");
  const rematchButton = document.querySelector("#rematch-button");
  const combatControls = document.querySelector("#combat-controls");
  const soundButton = document.querySelector("#sound-button");
  const soundIcon = document.querySelector("#sound-icon");
  const onlineScreen = document.querySelector("#online-screen");
  const onlineConnectForm = document.querySelector("#online-connect-form");
  const onlineNameInput = document.querySelector("#online-name");
  const onlineConnectButton = document.querySelector("#online-connect-button");
  const onlinePresence = document.querySelector("#online-presence");
  const onlineStatus = document.querySelector("#online-status");
  const onlineLatency = document.querySelector("#online-latency");
  const onlineLatencyValue = document.querySelector("#online-latency-value");
  const onlineLatencyQuality = document.querySelector("#online-latency-quality");
  const onlinePlayerCount = document.querySelector("#online-player-count");
  const onlinePlayerList = document.querySelector("#online-player-list");
  const onlineChallenge = document.querySelector("#online-challenge");
  const onlineChallengerName = document.querySelector("#online-challenger-name");
  const onlineOutgoingChallenge = document.querySelector("#online-outgoing-challenge");
  const onlineOutgoingName = document.querySelector("#online-outgoing-name");
  const onlineAccept = document.querySelector("#online-accept");
  const onlineDecline = document.querySelector("#online-decline");
  const onlineBack = document.querySelector("#online-back");
  const menuPanels = [...document.querySelectorAll("[data-menu-panel]")];

  const WIDTH = 1280;
  const HEIGHT = 720;
  let canvasRenderScale = 1;
  const syncCanvasResolution = () => {
    const measuredWidth = canvas.getBoundingClientRect?.().width;
    const cssWidth = Number.isFinite(measuredWidth) && measuredWidth > 0 ? measuredWidth : WIDTH;
    const deviceScale = Number.isFinite(globalThis.devicePixelRatio)
      ? globalThis.devicePixelRatio
      : 1;
    const nextScale = Math.max(1, Math.min(2, (cssWidth * deviceScale) / WIDTH));
    const backingWidth = Math.round(WIDTH * nextScale);
    const backingHeight = Math.round(HEIGHT * nextScale);
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }
    canvasRenderScale = nextScale;
  };
  syncCanvasResolution();
  const FLOOR = 604;
  const COMBAT_CONFIG = globalThis.NEON_BRAWL_COMBAT_CONFIG;
  if (!COMBAT_CONFIG) throw new Error("Combat config must load before game.js");
  const GAMEPLAY_RULES = COMBAT_CONFIG.gameplayRules;
  const COMBAT_ATTACKS = COMBAT_CONFIG.attacks;

  const ROUND_TIME = GAMEPLAY_RULES.roundTimeSeconds;
  const MAX_ROUNDS = COMBAT_CONFIG.maxRounds;
  const ONLINE_SNAPSHOT_INTERVAL = 1 / COMBAT_CONFIG.snapshotHz;
  const ONLINE_INPUT_INTERVAL = 1 / 60;
  const ONLINE_MAX_EXTRAPOLATION_SECONDS = 0.2;
  const ONLINE_MAX_ANIMATION_FAST_FORWARD_SECONDS = 0.08;
  const ONLINE_REMOTE_SMOOTHING_RATE = 24;
  const ONLINE_LOCAL_RECONCILIATION_RATE = 7;
  const GUARD_TRANSITION_RATE = COMBAT_CONFIG.guardTransitionRate;
  const IDLE_STANCE_CYCLE_SECONDS = 1.8;
  const FOOTWORK_ANIMATION_FPS = 11;
  const GUARD_FOOTWORK_ANIMATION_FPS = 10;
  const LOCOMOTION_SPEED_THRESHOLD = 18;
  const STAGE_LEFT = 105;
  const STAGE_RIGHT = WIDTH - 105;
  const FEATURES = Object.freeze({
    takedowns: false,
  });
  const ONLINE_LATENCY_LABELS = Object.freeze({
    unknown: "SIN MEDIR",
    excellent: "EXCELENTE",
    good: "BUENA",
    fair: "MEDIA",
    high: "ALTA",
  });
  const ONLINE_LATENCY_COLORS = Object.freeze({
    unknown: "#55576b",
    excellent: "#d6ff7d",
    good: "#35f2e5",
    fair: "#ffc35b",
    high: "#ff3b9d",
  });
  const HUD_HEALTH_STATES = Object.freeze([
    Object.freeze({ minimum: 70, tier: "stable", color: "#70f6d3", glow: 7 }),
    Object.freeze({ minimum: 45, tier: "worn", color: "#ffd65a", glow: 9 }),
    Object.freeze({ minimum: 20, tier: "danger", color: "#ff9d4d", glow: 12 }),
    Object.freeze({ minimum: 0, tier: "critical", color: "#ff405f", glow: 18 }),
  ]);

  const getHudHealthState = (health) => {
    const safeHealth = clamp(Number.isFinite(health) ? health : 0, 0, 100);
    return HUD_HEALTH_STATES.find((state) => safeHealth >= state.minimum)
      ?? HUD_HEALTH_STATES.at(-1);
  };
  const ARENA_FOREGROUND_SRC = "/assets/arenas/neon-octagon/arena-foreground-v2.png";
  const ARENA_CROWD_FRAME_SRCS = Object.freeze([
    "/assets/arenas/neon-octagon/crowd/frame-01.webp",
    "/assets/arenas/neon-octagon/crowd/frame-02.webp",
    "/assets/arenas/neon-octagon/crowd/frame-03.webp",
  ]);
  const ARENA_VERTICAL_CROP_ANCHOR = 0.35;
  const ARENA_CROWD_FRAME_SECONDS = 0.7;
  const ARENA_CROWD_BLEND_FRACTION = 0.35;
  const ARENA_REDUCED_MOTION = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  const ANIMATION_MANIFEST = globalThis.NEON_BRAWL_ANIMATIONS;
  if (!ANIMATION_MANIFEST) {
    throw new Error("Animation manifest must load before game.js");
  }
  const arenaForegroundImage = new Image();
  arenaForegroundImage.src = ARENA_FOREGROUND_SRC;
  const arenaCrowdImages = ARENA_CROWD_FRAME_SRCS.map((source) => {
    const image = new Image();
    image.src = source;
    return image;
  });

  function animationSheet({ src, columns, rows, frames, fallbackWidth, fallbackHeight }) {
    const image = new Image();
    image.src = src;
    return { image, columns, rows, frames, fallbackWidth, fallbackHeight };
  }

  const ANIMATIONS = Object.fromEntries(
    Object.entries(ANIMATION_MANIFEST.characters).map(([characterId, character]) => [
      characterId,
      Object.fromEntries(
        Object.entries(character.sheets)
          .map(([id, definition]) => [id, animationSheet(definition)]),
      ),
    ]),
  );
  const KNOCKDOWN_VARIANTS = Object.freeze({
    head: Object.freeze([
      "headKnockdown",
      "headKnockdownForward",
      "headKnockdownSeated",
      "headKnockdownShoulderRoll",
      "headKnockdownKneeDrop",
    ]),
    body: Object.freeze([
      "bodyKnockdown",
      "bodyKnockdownKneel",
      "bodyKnockdownSeated",
      "bodyKnockdownElbowFold",
      "bodyKnockdownThreePoint",
    ]),
  });
  const KNOCKOUT_VARIANTS = Object.freeze({
    head: Object.freeze([
      "headKnockout",
      "headKnockoutProne",
      "headKnockoutSide",
      "headKnockoutKneeCollapse",
    ]),
    body: Object.freeze([
      "bodyKnockout",
      "bodyKnockoutProne",
      "bodyKnockoutSupine",
      "bodyKnockoutSeatedSlump",
    ]),
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const random = (min, max) => Math.random() * (max - min) + min;
  const isFacing = (value) => value === -1 || value === 1;

  const emptyRoundStats = () => ({
    thrown: 0,
    landed: 0,
    missed: 0,
    blocked: 0,
    critical: 0,
    headLanded: 0,
    bodyLanded: 0,
  });

  const ONLINE_FIGHTER_FIELDS = Object.freeze([
    "x", "facing", "velocityX", "headHealth", "bodyHealth", "displayHead", "displayBody",
    "stamina", "longTermStamina", "displayStamina", "displayStaminaCap", "attack", "guard",
    "guardBlend", "guardVisual", "stun", "evadeTimer", "evadeCooldown", "invulnerable",
    "knockdownTimer", "knockdownDuration", "knockdownTarget", "knockdownAnimation",
    "finishAnimation", "roundDamage", "takedowns", "knockdownsScored", "knockdownsSuffered",
    "moveFlash", "impactMarker", "hitReaction", "blockReaction", "animationTime", "roundWins",
    "matchScore", "roundStats", "practiceResetTimer",
  ]);
  const ONLINE_NUMERIC_FIGHTER_FIELDS = new Set([
    "x", "velocityX", "headHealth", "bodyHealth", "displayHead", "displayBody",
    "stamina", "longTermStamina", "displayStamina", "displayStaminaCap", "guardBlend",
    "stun", "evadeTimer", "evadeCooldown", "invulnerable", "knockdownTimer",
    "knockdownDuration", "roundDamage", "takedowns", "knockdownsScored",
    "knockdownsSuffered", "moveFlash", "animationTime", "roundWins", "matchScore",
    "practiceResetTimer",
  ]);

  function strikeAnimation(id) {
    const movement = ANIMATION_MANIFEST.strikes[id];
    if (!movement) throw new Error(`Unknown strike animation: ${id}`);
    return {
      animation: movement.sheet,
      frameOffset: 0,
      frameCount: movement.frameCount,
      contactFrame: movement.contactFrame - 1,
    };
  }

  function circleHitsEllipse(point, radius, zone) {
    const normalizedX = (point.x - zone.x) / (zone.radiusX + radius);
    const normalizedY = (point.y - zone.y) / (zone.radiusY + radius);
    return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  }

  const ATTACKS = {
    leftPunchHead: {
      label: "LEFT PUNCH // HEAD",
      ...strikeAnimation("leftPunchHead"),
      target: "head",
      startup: 0.09,
      active: 0.07,
      recovery: 0.18,
      damage: 6,
      stamina: 5,
      reach: 122,
      idealRange: 91,
      stun: 0.11,
      knockback: 38,
      strikeRadius: 19,
      strikePath: [
        { x: 23, y: -244 }, { x: 34, y: -246 }, { x: 50, y: -248 },
        { x: 76, y: -250 }, { x: 105, y: -251 }, { x: 132, y: -252 },
        { x: 125, y: -251 }, { x: 84, y: -248 }, { x: 48, y: -246 }, { x: 24, y: -244 },
      ],
      ...COMBAT_ATTACKS.leftPunchHead,
    },
    rightPunchHead: {
      label: "RIGHT PUNCH // HEAD",
      ...strikeAnimation("rightPunchHead"),
      target: "head",
      startup: 0.14,
      active: 0.08,
      recovery: 0.25,
      damage: 11,
      stamina: 10,
      reach: 140,
      idealRange: 108,
      stun: 0.2,
      knockback: 68,
      strikeRadius: 21,
      strikePath: [
        { x: 20, y: -235 }, { x: 32, y: -236 }, { x: 52, y: -237 },
        { x: 82, y: -239 }, { x: 122, y: -240 }, { x: 160, y: -241 },
        { x: 150, y: -240 }, { x: 96, y: -238 }, { x: 51, y: -236 }, { x: 21, y: -235 },
      ],
      ...COMBAT_ATTACKS.rightPunchHead,
    },
    leftPunchBody: {
      label: "LEFT PUNCH // BODY",
      ...strikeAnimation("leftPunchBody"),
      target: "body",
      startup: 0.11,
      active: 0.08,
      recovery: 0.2,
      damage: 8,
      stamina: 7,
      reach: 116,
      idealRange: 84,
      stun: 0.14,
      knockback: 44,
      strikeRadius: 20,
      strikePath: [
        { x: 20, y: -220 }, { x: 30, y: -202 }, { x: 48, y: -178 },
        { x: 76, y: -154 }, { x: 116, y: -138 }, { x: 151, y: -131 },
        { x: 141, y: -134 }, { x: 92, y: -157 }, { x: 48, y: -190 }, { x: 21, y: -220 },
      ],
      ...COMBAT_ATTACKS.leftPunchBody,
    },
    rightPunchBody: {
      label: "RIGHT PUNCH // BODY",
      ...strikeAnimation("rightPunchBody"),
      target: "body",
      startup: 0.16,
      active: 0.08,
      recovery: 0.26,
      damage: 12,
      stamina: 11,
      reach: 132,
      idealRange: 101,
      stun: 0.22,
      knockback: 70,
      strikeRadius: 22,
      strikePath: [
        { x: 18, y: -218 }, { x: 29, y: -202 }, { x: 47, y: -181 },
        { x: 70, y: -160 }, { x: 98, y: -147 }, { x: 122, y: -142 },
        { x: 119, y: -143 }, { x: 82, y: -162 }, { x: 45, y: -192 }, { x: 19, y: -218 },
      ],
      ...COMBAT_ATTACKS.rightPunchBody,
    },
    leftKickHead: {
      label: "LEFT KICK // HEAD",
      ...strikeAnimation("leftKickHead"),
      target: "head",
      startup: 0.24,
      active: 0.1,
      recovery: 0.39,
      damage: 17,
      stamina: 20,
      reach: 180,
      idealRange: 148,
      stun: 0.3,
      knockback: 108,
      heavy: true,
      strikeRadius: 28,
      strikePath: [
        { x: 4, y: -40 }, { x: 28, y: -95 }, { x: 88, y: -184 },
        { x: 161, y: -257 }, { x: 151, y: -250 }, { x: 124, y: -222 },
        { x: 91, y: -178 }, { x: 55, y: -124 }, { x: 25, y: -70 }, { x: 7, y: -40 },
      ],
      ...COMBAT_ATTACKS.leftKickHead,
    },
    rightKickHead: {
      label: "RIGHT KICK // HEAD",
      ...strikeAnimation("rightKickHead"),
      target: "head",
      startup: 0.29,
      active: 0.11,
      recovery: 0.46,
      damage: 21,
      stamina: 26,
      reach: 188,
      idealRange: 156,
      stun: 0.37,
      knockback: 132,
      heavy: true,
      strikeRadius: 30,
      strikePath: [
        { x: 3, y: -40 }, { x: 26, y: -94 }, { x: 82, y: -178 },
        { x: 149, y: -245 }, { x: 142, y: -240 }, { x: 118, y: -216 },
        { x: 87, y: -174 }, { x: 53, y: -121 }, { x: 24, y: -68 }, { x: 7, y: -40 },
      ],
      ...COMBAT_ATTACKS.rightKickHead,
    },
    leftKickBody: {
      label: "LEFT KICK // BODY",
      ...strikeAnimation("leftKickBody"),
      target: "body",
      startup: 0.21,
      active: 0.1,
      recovery: 0.34,
      damage: 14,
      stamina: 16,
      reach: 170,
      idealRange: 139,
      stun: 0.24,
      knockback: 84,
      strikeRadius: 27,
      strikePath: [
        { x: 5, y: -42 }, { x: 18, y: -70 }, { x: 42, y: -112 },
        { x: 76, y: -150 }, { x: 116, y: -177 }, { x: 147, y: -187 },
        { x: 139, y: -184 }, { x: 91, y: -154 }, { x: 40, y: -104 }, { x: 8, y: -42 },
      ],
      ...COMBAT_ATTACKS.leftKickBody,
    },
    rightKickBody: {
      label: "RIGHT KICK // BODY",
      ...strikeAnimation("rightKickBody"),
      target: "body",
      startup: 0.25,
      active: 0.1,
      recovery: 0.4,
      damage: 17,
      stamina: 20,
      reach: 178,
      idealRange: 146,
      stun: 0.29,
      knockback: 101,
      heavy: true,
      strikeRadius: 29,
      strikePath: [
        { x: 4, y: -42 }, { x: 18, y: -72 }, { x: 44, y: -118 },
        { x: 80, y: -160 }, { x: 124, y: -194 }, { x: 160, y: -205 },
        { x: 151, y: -201 }, { x: 97, y: -165 }, { x: 42, y: -108 }, { x: 8, y: -42 },
      ],
      ...COMBAT_ATTACKS.rightKickBody,
    },
    takedown: {
      label: "TAKEDOWN",
      animation: "legacyGround",
      legacyFrame: 7,
      target: "takedown",
      startup: 0.2,
      active: 0.15,
      recovery: 0.42,
      damage: 10,
      stamina: 20,
      reach: 106,
      idealRange: 68,
      stun: 0.2,
      knockback: 0,
      strikeRadius: 34,
      strikePath: [
        { x: 20, y: -70 }, { x: 45, y: -67 }, { x: 76, y: -64 },
        { x: 105, y: -62 }, { x: 70, y: -65 }, { x: 25, y: -69 },
      ],
    },
  };

  class Synth {
    constructor() {
      this.context = null;
      this.muted = false;
    }

    ensure() {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.context = new AudioContext();
      }
      if (this.context?.state === "suspended") this.context.resume();
    }

    tone(frequency, duration, type = "sine", volume = 0.03, endFrequency = frequency) {
      if (this.muted) return;
      this.ensure();
      if (!this.context) return;
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    }

    strike(blocked, heavy = false) {
      this.tone(blocked ? 210 : heavy ? 72 : 96, heavy ? 0.17 : 0.1, "square", heavy ? 0.05 : 0.035, 42);
      if (!blocked) this.tone(heavy ? 520 : 390, 0.055, "sawtooth", 0.018, 150);
    }

    takedown() {
      this.tone(105, 0.3, "sawtooth", 0.045, 42);
    }

    announce() {
      this.tone(190, 0.14, "square", 0.022, 380);
    }
  }

  class Particle {
    constructor({ x, y, color, velocityX = 0, velocityY = 0, life = 0.4, size = 5, kind = "spark" }) {
      this.x = x;
      this.y = y;
      this.color = color;
      this.velocityX = velocityX;
      this.velocityY = velocityY;
      this.life = life;
      this.maxLife = life;
      this.size = size;
      this.kind = kind;
    }

    update(deltaTime) {
      this.life -= deltaTime;
      this.x += this.velocityX * deltaTime;
      this.y += this.velocityY * deltaTime;
      this.velocityX *= Math.pow(0.07, deltaTime);
      if (this.kind === "spark") this.velocityY += 480 * deltaTime;
    }

    draw(context) {
      const alpha = clamp(this.life / this.maxLife, 0, 1);
      context.save();
      context.globalAlpha = alpha;
      context.strokeStyle = this.color;
      context.fillStyle = this.color;
      context.shadowColor = this.color;
      context.shadowBlur = 12;
      if (this.kind === "ring") {
        context.lineWidth = 2.5;
        context.beginPath();
        context.arc(this.x, this.y, this.size * (1 + (1 - alpha) * 3), 0, Math.PI * 2);
        context.stroke();
      } else if (this.kind === "dust") {
        context.globalAlpha = alpha * 0.25;
        context.beginPath();
        context.ellipse(this.x, this.y, this.size * (2 - alpha), this.size * 0.32, 0, 0, Math.PI * 2);
        context.fill();
      } else {
        context.lineWidth = Math.max(1, this.size * alpha * 0.45);
        context.beginPath();
        context.moveTo(this.x, this.y);
        context.lineTo(this.x - this.velocityX * 0.03, this.y - this.velocityY * 0.03);
        context.stroke();
      }
      context.restore();
    }
  }

  class Fighter {
    constructor(game, config) {
      this.game = game;
      this.characterId = config.characterId;
      if (!ANIMATIONS[this.characterId]) {
        throw new Error(`Unknown character sprite library: ${this.characterId}`);
      }
      this.name = config.name;
      this.style = config.style;
      this.color = config.color;
      this.accent = config.accent;
      this.player = config.player;
      this.roundWins = 0;
      this.matchScore = 0;
      this.animationTime = 0;
      this.longTermStamina = 100;
      this.resetRound(config.x, config.facing);
    }

    resetRound(x, facing) {
      this.x = x;
      this.facing = facing;
      this.velocityX = 0;
      this.headHealth = 100;
      this.bodyHealth = 100;
      this.displayHead = 100;
      this.displayBody = 100;
      this.stamina = this.maxStamina;
      this.displayStamina = this.stamina;
      this.displayStaminaCap = this.maxStamina;
      this.attack = null;
      this.guard = null;
      this.guardBlend = 0;
      this.guardVisual = null;
      this.stun = 0;
      this.evadeTimer = 0;
      this.evadeCooldown = 0;
      this.invulnerable = 0;
      this.knockdownTimer = 0;
      this.knockdownDuration = 0;
      this.knockdownTarget = "head";
      this.knockdownAnimation = "headKnockdown";
      this.finishAnimation = null;
      this.roundDamage = 0;
      this.roundStats = emptyRoundStats();
      this.takedowns = 0;
      this.knockdownsScored = 0;
      this.knockdownsSuffered = 0;
      this.moveFlash = 0;
      this.impactMarker = null;
      this.hitReaction = null;
      this.blockReaction = null;
      this.practiceResetTimer = 0;
    }

    getHurtZone(target) {
      if (target === "head") {
        return { x: this.x + this.facing * 2, y: FLOOR - 255, radiusX: 29, radiusY: 36 };
      }
      if (target === "takedown") {
        return { x: this.x, y: FLOOR - 62, radiusX: 48, radiusY: 58 };
      }
      return { x: this.x, y: FLOOR - 170, radiusX: 43, radiusY: 60 };
    }

    get currentAttack() {
      return this.attack ? ATTACKS[this.attack.type] : null;
    }

    get attackFacing() {
      return this.attack?.facing ?? this.facing;
    }

    get maxStamina() {
      return Math.min(this.longTermStamina, 55 + this.bodyHealth * 0.45);
    }

    resetMatchStamina() {
      this.longTermStamina = 100;
      this.stamina = 100;
      this.displayStamina = 100;
      this.displayStaminaCap = 100;
    }

    recoverBetweenRounds() {
      this.longTermStamina = clamp(
        this.longTermStamina + GAMEPLAY_RULES.cornerLongTermRecovery,
        GAMEPLAY_RULES.minLongTermStamina,
        100,
      );
    }

    spendStrikeStamina(baseCost, multiplier = GAMEPLAY_RULES.strikeStaminaScale) {
      const cost = baseCost * multiplier;
      this.stamina = Math.max(0, this.stamina - cost);

      const reserveRatio = this.stamina / Math.max(1, this.maxStamina);
      const fatiguePressure = reserveRatio < 0.35
        ? (0.35 - reserveRatio) / 0.35
        : 0;
      let longTermLoss = cost * 0.035;
      if (fatiguePressure > 0) longTermLoss += cost * (0.08 + fatiguePressure * 0.14);
      if (this.stamina <= 0.5) longTermLoss += 2.5;

      this.longTermStamina = clamp(
        this.longTermStamina - longTermLoss,
        GAMEPLAY_RULES.minLongTermStamina,
        100,
      );
      this.stamina = Math.min(this.stamina, this.maxStamina);
      return cost;
    }

    applyInefficientStrikePenalty(definition) {
      if (definition.target === "takedown" || this.attack?.inefficientPenaltyApplied) return 0;
      const penaltyMultiplier = Math.max(
        0,
        GAMEPLAY_RULES.inefficientStrikeStaminaScale - GAMEPLAY_RULES.strikeStaminaScale,
      );
      if (this.attack) this.attack.inefficientPenaltyApplied = true;
      return this.spendStrikeStamina(definition.stamina, penaltyMultiplier);
    }

    resetPracticeVitals() {
      this.headHealth = 100;
      this.bodyHealth = 100;
      this.displayHead = 100;
      this.displayBody = 100;
      this.resetMatchStamina();
      this.attack = null;
      this.guard = null;
      this.guardBlend = 0;
      this.guardVisual = null;
      this.stun = 0;
      this.velocityX = 0;
      this.hitReaction = null;
      this.blockReaction = null;
      this.impactMarker = null;
      this.finishAnimation = null;
      this.practiceResetTimer = 0;
    }

    updateVisualState(deltaTime) {
      this.animationTime += deltaTime;
      this.moveFlash = Math.max(0, this.moveFlash - deltaTime);
      if (this.hitReaction) {
        this.hitReaction.elapsed += deltaTime;
        if (this.hitReaction.elapsed >= this.hitReaction.duration) this.hitReaction = null;
      }
      if (this.blockReaction) {
        this.blockReaction.elapsed += deltaTime;
        if (this.blockReaction.elapsed >= this.blockReaction.duration) this.blockReaction = null;
      }
      if (this.impactMarker) {
        this.impactMarker.life -= deltaTime;
        if (this.impactMarker.life <= 0) this.impactMarker = null;
      }
      if (this.finishAnimation) {
        this.finishAnimation.elapsed = Math.min(
          this.finishAnimation.duration,
          this.finishAnimation.elapsed + deltaTime,
        );
      }
    }

    update(deltaTime, input, opponent) {
      this.updateVisualState(deltaTime);
      if (this.practiceResetTimer > 0) {
        this.practiceResetTimer = Math.max(0, this.practiceResetTimer - deltaTime);
        this.velocityX *= Math.pow(0.02, deltaTime);
        this.x = clamp(this.x + this.velocityX * deltaTime, STAGE_LEFT, STAGE_RIGHT);
        if (this.practiceResetTimer <= 0) this.resetPracticeVitals();
        return;
      }
      this.stun = Math.max(0, this.stun - deltaTime);
      this.evadeTimer = Math.max(0, this.evadeTimer - deltaTime);
      this.evadeCooldown = Math.max(0, this.evadeCooldown - deltaTime);
      this.invulnerable = Math.max(0, this.invulnerable - deltaTime);
      this.displayHead = lerp(this.displayHead, this.headHealth, 1 - Math.pow(0.00003, deltaTime));
      this.displayBody = lerp(this.displayBody, this.bodyHealth, 1 - Math.pow(0.00003, deltaTime));
      this.displayStamina = lerp(this.displayStamina, this.stamina, 1 - Math.pow(0.00008, deltaTime));
      this.displayStaminaCap = lerp(this.displayStaminaCap, this.maxStamina, 1 - Math.pow(0.00008, deltaTime));

      if (this.knockdownTimer > 0) {
        this.knockdownTimer -= deltaTime;
        this.velocityX *= Math.pow(0.02, deltaTime);
        this.x += this.velocityX * deltaTime;
        if (this.knockdownTimer <= 0) {
          this.headHealth = Math.max(this.headHealth, 10);
          this.bodyHealth = Math.max(this.bodyHealth, 8);
          this.stun = 0.4;
          this.knockdownDuration = 0;
          this.game.showCallout("BACK ON THE FEET", this.color, 0.8);
        }
        return;
      }

      if (!this.attack && this.stun <= 0 && this.evadeTimer <= 0 && Math.abs(opponent.x - this.x) > 4) {
        this.facing = opponent.x > this.x ? 1 : -1;
      }

      let nextGuard = null;
      if (!this.attack && this.stun <= 0 && this.evadeTimer <= 0) {
        if (input.guardHigh) nextGuard = "high";
        else if (input.guardLow) nextGuard = "low";
      }
      if (nextGuard && nextGuard !== this.guard) {
        this.guardBlend = 0;
        this.guardVisual = nextGuard;
      }
      this.guard = nextGuard;
      this.guardBlend = this.guard
        ? clamp(this.guardBlend + deltaTime * GUARD_TRANSITION_RATE, 0, 1)
        : clamp(this.guardBlend - deltaTime * GUARD_TRANSITION_RATE, 0, 1);

      if (!this.attack && this.stun <= 0 && this.evadeTimer <= 0) {
        const shortTermRatio = this.stamina / Math.max(1, this.maxStamina);
        const longTermRatio = this.maxStamina / 100;
        const movementPenalty = 0.62 + shortTermRatio * 0.28 + longTermRatio * 0.1;
        const targetVelocity = this.guard ? input.move * 105 : input.move * 260 * movementPenalty;
        this.velocityX = lerp(this.velocityX, targetVelocity, 1 - Math.pow(0.001, deltaTime));

        if (input.evade && this.evadeCooldown <= 0 && this.stamina >= 10) {
          this.startEvade(opponent);
        } else if (opponent.knockdownTimer > 0) {
          // Standing strikes pause until the knockdown recovery finishes.
        } else if (FEATURES.takedowns && input.takedown) {
          this.startAttack("takedown");
        } else if (input.rightKick) {
          this.startAttack(input.bodyModifier ? "rightKickBody" : "rightKickHead");
        } else if (input.leftKick) {
          this.startAttack(input.bodyModifier ? "leftKickBody" : "leftKickHead");
        } else if (input.rightPunch) {
          this.startAttack(input.bodyModifier ? "rightPunchBody" : "rightPunchHead");
        } else if (input.leftPunch) {
          this.startAttack(input.bodyModifier ? "leftPunchBody" : "leftPunchHead");
        }
      } else if (this.attack) {
        this.velocityX *= Math.pow(0.008, deltaTime);
        this.updateAttack(deltaTime, opponent);
      } else if (this.evadeTimer > 0) {
        this.velocityX *= Math.pow(0.3, deltaTime);
      } else {
        this.velocityX *= Math.pow(0.05, deltaTime);
      }

      this.x += this.velocityX * deltaTime;
      this.x = clamp(this.x, STAGE_LEFT, STAGE_RIGHT);

      const regenRate = this.attack ? 1.5 : this.guard ? 4 : this.evadeTimer > 0 ? 0.75 : 14;
      const enduranceRecovery = 0.62 + (this.maxStamina / 100) * 0.38;
      this.stamina = clamp(this.stamina + regenRate * enduranceRecovery * deltaTime, 0, this.maxStamina);
    }

    startEvade(opponent) {
      const away = opponent.x > this.x ? -1 : 1;
      this.stamina -= 10;
      this.evadeTimer = 0.26;
      this.invulnerable = 0.19;
      this.evadeCooldown = 0.55;
      this.velocityX = away * 480;
      this.game.showCallout("EVADE", this.color, 0.35);
      this.game.spawnDust(this.x, FLOOR, this.color, 7);
    }

    startAttack(type) {
      const definition = ATTACKS[type];
      if (this.attack || this.stun > 0 || this.evadeTimer > 0) return;
      const staminaCost = definition.target === "takedown"
        ? definition.stamina
        : definition.stamina * GAMEPLAY_RULES.strikeStaminaScale;
      if (this.stamina < staminaCost) {
        this.game.showCallout("LOW STAMINA", "#ffb35c", 0.45);
        this.game.synth.tone(90, 0.07, "square", 0.012, 65);
        return;
      }
      const stationaryStart = Math.abs(this.velocityX) <= GAMEPLAY_RULES.criticalAttackerMaxSpeed;
      if (definition.target === "takedown") this.stamina -= staminaCost;
      else this.spendStrikeStamina(definition.stamina);
      this.attack = {
        type,
        elapsed: 0,
        connected: false,
        inefficientPenaltyApplied: false,
        facing: this.facing,
        stationaryStart,
      };
      if (definition.target !== "takedown") this.roundStats.thrown += 1;
      this.guard = null;
      this.moveFlash = 0.3;
    }

    updateAttack(deltaTime, opponent) {
      const definition = this.currentAttack;
      this.attack.elapsed += deltaTime;
      const activeStart = definition.startup;
      const activeEnd = activeStart + definition.active;

      if (this.attack.type === "takedown" && this.attack.elapsed > 0.08 && this.attack.elapsed < activeEnd) {
        this.x += this.attackFacing * 190 * deltaTime;
      }

      if (this.attack.elapsed >= activeStart
        && this.attack.elapsed <= activeEnd
        && !this.attack.connected) {
        const contact = this.game.findAttackContact(this, opponent, definition);
        if (contact) {
          this.attack.connected = true;
          this.game.resolveAttack(this, opponent, definition, contact);
        }
      }

      const totalDuration = definition.startup + definition.active + definition.recovery;
      if (this.attack && this.attack.elapsed >= totalDuration) {
        if (!this.attack.connected) {
          this.applyInefficientStrikePenalty(definition);
          if (definition.target !== "takedown") this.roundStats.missed += 1;
        }
        this.attack = null;
      }
    }

    getAttackFrameFloat() {
      const definition = this.currentAttack;
      if (!definition || !this.attack) return 0;
      const frameCount = definition.frameCount ?? definition.strikePath.length;
      const contactFrame = definition.contactFrame
        ?? Math.min(frameCount - 2, Math.max(1, Math.floor(frameCount * 0.56)));
      const elapsed = this.attack.elapsed;
      if (elapsed < definition.startup) {
        return clamp(elapsed / definition.startup * contactFrame, 0, contactFrame);
      }
      if (elapsed <= definition.startup + definition.active) {
        const activeProgress = (elapsed - definition.startup) / definition.active;
        return contactFrame + clamp(activeProgress, 0, 1);
      }
      const recoveryElapsed = elapsed - definition.startup - definition.active;
      return clamp(
        contactFrame + 1 + recoveryElapsed / definition.recovery * (frameCount - contactFrame - 2),
        contactFrame + 1,
        frameCount - 1,
      );
    }

    getStrikePoint(definition = this.currentAttack) {
      const path = definition.strikePath;
      const frameFloat = this.getAttackFrameFloat();
      const lowerIndex = clamp(Math.floor(frameFloat), 0, path.length - 1);
      const upperIndex = clamp(Math.ceil(frameFloat), 0, path.length - 1);
      const fraction = frameFloat - lowerIndex;
      const localX = lerp(path[lowerIndex].x, path[upperIndex].x, fraction);
      const localY = lerp(path[lowerIndex].y, path[upperIndex].y, fraction);
      return {
        x: this.x + this.attackFacing * localX,
        y: FLOOR + localY,
      };
    }

    draw(context, options = {}) {
      const fallbackVisual = { animation: "footworkForward", frame: 0 };
      let visual = fallbackVisual;
      try {
        visual = options.frame !== undefined
          ? { animation: options.animation ?? "legacyGround", frame: options.frame }
          : this.getVisualFrame();
      } catch {
        visual = fallbackVisual;
      }
      const sheet = ANIMATIONS[this.characterId][visual.animation]
        ?? ANIMATIONS[this.characterId][fallbackVisual.animation];
      const rawFrame = Number(visual.frame);
      const frame = Math.floor(clamp(Number.isFinite(rawFrame) ? rawFrame : 0, 0, sheet.frames - 1));
      let drawX = Number(options.x ?? this.x);
      if (!Number.isFinite(drawX)) drawX = WIDTH / 2;
      const rawDrawY = Number(options.y ?? FLOOR);
      const drawY = Number.isFinite(rawDrawY) ? rawDrawY : FLOOR;
      let rotation = Number(options.rotation ?? 0);
      if (!Number.isFinite(rotation)) rotation = 0;
      const rawScale = Number(options.scale ?? 1);
      const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
      const rawFacing = options.facing ?? this.attackFacing;
      const facing = rawFacing === -1 ? -1 : 1;
      if (this.hitReaction?.severity === "critical" && options.x === undefined) {
        const progress = clamp(this.hitReaction.elapsed / this.hitReaction.duration, 0, 1);
        const impulse = Math.sin(progress * Math.PI);
        drawX += this.hitReaction.direction * impulse * 10;
        rotation += this.hitReaction.direction * impulse * 0.045;
      }
      const sheetWidth = sheet.image.naturalWidth || sheet.fallbackWidth;
      const sheetHeight = sheet.image.naturalHeight || sheet.fallbackHeight;
      const frameWidth = sheetWidth / sheet.columns;
      const frameHeight = sheetHeight / sheet.rows;
      const column = frame % sheet.columns;
      const row = Math.floor(frame / sheet.columns);
      const destinationHeight = 350 * scale;
      const destinationWidth = destinationHeight * (frameWidth / frameHeight);
      const idleStanceScaleY = visual.animation === "idleBreathing" && options.frame === undefined
        ? 1 - (1 - Math.cos(this.animationTime * Math.PI * 2 / IDLE_STANCE_CYCLE_SECONDS)) * 0.0075
        : 1;

      this.drawFighterShadow(context, drawX, drawY, scale, facing);

      context.save();
      context.translate(drawX, drawY);
      context.rotate(rotation);
      context.scale(facing, idleStanceScaleY);
      context.shadowColor = this.color;
      context.shadowBlur = this.moveFlash > 0 ? 24 : 12;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      if (sheet.image.complete && sheetWidth > 0) {
        context.drawImage(
          sheet.image,
          column * frameWidth,
          row * frameHeight,
          frameWidth,
          frameHeight,
          -destinationWidth / 2,
          -destinationHeight,
          destinationWidth,
          destinationHeight,
        );
      } else {
        context.fillStyle = this.color;
        context.fillRect(-38, -170, 76, 170);
      }
      context.restore();

      if (this.impactMarker && !options.hideStatus) {
        const markerAlpha = clamp(this.impactMarker.life / this.impactMarker.maxLife, 0, 1);
        context.save();
        context.globalAlpha = markerAlpha;
        context.strokeStyle = this.impactMarker.color;
        context.shadowColor = this.impactMarker.color;
        context.shadowBlur = 18;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(this.impactMarker.x, this.impactMarker.y, 10 + (1 - markerAlpha) * 24, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.moveTo(this.impactMarker.x - 13, this.impactMarker.y);
        context.lineTo(this.impactMarker.x + 13, this.impactMarker.y);
        context.moveTo(this.impactMarker.x, this.impactMarker.y - 13);
        context.lineTo(this.impactMarker.x, this.impactMarker.y + 13);
        context.stroke();
        context.restore();
      }

      if (this.guard && !options.hideStatus) {
        context.save();
        context.globalAlpha = 0.46 + Math.sin(this.animationTime * 20) * 0.08;
        context.strokeStyle = this.guard === "high" ? this.color : this.accent;
        context.shadowColor = context.strokeStyle;
        context.shadowBlur = 15;
        context.lineWidth = 3;
        const guardY = this.guard === "high" ? FLOOR - 250 : FLOOR - 165;
        context.translate(this.x, guardY);
        context.scale(this.facing, 1);
        context.beginPath();
        context.arc(22, 0, 48, -1.2, 1.2);
        context.stroke();
        context.restore();
      }

      if (!options.hideStatus) this.drawStatus(context);
    }

    drawFighterShadow(context, drawX, drawY, scale = 1, facing = 1) {
      const groundedOutcome = this.knockdownTimer > 0 || this.finishAnimation;
      const shadowWidth = (groundedOutcome ? 112 : this.attack ? 82 : 76) * scale;
      const shadowHeight = (groundedOutcome ? 18 : this.attack ? 8 : 7) * scale;
      const shadowY = drawY + (groundedOutcome ? 2 : -7) * scale;

      context.save();
      context.translate(drawX, shadowY);
      context.scale(shadowWidth, shadowHeight);
      const shadowGradient = context.createRadialGradient(0, 0, 0.06, 0, 0, 1);
      shadowGradient.addColorStop(0, "rgba(0, 0, 4, 0.68)");
      shadowGradient.addColorStop(0.58, "rgba(0, 0, 5, 0.42)");
      shadowGradient.addColorStop(1, "rgba(0, 0, 5, 0)");
      context.fillStyle = shadowGradient;
      context.beginPath();
      context.arc(0, 0, 1, 0, Math.PI * 2);
      context.fill();
      context.restore();

      if (!groundedOutcome) {
        const footContactOffsets = [-76, 62];
        for (const footOffset of footContactOffsets) {
          context.save();
          context.globalAlpha = 0.58;
          context.fillStyle = "#010106";
          context.filter = "blur(1.5px)";
          context.beginPath();
          context.ellipse(
            drawX + footOffset * facing * scale,
            shadowY,
            24 * scale,
            3.5 * scale,
            0,
            0,
            Math.PI * 2,
          );
          context.fill();
          context.restore();
        }
      }

      context.save();
      context.globalAlpha = groundedOutcome ? 0.28 : 0.4;
      context.fillStyle = "#020208";
      context.filter = "blur(2px)";
      context.beginPath();
      context.ellipse(drawX, shadowY - 1, shadowWidth * 0.42, shadowHeight * 0.28, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    getVisualFrame() {
      if (this.finishAnimation) {
        const progress = clamp(
          this.finishAnimation.elapsed / this.finishAnimation.duration,
          0,
          0.999,
        );
        return {
          animation: this.finishAnimation.animation,
          frame: Math.min(9, 1 + Math.floor(progress * 9)),
        };
      }
      if (this.knockdownTimer > 0) {
        const progress = clamp(
          1 - this.knockdownTimer / Math.max(0.01, this.knockdownDuration),
          0,
          0.999,
        );
        return {
          animation: this.knockdownAnimation,
          frame: Math.min(9, 1 + Math.floor(progress * 9)),
        };
      }
      if (this.attack) {
        return {
          animation: this.currentAttack.animation,
          frame: this.currentAttack.legacyFrame
            ?? (this.currentAttack.frameOffset ?? 0) + Math.floor(this.getAttackFrameFloat()),
        };
      }
      if (this.blockReaction) {
        const progress = clamp(this.blockReaction.elapsed / this.blockReaction.duration, 0, 0.999);
        const blockFrames = [9, 8, 7, 8, 9];
        return {
          animation: this.blockReaction.guard === "low" ? "guardLow" : "guardHigh",
          frame: blockFrames[Math.floor(progress * blockFrames.length)],
        };
      }
      if (this.hitReaction) {
        const reactionProgress = clamp(this.hitReaction.elapsed / this.hitReaction.duration, 0, 0.999);
        return {
          animation: this.hitReaction.target === "body" ? "hitReactionBody" : "hitReactionHead",
          frame: Math.floor(reactionProgress * 10),
        };
      }
      const visibleGuard = this.guard ?? (this.guardBlend > 0 ? this.guardVisual : null);
      if (visibleGuard === "high") {
        if (this.guard === "high" && this.guardBlend >= 0.92 && Math.abs(this.velocityX) > LOCOMOTION_SPEED_THRESHOLD) {
          const cycle = Math.floor(this.animationTime * GUARD_FOOTWORK_ANIMATION_FPS) % 10;
          const frame = this.velocityX * this.facing >= 0 ? cycle : (10 - cycle) % 10;
          return { animation: "guardHighFootwork", frame };
        }
        return { animation: "guardHigh", frame: clamp(Math.floor(this.guardBlend * 9), 0, 9) };
      }
      if (visibleGuard === "low") {
        if (this.guard === "low" && this.guardBlend >= 0.92 && Math.abs(this.velocityX) > LOCOMOTION_SPEED_THRESHOLD) {
          const cycle = Math.floor(this.animationTime * GUARD_FOOTWORK_ANIMATION_FPS) % 10;
          const frame = this.velocityX * this.facing >= 0 ? cycle : (10 - cycle) % 10;
          return { animation: "guardLowFootwork", frame };
        }
        return { animation: "guardLow", frame: clamp(Math.floor(this.guardBlend * 9), 0, 9) };
      }
      if (this.evadeTimer > 0) return { animation: "footworkBackward", frame: 5 };
      if (Math.abs(this.velocityX) > LOCOMOTION_SPEED_THRESHOLD) {
        const cycle = Math.floor(this.animationTime * FOOTWORK_ANIMATION_FPS) % 10;
        return {
          animation: this.velocityX * this.facing >= 0 ? "footworkForward" : "footworkBackward",
          frame: cycle,
        };
      }
      return {
        animation: "idleBreathing",
        frame: 0,
      };
    }

    drawStatus(context) {
      const label = this.attack
        ? this.currentAttack.label
        : this.guard === "high"
          ? "HIGH GUARD"
          : this.guard === "low"
            ? "LOW GUARD"
            : this.evadeTimer > 0
              ? "EVADE"
              : "";
      if (!label) return;
      context.save();
      context.textAlign = "center";
      context.fillStyle = this.color;
      context.font = "700 10px Orbitron, sans-serif";
      context.shadowColor = this.color;
      context.shadowBlur = 10;
      context.fillText(label, this.x, FLOOR - 342);
      context.restore();
    }
  }

  class NeonMMA {
    constructor() {
      this.synth = new Synth();
      this.state = "menu";
      this.previousState = "fighting";
      this.mode = "cpu";
      this.round = 1;
      this.timer = ROUND_TIME;
      this.introTimer = 0;
      this.roundDelay = 0;
      this.matchWinner = null;
      this.matchMethod = "";
      this.ground = null;
      this.particles = [];
      this.damageNumbers = [];
      this.shake = 0;
      this.hitStop = 0;
      this.flash = 0;
      this.elapsed = 0;
      this.callout = null;
      this.finishAnnouncement = null;
      this.finishAnnouncementTimer = 0;
      this.aiTimer = 0;
      this.aiIntent = this.emptyInput();
      this.roundHistory = [];
      this.recordedRounds = new Set();
      this.onlineRole = null;
      this.onlineOpponent = null;
      this.onlineInputSequence = 0;
      this.onlineLastControlSignature = "";
      this.onlineLastControlChangeSequence = 0;
      this.onlineInputTimer = 0;
      this.onlineLastSnapshot = -1;
      this.onlinePendingSnapshot = null;
      this.onlineLastAcknowledgedInput = 0;
      this.onlinePredictedAttack = null;
      this.onlinePositionTargets = { fighterOne: null, fighterTwo: null };
      this.onlineLastEventSequence = 0;
      this.onlineLobby = { players: [], searchingCount: 0 };
      this.pendingChallenger = null;
      this.lastTime = performance.now();

      this.fighterOne = new Fighter(this, {
        characterId: "rook",
        name: "ROOK",
        style: "PRESSURE STRIKER",
        color: "#35f2e5",
        accent: "#d6ff7d",
        player: 1,
        x: 380,
        facing: 1,
      });
      this.fighterTwo = new Fighter(this, {
        characterId: "vex",
        name: "VEX",
        style: "COUNTER WRESTLER",
        color: "#ff3b9d",
        accent: "#ffc35b",
        player: 2,
        x: 900,
        facing: -1,
      });

      const OnlineClient = globalThis.NeonBrawlOnlineClient;
      this.online = OnlineClient ? new OnlineClient({
        status: (status) => this.setOnlineStatus(status),
        welcome: (message) => this.handleOnlineWelcome(message),
        lobby: (lobby) => this.renderOnlineLobby(lobby),
        challenge: (challenger) => this.showOnlineChallenge(challenger),
        challengeSent: (opponent) => this.showOutgoingChallenge(opponent),
        challengeDeclined: (opponent) => this.handleChallengeDeclined(opponent),
        match: (match) => this.startOnlineMatch(match),
        snapshot: (message) => this.queueOnlineSnapshot(message),
        latency: (metrics) => this.updateOnlineLatency(metrics),
        opponentLeft: (message) => this.handleOnlineOpponentLeft(message),
        error: (message) => {
          this.hideOutgoingChallenge();
          this.setOnlineStatus({ state: "error", message: message.message });
        },
        disconnected: () => {
          this.setOnlineStatus({ state: "offline", message: "DESCONECTADO" });
          this.setOnlineConnectionState(false);
          this.hideOutgoingChallenge();
          this.updateOnlineLatency();
        },
      }) : null;

      requestAnimationFrame((time) => this.loop(time));
    }

    emptyInput() {
      return {
        move: 0,
        guardHigh: false,
        guardLow: false,
        leftPunch: false,
        rightPunch: false,
        leftKick: false,
        rightKick: false,
        bodyModifier: false,
        takedown: false,
        evade: false,
      };
    }

    showMenuSection(section = "root") {
      const requestedSection = menuPanels.some((panel) => panel.dataset.menuPanel === section)
        ? section
        : "root";
      menuPanels.forEach((panel) => {
        panel.classList.toggle("is-hidden", panel.dataset.menuPanel !== requestedSection);
      });
      menuScreen.dataset.menuSection = requestedSection;
    }

    openOnlineLobby() {
      menuScreen.classList.add("is-hidden");
      resultScreen.classList.add("is-hidden");
      pauseScreen.classList.add("is-hidden");
      onlineScreen.classList.remove("is-hidden");
      this.state = "menu";
      const storedName = globalThis.localStorage?.getItem("neonBrawlOnlineName");
      if (storedName && !onlineNameInput.value) onlineNameInput.value = storedName;
      if (!this.online?.connected) this.setOnlineConnectionState(false);
      this.renderOnlineLobby(this.onlineLobby);
      onlineNameInput.focus?.();
    }

    connectOnline(name) {
      if (!this.online) {
        this.setOnlineStatus({ state: "error", message: "ONLINE CLIENT UNAVAILABLE" });
        return;
      }
      const fighterName = String(name || "NEON FIGHTER").trim().slice(0, 18);
      globalThis.localStorage?.setItem("neonBrawlOnlineName", fighterName);
      this.online.connect(fighterName);
    }

    setOnlineConnectionState(connected, name = "") {
      onlineConnectForm.classList.toggle("online-connect-form--connected", connected);
      onlineNameInput.disabled = connected;
      onlineConnectButton.disabled = connected;
      onlineConnectButton.textContent = connected ? "CONECTADO" : "CONECTAR";
      if (connected && name) onlineNameInput.value = name;
    }

    handleOnlineWelcome({ name } = {}) {
      this.setOnlineConnectionState(true, name);
      this.setOnlineStatus({ state: "online", message: `CONECTADO // ${String(name || "FIGHTER").toUpperCase()}` });
    }

    setOnlineStatus({ state = "offline", message = "DISCONNECTED" } = {}) {
      onlinePresence.dataset.state = state === "online" || state === "waiting" ? "online" : state;
      onlineStatus.textContent = message;
    }

    updateOnlineLatency({ latencyMs = null, jitterMs = null, quality = "unknown" } = {}) {
      const validLatency = Number.isFinite(latencyMs);
      const safeQuality = Object.hasOwn(ONLINE_LATENCY_LABELS, quality) ? quality : "unknown";
      onlineLatency.dataset.quality = validLatency ? safeQuality : "unknown";
      onlineLatencyValue.textContent = validLatency ? `${Math.max(0, Math.round(latencyMs))} MS` : "-- MS";
      onlineLatencyQuality.textContent = validLatency ? ONLINE_LATENCY_LABELS[safeQuality] : "SIN MEDIR";
      onlineLatency.title = validLatency
        ? `Latencia de ida y vuelta al servidor: ${Math.round(latencyMs)} ms · variación: ${Math.max(0, Math.round(jitterMs ?? 0))} ms`
        : "Latencia de ida y vuelta al servidor";
    }

    renderOnlineLobby(lobby = { players: [], searchingCount: 0 }) {
      this.onlineLobby = lobby;
      onlinePlayerCount.textContent = String(lobby.searchingCount ?? lobby.players?.length ?? 0);
      onlinePlayerList.innerHTML = "";
      const players = lobby.players ?? [];
      if (players.length === 0) {
        const empty = document.createElement("p");
        empty.className = "online-empty";
        empty.textContent = this.online?.connected
          ? "No hay otros jugadores disponibles todavía."
          : "Conéctate para entrar al lobby.";
        onlinePlayerList.append(empty);
        return;
      }

      for (const player of players) {
        const row = document.createElement("article");
        const self = player.id === this.online?.id;
        row.className = `online-player${self ? " online-player--self" : ""}`;
        const light = document.createElement("i");
        const identity = document.createElement("span");
        const name = document.createElement("strong");
        const status = document.createElement("small");
        const action = document.createElement("button");
        name.textContent = player.name;
        status.textContent = self ? "TU SESIÓN // BUSCANDO" : "DISPONIBLE PARA COMBATIR";
        identity.append(name, status);
        action.type = "button";
        action.className = self ? "dialog-button" : "dialog-button dialog-button--primary";
        action.textContent = self ? "TÚ" : "RETAR";
        action.disabled = self;
        if (!self) action.addEventListener("click", () => this.online.challenge(player.id));
        row.append(light, identity, action);
        onlinePlayerList.append(row);
      }
    }

    showOnlineChallenge(challenger) {
      this.pendingChallenger = challenger;
      onlineChallengerName.textContent = challenger.name;
      onlineChallenge.classList.remove("is-hidden");
      this.setOnlineStatus({ state: "waiting", message: `RETO RECIBIDO DE ${challenger.name.toUpperCase()}` });
    }

    hideOnlineChallenge() {
      this.pendingChallenger = null;
      onlineChallenge.classList.add("is-hidden");
    }

    showOutgoingChallenge(opponent) {
      onlineOutgoingName.textContent = opponent.name;
      onlineOutgoingChallenge.classList.remove("is-hidden");
      this.setOnlineStatus({
        state: "waiting",
        message: `RETO ENVIADO A ${opponent.name.toUpperCase()} // ESPERANDO`,
      });
    }

    hideOutgoingChallenge() {
      onlineOutgoingChallenge.classList.add("is-hidden");
      onlineOutgoingName.textContent = "FIGHTER";
    }

    handleChallengeDeclined(opponent) {
      this.hideOutgoingChallenge();
      this.setOnlineStatus({
        state: "online",
        message: `${opponent.name.toUpperCase()} RECHAZÓ EL RETO // BUSCANDO`,
      });
    }

    startOnlineMatch(match) {
      this.onlineRole = match.role;
      this.onlineOpponent = match.opponent;
      this.onlineLastSnapshot = -1;
      this.onlinePendingSnapshot = null;
      this.onlineLastControlSignature = "";
      this.onlineLastControlChangeSequence = 0;
      this.onlineLastAcknowledgedInput = 0;
      this.onlinePredictedAttack = null;
      this.onlinePositionTargets = { fighterOne: null, fighterTwo: null };
      this.onlineLastEventSequence = 0;
      this.hideOnlineChallenge();
      this.hideOutgoingChallenge();
      onlineScreen.classList.add("is-hidden");
      this.start("online");
      this.syncOnlineBackgroundTicker();
      this.showCallout(`${match.opponent.name} CONNECTED`, "#d6ff7d", 1.1);
    }

    syncOnlineBackgroundTicker() {
      // The Node server owns all online simulation, including background tabs.
    }

    returnToOnlineLobby() {
      this.online?.leaveMatch();
      this.onlineRole = null;
      this.onlineOpponent = null;
      this.state = "menu";
      this.matchWinner = null;
      resultScreen.classList.add("is-hidden");
      pauseScreen.classList.add("is-hidden");
      roundMessage.classList.add("is-hidden");
      menuScreen.classList.add("is-hidden");
      onlineScreen.classList.remove("is-hidden");
      this.hideOutgoingChallenge();
      this.syncOnlineBackgroundTicker();
      this.setOnlineStatus({ state: "online", message: "CONECTADO // BUSCANDO PELEADORES" });
    }

    handleOnlineOpponentLeft({ reason = "Opponent disconnected." } = {}) {
      this.onlineRole = null;
      this.onlineOpponent = null;
      this.state = "menu";
      resultScreen.classList.add("is-hidden");
      pauseScreen.classList.add("is-hidden");
      roundMessage.classList.add("is-hidden");
      menuScreen.classList.add("is-hidden");
      onlineScreen.classList.remove("is-hidden");
      this.syncOnlineBackgroundTicker();
      this.setOnlineStatus({ state: "error", message: reason.toUpperCase() });
    }

    start(mode) {
      this.synth.ensure();
      this.mode = mode;
      this.round = 1;
      this.matchWinner = null;
      this.matchMethod = "";
      this.roundHistory = [];
      this.recordedRounds.clear();
      this.onlineInputSequence = 0;
      this.onlineLastControlSignature = "";
      this.onlineLastControlChangeSequence = 0;
      this.onlineInputTimer = 0;
      this.fighterOne.roundWins = 0;
      this.fighterTwo.roundWins = 0;
      this.fighterOne.matchScore = 0;
      this.fighterTwo.matchScore = 0;
      this.fighterOne.resetMatchStamina();
      this.fighterTwo.resetMatchStamina();
      menuScreen.classList.add("is-hidden");
      onlineScreen.classList.add("is-hidden");
      pauseScreen.classList.add("is-hidden");
      resultScreen.classList.add("is-hidden");
      resultScorecard.innerHTML = "";
      rematchButton.textContent = mode === "online" ? "VOLVER AL LOBBY" : "REVANCHA";
      this.startRound();
      canvas.focus();
    }

    startRound() {
      if (this.round > 1) {
        this.fighterOne.recoverBetweenRounds();
        this.fighterTwo.recoverBetweenRounds();
      }
      this.fighterOne.resetRound(380, 1);
      this.fighterTwo.resetRound(900, -1);
      this.timer = ROUND_TIME;
      this.ground = null;
      this.particles.length = 0;
      this.damageNumbers.length = 0;
      this.state = "intro";
      this.introTimer = 1.8;
      this.introFightShown = false;
      this.finishAnnouncement = null;
      this.finishAnnouncementTimer = 0;
      this.aiTimer = 0;
      this.aiIntent = this.emptyInput();
      this.showRoundMessage(
        this.mode === "practice" ? "PRACTICE MODE" : `ROUND ${this.round} OF ${MAX_ROUNDS}`,
        "READY",
      );
      this.synth.announce();
    }

    returnToMenu(menuSection = "root") {
      if (this.mode === "online") {
        this.online?.leaveMatch();
        this.online?.disconnect();
        this.setOnlineConnectionState(false);
        this.hideOutgoingChallenge();
        this.onlineRole = null;
        this.onlineOpponent = null;
      }
      this.syncOnlineBackgroundTicker();
      this.state = "menu";
      this.ground = null;
      this.matchWinner = null;
      menuScreen.classList.remove("is-hidden");
      onlineScreen.classList.add("is-hidden");
      pauseScreen.classList.add("is-hidden");
      resultScreen.classList.add("is-hidden");
      roundMessage.classList.add("is-hidden");
      combatControls.classList.add("is-hidden");
      this.showMenuSection(menuSection);
    }

    togglePause() {
      if (this.mode === "online" && ["intro", "fighting", "ground", "roundOver"].includes(this.state)) {
        this.showCallout("ONLINE MATCHES CANNOT PAUSE", "#d6ff7d", 0.8);
        return;
      }
      if (this.state === "paused") {
        this.state = this.previousState;
        pauseScreen.classList.add("is-hidden");
        canvas.focus();
      } else if (["intro", "fighting", "ground"].includes(this.state)) {
        this.previousState = this.state;
        this.state = "paused";
        pauseScreen.classList.remove("is-hidden");
      }
    }

    showRoundMessage(kicker, title) {
      roundKicker.textContent = kicker;
      roundTitle.textContent = title;
      roundMessage.classList.remove("is-hidden");
      roundTitle.style.animation = "none";
      void roundTitle.offsetWidth;
      roundTitle.style.animation = "";
    }

    showCallout(text, color = "#ffffff", life = 0.65) {
      this.callout = { text, color, life, maxLife: life };
    }

    getKeyboardInput(player) {
      if (player === 1) {
        const forward = this.fighterOne.facing;
        return {
          move: (keys.has("KeyD") ? forward : 0) - (keys.has("KeyA") ? forward : 0),
          guardHigh: keys.has("KeyW"),
          guardLow: keys.has("KeyS"),
          leftPunch: pressed.has("KeyT"),
          rightPunch: pressed.has("KeyY"),
          leftKick: pressed.has("KeyG"),
          rightKick: pressed.has("KeyH"),
          bodyModifier: keys.has("Space"),
          takedown: FEATURES.takedowns && pressed.has("KeyE"),
          evade: keys.has("KeyE"),
        };
      }
      const forward = this.fighterTwo.facing;
      return {
        move: (keys.has("ArrowLeft") ? forward : 0) - (keys.has("ArrowRight") ? forward : 0),
        guardHigh: keys.has("ArrowUp"),
        guardLow: keys.has("ArrowDown"),
        leftPunch: pressed.has("KeyI"),
        rightPunch: pressed.has("KeyO"),
        leftKick: pressed.has("KeyK"),
        rightKick: pressed.has("KeyL"),
        bodyModifier: keys.has("ShiftLeft") || keys.has("ShiftRight"),
        takedown: FEATURES.takedowns && pressed.has("Slash"),
        evade: keys.has("KeyP"),
      };
    }

    getCpuInput(deltaTime) {
      const cpu = this.fighterTwo;
      const opponent = this.fighterOne;
      const distance = Math.abs(opponent.x - cpu.x);
      const direction = opponent.x > cpu.x ? 1 : -1;
      this.aiTimer -= deltaTime;

      if (this.aiTimer <= 0) {
        this.aiTimer = random(0.09, 0.17);
        this.aiIntent = this.emptyInput();
        const threat = opponent.attack?.type;
        const attack = threat ? ATTACKS[threat] : null;
        const threatened = attack && distance < attack.reach + 30;

        if (threatened && Math.random() < 0.72) {
          if (Math.random() < 0.17 && cpu.stamina > 15) {
            this.aiIntent.evade = true;
          } else if (attack.target === "head") {
            this.aiIntent.guardHigh = true;
          } else {
            this.aiIntent.guardLow = true;
          }
        } else if (cpu.stamina / Math.max(1, cpu.maxStamina) < 0.32) {
          this.aiIntent.move = -direction;
          this.aiIntent.guardHigh = Math.random() < 0.5;
        } else if (distance > GAMEPLAY_RULES.guaranteedStrikeDistance) {
          this.aiIntent.move = direction;
        } else {
          const choice = Math.random();
          if (FEATURES.takedowns && distance < 105 && choice < 0.13) this.aiIntent.takedown = true;
          else if (choice < 0.36) this.aiIntent.leftPunch = true;
          else if (choice < 0.6) this.aiIntent.rightPunch = true;
          else if (distance > 105 && choice < 0.81) this.aiIntent.leftKick = true;
          else if (distance > 125 && choice < 0.94) this.aiIntent.rightKick = true;
          else this.aiIntent.move = Math.random() < 0.5 ? direction : -direction;
          this.aiIntent.bodyModifier = Math.random() < 0.42;
        }
      }

      const input = { ...this.aiIntent };
      this.aiIntent.leftPunch = false;
      this.aiIntent.rightPunch = false;
      this.aiIntent.leftKick = false;
      this.aiIntent.rightKick = false;
      this.aiIntent.bodyModifier = false;
      this.aiIntent.takedown = false;
      this.aiIntent.evade = false;
      return input;
    }

    findAttackContact(attacker, target, definition) {
      const distance = Math.abs(attacker.x - target.x);
      const forwardDistance = (target.x - attacker.x) * attacker.attackFacing;
      if (definition.target !== "takedown" && forwardDistance <= 0) return null;
      if (definition.target !== "takedown" && distance > GAMEPLAY_RULES.guaranteedStrikeDistance) {
        return null;
      }
      const strikePoint = attacker.getStrikePoint(definition);
      const hurtZone = target.getHurtZone(definition.target);
      const assistedContact = definition.target !== "takedown"
        && distance <= GAMEPLAY_RULES.guaranteedStrikeDistance;
      const directHit = circleHitsEllipse(strikePoint, definition.strikeRadius, hurtZone);
      if (!assistedContact && !directHit) return null;

      const angle = Math.atan2(
        (strikePoint.y - hurtZone.y) * hurtZone.radiusX,
        (strikePoint.x - hurtZone.x) * hurtZone.radiusY,
      );
      const surfacePoint = {
        x: hurtZone.x + Math.cos(angle) * hurtZone.radiusX,
        y: hurtZone.y + Math.sin(angle) * hurtZone.radiusY,
      };
      if (!directHit) {
        surfacePoint.x = hurtZone.x - attacker.attackFacing * hurtZone.radiusX;
        surfacePoint.y = hurtZone.y;
      }
      return {
        x: directHit ? lerp(strikePoint.x, surfacePoint.x, 0.48) : surfacePoint.x,
        y: directHit ? lerp(strikePoint.y, surfacePoint.y, 0.48) : surfacePoint.y,
        strikePoint,
        hurtZone,
      };
    }

    resolveAttack(attacker, target, definition, contact) {
      if (target.invulnerable > 0) {
        attacker.applyInefficientStrikePenalty(definition);
        if (definition.target !== "takedown") attacker.roundStats.missed += 1;
        this.showCallout("CLEAN EVADE", target.color, 0.55);
        this.synth.tone(340, 0.08, "sine", 0.015, 620);
        return;
      }

      const distance = Math.abs(attacker.x - target.x);
      if (definition.target === "takedown") {
        if (target.guard === "low") {
          attacker.stamina = Math.max(0, attacker.stamina - 8);
          attacker.stun = 0.3;
          this.showCallout("TAKEDOWN STUFFED", target.accent, 0.75);
          this.synth.strike(true);
          return;
        }
        this.startGround(attacker, target);
        return;
      }

      const matchingGuard = definition.target === "head" ? target.guard === "high" : target.guard === "low";
      const rangeQuality = clamp(1 - Math.abs(distance - definition.idealRange) / definition.idealRange * 0.34, 0.66, 1);
      const shortTermRatio = attacker.stamina / Math.max(1, attacker.maxStamina);
      const longTermRatio = attacker.maxStamina / 100;
      const staminaQuality = 0.62 + shortTermRatio * 0.28 + longTermRatio * 0.1;
      const counterBonus = target.attack ? 1.14 : 1;
      const movementCritical = !matchingGuard
        && attacker.attack?.stationaryStart
        && Math.abs(target.velocityX) >= GAMEPLAY_RULES.criticalTargetMinSpeed;
      const targetedHealth = definition.target === "head" ? target.headHealth : target.bodyHealth;
      const vulnerableThreshold = GAMEPLAY_RULES.vulnerableCriticalHealthThresholdByRound[
        clamp(this.round, 1, MAX_ROUNDS) - 1
      ];
      const vulnerableCritical = !matchingGuard
        && !movementCritical
        && targetedHealth < vulnerableThreshold
        && Math.random() < GAMEPLAY_RULES.vulnerableCriticalChance;
      const critical = movementCritical || vulnerableCritical;
      const criticalKnockdown = this.mode !== "practice"
        && critical
        && Math.random() < GAMEPLAY_RULES.criticalKnockdownChance;
      const knockdownVariantRoll = criticalKnockdown ? Math.random() : null;
      const criticalMultiplier = critical ? GAMEPLAY_RULES.criticalDamageMultiplier : 1;
      const guardMultiplier = matchingGuard ? 0.26 : 1;
      const bodyMultiplier = definition.target === "body" ? GAMEPLAY_RULES.bodyDamageScale : 1;
      const strikeDamageScale = critical
        ? GAMEPLAY_RULES.criticalStrikeDamageScale
        : GAMEPLAY_RULES.strikeDamageScale;
      const damage = definition.damage
        * strikeDamageScale
        * bodyMultiplier
        * rangeQuality
        * staminaQuality
        * counterBonus
        * criticalMultiplier
        * guardMultiplier;

      if (matchingGuard) {
        attacker.roundStats.blocked += 1;
      } else {
        attacker.roundStats.landed += 1;
        attacker.roundStats.critical += critical ? 1 : 0;
        if (definition.target === "head") attacker.roundStats.headLanded += 1;
        else attacker.roundStats.bodyLanded += 1;
      }

      if (matchingGuard) attacker.applyInefficientStrikePenalty(definition);

      if (definition.target === "head") target.headHealth = clamp(target.headHealth - damage, 0, 100);
      else target.bodyHealth = clamp(target.bodyHealth - damage, 0, 100);

      attacker.roundDamage += damage;
      attacker.matchScore += damage;
      target.stamina = clamp(
        target.stamina - (matchingGuard ? definition.damage * 0.42 : damage * 0.15),
        0,
        target.maxStamina,
      );
      target.stun = matchingGuard
        ? 0.08
        : critical
          ? GAMEPLAY_RULES.criticalStunSeconds
          : definition.stun;
      target.velocityX = attacker.attackFacing
        * definition.knockback
        * (matchingGuard ? 0.28 : critical ? 1.32 : 1);
      if (matchingGuard) {
        target.hitReaction = null;
        target.blockReaction = {
          guard: definition.target === "head" ? "high" : "low",
          elapsed: 0,
          duration: 0.18,
        };
      } else {
        target.blockReaction = null;
        const interruptedAttack = target.currentAttack;
        if (interruptedAttack && !target.attack.connected) {
          target.applyInefficientStrikePenalty(interruptedAttack);
          if (interruptedAttack.target !== "takedown") target.roundStats.missed += 1;
        }
        target.attack = null;
        target.guard = null;
        target.guardBlend = 0;
        target.hitReaction = {
          target: definition.target,
          severity: critical ? "critical" : "clean",
          direction: attacker.attackFacing,
          elapsed: 0,
          duration: critical
            ? 0.62
            : definition.heavy
              ? 0.42
              : definition.target === "body"
                ? 0.36
                : 0.32,
        };
      }

      const impactCount = matchingGuard ? 7 : critical ? 34 : definition.heavy ? 22 : 14;
      target.impactMarker = {
        x: contact.x,
        y: contact.y,
        color: matchingGuard ? target.color : critical ? "#ffffff" : attacker.color,
        life: critical ? 0.42 : definition.heavy ? 0.28 : 0.2,
        maxLife: critical ? 0.42 : definition.heavy ? 0.28 : 0.2,
      };
      this.spawnImpact(contact.x, contact.y, critical ? "#ffffff" : attacker.color, impactCount);
      if (critical) this.spawnImpact(contact.x, contact.y, attacker.color, 12);
      this.shake = matchingGuard ? 2.5 : critical ? 18 : definition.heavy ? 12 : 7;
      this.hitStop = matchingGuard ? 0.022 : critical ? 0.105 : definition.heavy ? 0.065 : 0.035;
      this.flash = matchingGuard ? 0.018 : critical ? 0.22 : definition.heavy ? 0.13 : 0.05;
      this.synth.strike(matchingGuard, critical || definition.heavy);
      this.spawnDamageNumber(
        contact.x,
        contact.y - 18,
        damage,
        matchingGuard ? "blocked" : critical ? "critical" : "clean",
      );

      if (matchingGuard) {
        this.showCallout("BLOCKED", target.color, 0.4);
      } else if (critical) {
        this.showCallout("CRITICAL HIT", "#ffffff", 0.72);
      } else if (counterBonus > 1) {
        this.showCallout("COUNTER", attacker.color, 0.55);
      } else {
        this.showCallout("CLEAN HIT", attacker.color, 0.42);
      }

      if (this.mode === "practice" && (target.headHealth <= 0 || target.bodyHealth <= 0)) {
        target.practiceResetTimer = 0.85;
        target.stun = Math.max(target.stun, 0.85);
        this.showCallout("DUMMY RESET", target.color, 0.7);
      } else if (target.headHealth <= 0) {
        this.finishFight(attacker, "K.O.");
      } else if (target.bodyHealth <= 0) {
        this.finishFight(attacker, "BODY K.O.", target, "body");
      } else if (criticalKnockdown) {
        this.knockDown(attacker, target, definition.target, knockdownVariantRoll);
      }
    }

    knockDown(attacker, target, targetZone = "head", variantRoll = Math.random()) {
      target.knockdownsSuffered += 1;
      attacker.knockdownsScored += 1;
      attacker.matchScore += 18;
      target.knockdownDuration = 2;
      target.knockdownTimer = target.knockdownDuration;
      target.knockdownTarget = targetZone;
      const variants = KNOCKDOWN_VARIANTS[targetZone] ?? KNOCKDOWN_VARIANTS.head;
      target.knockdownAnimation = variants[Math.floor(variantRoll * variants.length)];
      target.velocityX = attacker.attackFacing * 150;
      target.attack = null;
      target.hitReaction = null;
      target.blockReaction = null;
      this.showCallout(targetZone === "body" ? "BODY KNOCKDOWN" : "HEAD KNOCKDOWN", attacker.color, 1);
    }

    startGround(attacker, target) {
      attacker.takedowns += 1;
      attacker.matchScore += 12;
      target.bodyHealth = clamp(target.bodyHealth - 8, 0, 100);
      attacker.roundDamage += 8;
      if (target.bodyHealth <= 0) {
        this.finishFight(attacker, "BODY TKO");
        return;
      }
      const center = clamp((attacker.x + target.x) / 2, 300, WIDTH - 300);
      attacker.attack = null;
      target.attack = null;
      this.ground = {
        attacker,
        target,
        center,
        timer: 2.8,
        strikeCooldown: 0.35,
        cpuGuard: false,
      };
      this.state = "ground";
      this.showCallout("TAKEDOWN SECURED", attacker.color, 0.8);
      this.synth.takedown();
      this.shake = 10;
      this.spawnDust(center, FLOOR, attacker.color, 13);
    }

    updateGround(deltaTime) {
      const sequence = this.ground;
      if (!sequence) return;
      sequence.timer -= deltaTime;
      sequence.strikeCooldown -= deltaTime;
      const attackerInput = sequence.attacker.player === 1
        ? this.getKeyboardInput(1)
        : this.mode === "cpu"
          ? { ...this.emptyInput(), leftPunch: sequence.strikeCooldown <= 0 }
          : this.getKeyboardInput(2);
      const defenderInput = sequence.target.player === 1
        ? this.getKeyboardInput(1)
        : this.mode === "cpu"
          ? { ...this.emptyInput(), guardHigh: Math.random() < 0.75 }
          : this.getKeyboardInput(2);

      if ((attackerInput.leftPunch || attackerInput.rightPunch) && sequence.strikeCooldown <= 0 && sequence.attacker.stamina >= 4) {
        const blocked = defenderInput.guardHigh;
        const damage = blocked ? 1.4 : 5.5;
        sequence.target.headHealth = clamp(sequence.target.headHealth - damage, 0, 100);
        sequence.attacker.stamina -= 4;
        sequence.attacker.roundDamage += damage;
        sequence.attacker.matchScore += damage;
        sequence.strikeCooldown = 0.48;
        this.spawnImpact(sequence.center + 35, FLOOR - 70, sequence.attacker.color, blocked ? 7 : 12);
        this.synth.strike(blocked);
        this.showCallout(blocked ? "GROUND BLOCK" : "GROUND STRIKE", sequence.attacker.color, 0.38);
        if (sequence.target.headHealth <= 0) {
          const winner = sequence.attacker;
          this.ground = null;
          this.finishFight(winner, "GROUND TKO");
          return;
        }
      }

      if (defenderInput.evade && sequence.target.stamina >= 8) {
        sequence.target.stamina -= 8;
        sequence.timer -= 0.32;
        this.showCallout("ESCAPE ATTEMPT", sequence.target.color, 0.35);
      }

      sequence.attacker.stamina = clamp(sequence.attacker.stamina + 2 * deltaTime, 0, sequence.attacker.maxStamina);
      sequence.target.stamina = clamp(sequence.target.stamina + 4 * deltaTime, 0, sequence.target.maxStamina);
      if (sequence.timer <= 0) this.endGround();
    }

    endGround() {
      if (!this.ground) return;
      const { attacker, target, center } = this.ground;
      attacker.x = clamp(center - attacker.facing * 100, STAGE_LEFT, STAGE_RIGHT);
      target.x = clamp(center + attacker.facing * 100, STAGE_LEFT, STAGE_RIGHT);
      attacker.stun = 0.22;
      target.stun = 0.28;
      this.ground = null;
      this.state = "fighting";
      this.showCallout("BACK TO STANDING", "#ffffff", 0.65);
    }

    resolveFighterSpacing() {
      const one = this.fighterOne;
      const two = this.fighterTwo;
      const distance = Math.abs(two.x - one.x);
      const minimum = GAMEPLAY_RULES.minimumFighterDistance;
      if (distance < minimum && distance > 0.01) {
        const direction = two.x > one.x ? 1 : -1;
        const correction = (minimum - distance) / 2;
        one.x -= direction * correction;
        two.x += direction * correction;
        one.x = clamp(one.x, STAGE_LEFT, STAGE_RIGHT);
        two.x = clamp(two.x, STAGE_LEFT, STAGE_RIGHT);
      }
    }

    snapshotRoundStats(fighter) {
      return {
        ...fighter.roundStats,
        damage: Number(fighter.roundDamage.toFixed(2)),
        headHealth: Number(fighter.headHealth.toFixed(2)),
        bodyHealth: Number(fighter.bodyHealth.toFixed(2)),
        knockdowns: fighter.knockdownsScored,
      };
    }

    recordRound({ winner, method = "DECISION", scoreOne, scoreTwo } = {}) {
      if (this.recordedRounds.has(this.round)) return;
      const winnerIsOne = winner === this.fighterOne;
      this.roundHistory.push({
        round: this.round,
        method,
        winner: winner?.name ?? null,
        scoreOne: scoreOne ?? (winnerIsOne ? 10 : 8),
        scoreTwo: scoreTwo ?? (winnerIsOne ? 8 : 10),
        fighterOne: this.snapshotRoundStats(this.fighterOne),
        fighterTwo: this.snapshotRoundStats(this.fighterTwo),
      });
      this.recordedRounds.add(this.round);
    }

    finishFight(winner, method, defeated = null, finishTarget = null) {
      if (["roundOver", "matchOver"].includes(this.state)) return;
      const loser = defeated ?? (winner === this.fighterOne ? this.fighterTwo : this.fighterOne);
      const target = finishTarget ?? (method.includes("BODY") ? "body" : "head");
      this.matchWinner = winner;
      this.matchMethod = method;
      this.recordRound({ winner, method });
      this.state = "roundOver";
      this.ground = null;
      this.roundDelay = 3.15;
      winner.attack = null;
      winner.guard = null;
      winner.velocityX = 0;
      loser.attack = null;
      loser.guard = null;
      loser.guardBlend = 0;
      loser.hitReaction = null;
      loser.blockReaction = null;
      loser.knockdownTimer = 0;
      loser.velocityX = 0;
      loser.finishAnimation = {
        target,
        animation: KNOCKOUT_VARIANTS[target][Math.floor(Math.random() * KNOCKOUT_VARIANTS[target].length)],
        elapsed: 0,
        duration: 1.65,
      };
      this.finishAnnouncement = { kicker: `${winner.name} // ${method}`, title: method };
      this.finishAnnouncementTimer = 1.15;
      roundMessage.classList.add("is-hidden");
      this.synth.tone(78, 0.52, "sawtooth", 0.05, 38);
    }

    finishRoundDecision() {
      if (this.state !== "fighting") return;
      const scoreOne = this.fighterOne.roundDamage + this.fighterOne.takedowns * 12 + this.fighterOne.knockdownsScored * 18;
      const scoreTwo = this.fighterTwo.roundDamage + this.fighterTwo.takedowns * 12 + this.fighterTwo.knockdownsScored * 18;
      let winner;
      if (Math.abs(scoreOne - scoreTwo) < 0.5) {
        const healthOne = this.fighterOne.headHealth + this.fighterOne.bodyHealth;
        const healthTwo = this.fighterTwo.headHealth + this.fighterTwo.bodyHealth;
        winner = healthOne >= healthTwo ? this.fighterOne : this.fighterTwo;
      } else {
        winner = scoreOne > scoreTwo ? this.fighterOne : this.fighterTwo;
      }
      winner.roundWins += 1;
      this.recordRound({
        winner,
        method: "DECISION",
        scoreOne: winner === this.fighterOne ? 10 : 9,
        scoreTwo: winner === this.fighterTwo ? 10 : 9,
      });
      this.state = "roundOver";
      this.roundDelay = 2.35;
      this.showRoundMessage(`${winner.name} TAKES ROUND ${this.round}`, "10 - 9");

      if (this.round >= MAX_ROUNDS) {
        if (this.fighterOne.roundWins === this.fighterTwo.roundWins) {
          this.matchWinner = this.fighterOne.matchScore >= this.fighterTwo.matchScore
            ? this.fighterOne
            : this.fighterTwo;
        } else {
          this.matchWinner = this.fighterOne.roundWins > this.fighterTwo.roundWins
            ? this.fighterOne
            : this.fighterTwo;
        }
        this.matchMethod = "DECISION";
      }
    }

    showResult() {
      this.state = "matchOver";
      roundMessage.classList.add("is-hidden");
      combatControls.classList.add("is-hidden");
      resultKicker.innerHTML = `<span></span> ${this.matchMethod} // ROUND ${this.round}`;
      resultTitle.textContent = `${this.matchWinner.name} WINS`;
      resultTitle.style.color = this.matchWinner.color;
      const loser = this.matchWinner === this.fighterOne ? this.fighterTwo : this.fighterOne;
      resultCopy.textContent = this.matchMethod === "DECISION"
        ? `${this.matchWinner.roundWins}-${loser.roundWins} por decisión de los jueces.`
        : `Victoria por ${this.matchMethod} dentro del octágono.`;
      this.renderScorecard();
      resultScreen.classList.remove("is-hidden");
    }

    renderScorecard() {
      const rows = this.roundHistory.flatMap((round) => ([
        { round, fighter: this.fighterOne, stats: round.fighterOne, score: round.scoreOne },
        { round, fighter: this.fighterTwo, stats: round.fighterTwo, score: round.scoreTwo },
      ])).map(({ round, fighter, stats, score }, index) => {
        const accuracy = stats.thrown > 0 ? Math.round(stats.landed / stats.thrown * 100) : 0;
        const winnerClass = round.winner === fighter.name ? " scorecard-winner" : "";
        return `<tr>
          <td class="scorecard-round">R${round.round}</td>
          <th>${fighter.name}</th>
          <td class="${winnerClass}">${score}</td>
          <td>${stats.thrown}</td>
          <td>${stats.landed}</td>
          <td>${stats.missed}</td>
          <td>${stats.blocked}</td>
          <td>${accuracy}%</td>
          <td>${stats.damage.toFixed(2)}</td>
          ${index % 2 === 0 ? `<td rowspan="2">${round.method}</td>` : ""}
        </tr>`;
      }).join("");

      const totalFor = (key) => this.roundHistory.reduce((totals, round) => {
        const stats = round[key];
        totals.thrown += stats.thrown;
        totals.landed += stats.landed;
        totals.missed += stats.missed;
        totals.blocked += stats.blocked;
        totals.damage += stats.damage;
        return totals;
      }, { thrown: 0, landed: 0, missed: 0, blocked: 0, damage: 0 });
      const totalOne = totalFor("fighterOne");
      const totalTwo = totalFor("fighterTwo");
      const totalCard = (fighter, total) => {
        const accuracy = total.thrown > 0 ? Math.round(total.landed / total.thrown * 100) : 0;
        return `<article><strong>${fighter.name} // TOTAL</strong><span>${total.thrown} thrown · ${total.landed} landed · ${total.missed} missed · ${total.blocked} blocked · ${accuracy}% accuracy · ${total.damage.toFixed(2)} damage</span></article>`;
      };

      resultScorecard.innerHTML = `<table class="scorecard-table">
        <thead><tr><th>ROUND</th><th>FIGHTER</th><th>SCORE</th><th>THROWN</th><th>LANDED</th><th>MISSED</th><th>BLOCKED</th><th>ACC.</th><th>DAMAGE</th><th>RESULT</th></tr></thead>
        <tbody>${rows}</tbody>
      </table><div class="scorecard-total">${totalCard(this.fighterOne, totalOne)}${totalCard(this.fighterTwo, totalTwo)}</div>`;
    }

    getOnlineLocalFighter() {
      return this.onlineRole === "player1" ? this.fighterOne : this.fighterTwo;
    }

    getOnlineRemoteFighter() {
      return this.onlineRole === "player1" ? this.fighterTwo : this.fighterOne;
    }

    getOnlineLocalFighterKey() {
      return this.onlineRole === "player1" ? "fighterOne" : "fighterTwo";
    }

    getOnlineRemoteFighterKey() {
      return this.onlineRole === "player1" ? "fighterTwo" : "fighterOne";
    }

    applyFighterSnapshot(fighter, snapshot) {
      if (!snapshot || typeof snapshot !== "object") return;
      for (const field of ONLINE_FIGHTER_FIELDS) {
        if (!Object.hasOwn(snapshot, field)) continue;
        if (ONLINE_NUMERIC_FIGHTER_FIELDS.has(field)) {
          if (Number.isFinite(snapshot[field])) fighter[field] = snapshot[field];
          continue;
        }
        fighter[field] = snapshot[field];
      }

      fighter.x = clamp(Number.isFinite(fighter.x) ? fighter.x : WIDTH / 2, STAGE_LEFT, STAGE_RIGHT);
      if (!isFacing(fighter.facing)) fighter.facing = fighter.player === 1 ? 1 : -1;
      if (fighter.guard !== null && fighter.guard !== "high" && fighter.guard !== "low") fighter.guard = null;
      if (fighter.guardVisual !== null && fighter.guardVisual !== "high" && fighter.guardVisual !== "low") {
        fighter.guardVisual = null;
      }

      if (fighter.attack !== null) {
        const attack = fighter.attack;
        if (!attack || typeof attack !== "object" || !ATTACKS[attack.type]) fighter.attack = null;
        else {
          fighter.attack = {
            ...attack,
            elapsed: Number.isFinite(attack.elapsed) ? Math.max(0, attack.elapsed) : 0,
            facing: isFacing(attack.facing) ? attack.facing : fighter.facing,
            connected: Boolean(attack.connected),
            stationaryStart: Boolean(attack.stationaryStart),
          };
        }
      }

      const animations = ANIMATIONS[fighter.characterId];
      if (!animations[fighter.knockdownAnimation]) {
        fighter.knockdownAnimation = fighter.knockdownTarget === "body" ? "bodyKnockdown" : "headKnockdown";
      }
      if (fighter.finishAnimation) {
        const finish = fighter.finishAnimation;
        if (!finish || !animations[finish.animation]) fighter.finishAnimation = null;
        else {
          fighter.finishAnimation = {
            ...finish,
            elapsed: Number.isFinite(finish.elapsed) ? Math.max(0, finish.elapsed) : 0,
            duration: Number.isFinite(finish.duration) && finish.duration > 0 ? finish.duration : 1,
          };
        }
      }
      for (const effectName of ["hitReaction", "blockReaction"]) {
        const effect = fighter[effectName];
        if (!effect) continue;
        if (typeof effect !== "object") fighter[effectName] = null;
        else {
          effect.elapsed = Number.isFinite(effect.elapsed) ? Math.max(0, effect.elapsed) : 0;
          effect.duration = Number.isFinite(effect.duration) && effect.duration > 0 ? effect.duration : 0.12;
        }
      }
      if (fighter.impactMarker) {
        const marker = fighter.impactMarker;
        const validMarker = typeof marker === "object"
          && Number.isFinite(marker.x)
          && Number.isFinite(marker.y)
          && Number.isFinite(marker.life)
          && Number.isFinite(marker.maxLife)
          && marker.maxLife > 0;
        if (!validMarker) fighter.impactMarker = null;
      }
    }

    captureGuardPresentation(fighter) {
      return {
        guard: fighter.guard === "high" || fighter.guard === "low" ? fighter.guard : null,
        guardVisual: fighter.guardVisual === "high" || fighter.guardVisual === "low"
          ? fighter.guardVisual
          : null,
        guardBlend: clamp(Number(fighter.guardBlend) || 0, 0, 1),
      };
    }

    reconcileGuardPresentation(fighter, previous, desiredGuard) {
      const desired = desiredGuard === "high" || desiredGuard === "low" ? desiredGuard : null;
      const previousVisual = previous.guardVisual ?? previous.guard;
      fighter.guard = desired;

      if (desired) {
        const continuingSameGuard = previous.guard === desired
          || (previous.guard === null && previousVisual === desired && previous.guardBlend > 0);
        fighter.guardVisual = desired;
        fighter.guardBlend = continuingSameGuard ? previous.guardBlend : 0;
        return;
      }

      fighter.guardVisual = previousVisual;
      fighter.guardBlend = previous.guardBlend;
    }

    queueOnlineSnapshot(message) {
      if (!message || !Number.isFinite(message.sequence)) return;
      if (message.sequence <= this.onlineLastSnapshot) return;
      if (this.onlinePendingSnapshot
        && message.sequence <= this.onlinePendingSnapshot.sequence) return;
      this.onlinePendingSnapshot = message;
    }

    applyOnlineSnapshot({ sequence, snapshot }) {
      if (this.mode !== "online"
        || !this.onlineRole
        || !snapshot
        || typeof snapshot !== "object"
        || snapshot.authority !== "server"
        || !Number.isFinite(sequence)
        || sequence <= this.onlineLastSnapshot) return;
      const hadSnapshot = this.onlineLastSnapshot >= 0;
      const previousPositions = {
        fighterOne: { x: this.fighterOne.x, velocityX: this.fighterOne.velocityX },
        fighterTwo: { x: this.fighterTwo.x, velocityX: this.fighterTwo.velocityX },
      };
      const previousGuards = {
        fighterOne: this.captureGuardPresentation(this.fighterOne),
        fighterTwo: this.captureGuardPresentation(this.fighterTwo),
      };
      this.onlineLastSnapshot = sequence;
      const acknowledgedInput = snapshot.inputAcknowledgements?.[this.onlineRole];
      if (Number.isSafeInteger(acknowledgedInput)) {
        this.onlineLastAcknowledgedInput = Math.max(
          this.onlineLastAcknowledgedInput,
          acknowledgedInput,
        );
      }
      const previousState = this.state;
      const onlineStates = new Set(["intro", "fighting", "ground", "roundOver", "matchOver"]);
      if (onlineStates.has(snapshot.state)) this.state = snapshot.state;
      if (Number.isFinite(snapshot.round)) this.round = clamp(Math.round(snapshot.round), 1, MAX_ROUNDS);
      if (Number.isFinite(snapshot.timer)) this.timer = Math.max(0, snapshot.timer);
      if (Number.isFinite(snapshot.introTimer)) this.introTimer = snapshot.introTimer;
      if (Number.isFinite(snapshot.roundDelay)) this.roundDelay = snapshot.roundDelay;
      if (typeof snapshot.matchMethod === "string") this.matchMethod = snapshot.matchMethod;
      this.roundHistory = Array.isArray(snapshot.roundHistory) ? snapshot.roundHistory : [];
      this.recordedRounds = new Set(this.roundHistory.map(({ round }) => round));
      this.callout = snapshot.callout && typeof snapshot.callout === "object"
        && typeof snapshot.callout.text === "string"
        && Number.isFinite(snapshot.callout.life)
        && Number.isFinite(snapshot.callout.maxLife)
        && snapshot.callout.maxLife > 0
        ? snapshot.callout
        : null;
      if (Number.isFinite(snapshot.flash)) this.flash = Math.max(0, snapshot.flash);
      if (Number.isFinite(snapshot.shake)) this.shake = Math.max(0, snapshot.shake);
      this.applyFighterSnapshot(this.fighterOne, snapshot.fighterOne);
      this.applyFighterSnapshot(this.fighterTwo, snapshot.fighterTwo);
      const oneWaySeconds = clamp(
        ((Number(this.online?.latencyMs) || 0) + (Number(this.online?.jitterMs) || 0)) / 2000
          + ONLINE_SNAPSHOT_INTERVAL / 2,
        ONLINE_SNAPSHOT_INTERVAL / 2,
        ONLINE_MAX_EXTRAPOLATION_SECONDS,
      );
      const makeTarget = (fighter) => ({
        x: clamp(fighter.x + fighter.velocityX * oneWaySeconds, STAGE_LEFT, STAGE_RIGHT),
        velocityX: fighter.velocityX,
        age: 0,
      });
      this.onlinePositionTargets.fighterOne = makeTarget(this.fighterOne);
      this.onlinePositionTargets.fighterTwo = makeTarget(this.fighterTwo);
      for (const fighter of [this.fighterOne, this.fighterTwo]) {
        if (fighter.attack) {
          const definition = fighter.currentAttack;
          const totalDuration = definition
            ? definition.startup + definition.active + definition.recovery
            : fighter.attack.elapsed;
          fighter.attack.elapsed = Math.min(
            totalDuration,
            fighter.attack.elapsed + Math.min(
              oneWaySeconds,
              ONLINE_MAX_ANIMATION_FAST_FORWARD_SECONDS,
            ),
          );
        }
      }

      const localKey = this.getOnlineLocalFighterKey();
      const remoteKey = this.getOnlineRemoteFighterKey();
      const localFighter = this.getOnlineLocalFighter();
      const remoteFighter = this.getOnlineRemoteFighter();
      const localCanPredict = this.state === "fighting"
        && localFighter.knockdownTimer <= 0
        && !localFighter.finishAnimation;
      this.reconcilePredictedAttack(snapshot[localKey]?.attack ?? null);
      if (hadSnapshot) {
        remoteFighter.x = previousPositions[remoteKey].x;
        if (localCanPredict) {
          localFighter.x = previousPositions[localKey].x;
          localFighter.velocityX = previousPositions[localKey].velocityX;
        }

        this.reconcileGuardPresentation(
          remoteFighter,
          previousGuards[remoteKey],
          remoteFighter.guard,
        );
        const localInput = this.getOnlineKeyboardInput(false);
        const predictedAttackAllowsGuard = !this.onlinePredictedAttack
          || this.onlinePredictedAttack.completed;
        const localGuardCanPredict = localCanPredict
          && localFighter.stun <= 0
          && localFighter.evadeTimer <= 0
          && !localFighter.attack
          && predictedAttackAllowsGuard;
        if (localGuardCanPredict) {
          const desiredGuard = localInput.guardHigh ? "high" : localInput.guardLow ? "low" : null;
          this.reconcileGuardPresentation(
            localFighter,
            previousGuards[localKey],
            desiredGuard,
          );
        }
      }
      this.matchWinner = snapshot.matchWinner === 1
        ? this.fighterOne
        : snapshot.matchWinner === 2
          ? this.fighterTwo
          : null;
      if (Array.isArray(snapshot.particles)) {
        this.particles = snapshot.particles
          .filter((particle) => particle
            && Number.isFinite(particle.x)
            && Number.isFinite(particle.y)
            && Number.isFinite(particle.life)
            && Number.isFinite(particle.maxLife)
            && particle.maxLife > 0)
          .map((particle) => {
            const replica = new Particle(particle);
            replica.maxLife = particle.maxLife;
            return replica;
          });
      }
      if (Array.isArray(snapshot.damageNumbers)) {
        this.damageNumbers = snapshot.damageNumbers
          .filter((number) => number
            && Number.isFinite(number.x)
            && Number.isFinite(number.y)
            && Number.isFinite(number.life)
            && Number.isFinite(number.maxLife)
            && number.maxLife > 0);
      }
      this.applyOnlineEvents(snapshot.events);
      if (snapshot.roundOverlay) {
        roundKicker.textContent = snapshot.roundOverlay.kicker;
        roundTitle.textContent = snapshot.roundOverlay.title;
        roundMessage.classList.toggle("is-hidden", snapshot.roundOverlay.hidden);
      }
      if (this.state === "matchOver" && previousState !== "matchOver") this.showResult();
    }

    applyOnlineEvents(events) {
      if (!Array.isArray(events)) return;
      for (const event of events) {
        if (!event || !Number.isSafeInteger(event.id) || event.id <= this.onlineLastEventSequence) continue;
        this.onlineLastEventSequence = event.id;
        if (event.type === "impact"
          && Number.isFinite(event.x)
          && Number.isFinite(event.y)
          && typeof event.color === "string") {
          const count = event.blocked ? 7 : event.critical ? 34 : event.heavy ? 22 : 14;
          this.spawnImpact(event.x, event.y, event.critical ? "#ffffff" : event.color, count);
          if (event.critical) this.spawnImpact(event.x, event.y, event.color, 12);
          this.hitStop = Math.max(
            this.hitStop,
            event.blocked ? 0.022 : event.critical ? 0.105 : event.heavy ? 0.065 : 0.035,
          );
          this.synth.strike(Boolean(event.blocked), Boolean(event.critical || event.heavy));
        } else if (event.type === "finish") {
          this.synth.tone(78, 0.52, "sawtooth", 0.05, 38);
        }
      }
    }

    getOnlineKeyboardInput(includeActions = true) {
      return {
        move: (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
        guardHigh: keys.has("KeyW"),
        guardLow: keys.has("KeyS"),
        leftPunch: includeActions && pressed.has("KeyT"),
        rightPunch: includeActions && pressed.has("KeyY"),
        leftKick: includeActions && pressed.has("KeyG"),
        rightKick: includeActions && pressed.has("KeyH"),
        bodyModifier: keys.has("Space"),
        takedown: false,
        evade: keys.has("KeyE"),
      };
    }

    getPredictedStrikeType(input) {
      if (input.rightKick) return input.bodyModifier ? "rightKickBody" : "rightKickHead";
      if (input.leftKick) return input.bodyModifier ? "leftKickBody" : "leftKickHead";
      if (input.rightPunch) return input.bodyModifier ? "rightPunchBody" : "rightPunchHead";
      if (input.leftPunch) return input.bodyModifier ? "leftPunchBody" : "leftPunchHead";
      return null;
    }

    predictOnlineLocalInput(input, sequence) {
      if (!this.onlineRole || this.state !== "fighting") return;
      const type = this.getPredictedStrikeType(input);
      const fighter = this.getOnlineLocalFighter();
      const opponent = this.getOnlineRemoteFighter();
      if (!type
        || this.onlinePredictedAttack
        || fighter.attack
        || fighter.stun > 0
        || fighter.evadeTimer > 0
        || fighter.knockdownTimer > 0
        || fighter.finishAnimation
        || opponent.knockdownTimer > 0) return;
      const definition = ATTACKS[type];
      const staminaCost = definition.stamina * GAMEPLAY_RULES.strikeStaminaScale;
      if (fighter.stamina < staminaCost) return;
      const attack = {
        type,
        elapsed: 0,
        connected: false,
        inefficientPenaltyApplied: false,
        facing: fighter.facing,
        stationaryStart: Math.abs(fighter.velocityX) <= GAMEPLAY_RULES.criticalAttackerMaxSpeed,
      };
      this.onlinePredictedAttack = {
        sequence,
        type,
        attack,
        elapsed: 0,
        totalDuration: definition.startup + definition.active + definition.recovery,
        completed: false,
        acknowledged: false,
        acknowledgedElapsed: null,
        authoritySeen: false,
      };
      fighter.attack = { ...attack };
      fighter.guard = null;
      fighter.moveFlash = Math.max(fighter.moveFlash, 0.3);
    }

    reconcilePredictedAttack(authoritativeAttack) {
      const prediction = this.onlinePredictedAttack;
      if (!prediction) return;
      const fighter = this.getOnlineLocalFighter();
      const predictionCancelled = this.state !== "fighting"
        || fighter.stun > 0
        || fighter.knockdownTimer > 0
        || Boolean(fighter.finishAnimation);
      if (predictionCancelled) {
        if (!authoritativeAttack && fighter.attack?.type === prediction.type) {
          fighter.attack = null;
        }
        this.onlinePredictedAttack = null;
        return;
      }
      prediction.acknowledged = this.onlineLastAcknowledgedInput >= prediction.sequence;
      if (prediction.acknowledged && prediction.acknowledgedElapsed === null) {
        prediction.acknowledgedElapsed = prediction.elapsed;
      }
      if (authoritativeAttack?.type === prediction.type) prediction.authoritySeen = true;

      if (prediction.acknowledged && prediction.authoritySeen && !authoritativeAttack) {
        if (fighter.attack?.type === prediction.type) fighter.attack = null;
        this.onlinePredictedAttack = null;
        return;
      }

      const rejectionGrace = Math.max(
        0.12,
        (Number(this.online?.jitterMs) || 0) / 1000 + ONLINE_SNAPSHOT_INTERVAL * 2,
      );
      if (prediction.acknowledged
        && !prediction.authoritySeen
        && !authoritativeAttack
        && prediction.elapsed - prediction.acknowledgedElapsed > rejectionGrace) {
        if (fighter.attack?.type === prediction.type) fighter.attack = null;
        this.onlinePredictedAttack = null;
        return;
      }

      if (!prediction.completed) {
        const authoritativeElapsed = authoritativeAttack?.type === prediction.type
          && Number.isFinite(authoritativeAttack.elapsed)
          ? authoritativeAttack.elapsed
          : 0;
        prediction.elapsed = Math.max(prediction.elapsed, authoritativeElapsed);
        fighter.attack = {
          ...prediction.attack,
          ...(authoritativeAttack?.type === prediction.type ? authoritativeAttack : {}),
          elapsed: prediction.elapsed,
        };
      } else if (!prediction.authoritySeen || authoritativeAttack?.type === prediction.type) {
        fighter.attack = null;
      }

    }

    sendOnlineInputNow(includeActions = true) {
      if (this.mode !== "online" || !this.onlineRole || !this.online?.connected) return false;
      if (["menu", "matchOver"].includes(this.state)) return false;
      this.onlineInputSequence += 1;
      const input = this.getOnlineKeyboardInput(includeActions);
      const sent = this.online.sendInput(
        input,
        this.onlineInputSequence,
      );
      if (sent) {
        this.onlineInputTimer = ONLINE_INPUT_INTERVAL;
        const controlSignature = [
          input.move,
          input.guardHigh,
          input.guardLow,
          input.bodyModifier,
          input.evade,
        ].join(":");
        if (controlSignature !== this.onlineLastControlSignature) {
          this.onlineLastControlSignature = controlSignature;
          this.onlineLastControlChangeSequence = this.onlineInputSequence;
        }
        this.predictOnlineLocalInput(input, this.onlineInputSequence);
      }
      return sent;
    }

    updateOnlinePositionTarget(target, deltaTime) {
      if (!target) return;
      target.age += deltaTime;
      if (target.age > 0.16) target.velocityX *= Math.pow(0.08, deltaTime);
      target.x = clamp(target.x + target.velocityX * deltaTime, STAGE_LEFT, STAGE_RIGHT);
    }

    updateOnlineLocalPrediction(deltaTime) {
      const fighter = this.getOnlineLocalFighter();
      const opponent = this.getOnlineRemoteFighter();
      const input = this.getOnlineKeyboardInput(false);
      const canControl = this.state === "fighting"
        && fighter.stun <= 0
        && fighter.knockdownTimer <= 0
        && !fighter.finishAnimation;

      if (canControl && !fighter.attack && fighter.evadeTimer <= 0) {
        const nextGuard = input.guardHigh ? "high" : input.guardLow ? "low" : null;
        if (nextGuard && nextGuard !== fighter.guard) {
          fighter.guardBlend = 0;
          fighter.guardVisual = nextGuard;
        }
        fighter.guard = nextGuard;
        fighter.guardBlend = nextGuard
          ? clamp(fighter.guardBlend + deltaTime * GUARD_TRANSITION_RATE, 0, 1)
          : clamp(fighter.guardBlend - deltaTime * GUARD_TRANSITION_RATE, 0, 1);
        if (!nextGuard && fighter.guardBlend <= 0) fighter.guardVisual = null;

        const shortTermRatio = fighter.stamina / Math.max(1, fighter.maxStamina);
        const longTermRatio = fighter.maxStamina / 100;
        const movementPenalty = 0.62 + shortTermRatio * 0.28 + longTermRatio * 0.1;
        const targetVelocity = fighter.guard
          ? input.move * 105
          : input.move * 260 * movementPenalty;
        fighter.velocityX = lerp(
          fighter.velocityX,
          targetVelocity,
          1 - Math.pow(0.001, deltaTime),
        );
        fighter.x = clamp(fighter.x + fighter.velocityX * deltaTime, STAGE_LEFT, STAGE_RIGHT);
      } else if (fighter.attack) {
        fighter.velocityX *= Math.pow(0.008, deltaTime);
        fighter.x = clamp(fighter.x + fighter.velocityX * deltaTime, STAGE_LEFT, STAGE_RIGHT);
      }

      const ownTarget = this.onlinePositionTargets[this.getOnlineLocalFighterKey()];
      const targetIncludesLatestControl = this.onlineLastAcknowledgedInput
        >= this.onlineLastControlChangeSequence;
      if (ownTarget && canControl && targetIncludesLatestControl) {
        const error = ownTarget.x - fighter.x;
        if (Math.abs(error) > 150) fighter.x = ownTarget.x;
        else {
          fighter.x += error * (1 - Math.exp(-ONLINE_LOCAL_RECONCILIATION_RATE * deltaTime));
        }
      }

      const minimum = GAMEPLAY_RULES.minimumFighterDistance;
      const separation = fighter.x - opponent.x;
      if (Math.abs(separation) < minimum) {
        const side = separation === 0 ? (fighter.player === 1 ? -1 : 1) : Math.sign(separation);
        fighter.x = clamp(opponent.x + side * minimum, STAGE_LEFT, STAGE_RIGHT);
      }

      const prediction = this.onlinePredictedAttack;
      if (prediction) {
        prediction.elapsed += deltaTime;
        if (!prediction.completed && prediction.elapsed >= prediction.totalDuration) {
          prediction.completed = true;
          if (fighter.attack?.type === prediction.type) fighter.attack = null;
        } else if (!prediction.completed && fighter.attack?.type === prediction.type) {
          fighter.attack.elapsed = prediction.elapsed;
        }
        const retention = Math.max(1, (Number(this.online?.latencyMs) || 0) / 500);
        if (prediction.elapsed > prediction.totalDuration + retention) {
          this.onlinePredictedAttack = null;
        }
      }
    }

    updateOnlineReplica(deltaTime) {
      if (this.onlinePendingSnapshot) {
        const pendingSnapshot = this.onlinePendingSnapshot;
        this.onlinePendingSnapshot = null;
        this.applyOnlineSnapshot(pendingSnapshot);
      }
      this.elapsed += deltaTime;
      this.onlineInputTimer -= deltaTime;
      if (this.onlineInputTimer <= 0) this.sendOnlineInputNow();
      if (this.state === "fighting") this.timer = Math.max(0, this.timer - deltaTime);
      this.updateOnlinePositionTarget(this.onlinePositionTargets.fighterOne, deltaTime);
      this.updateOnlinePositionTarget(this.onlinePositionTargets.fighterTwo, deltaTime);
      const remoteFighter = this.getOnlineRemoteFighter();
      const localFighter = this.getOnlineLocalFighter();
      const opponentTarget = this.onlinePositionTargets[this.getOnlineRemoteFighterKey()];
      if (opponentTarget) {
        remoteFighter.x = lerp(
          remoteFighter.x,
          opponentTarget.x,
          1 - Math.exp(-ONLINE_REMOTE_SMOOTHING_RATE * deltaTime),
        );
      }
      remoteFighter.guardBlend = remoteFighter.guard
        ? clamp(remoteFighter.guardBlend + deltaTime * GUARD_TRANSITION_RATE, 0, 1)
        : clamp(remoteFighter.guardBlend - deltaTime * GUARD_TRANSITION_RATE, 0, 1);
      if (!remoteFighter.guard && remoteFighter.guardBlend <= 0) remoteFighter.guardVisual = null;
      this.updateOnlineLocalPrediction(deltaTime);
      for (const fighter of [this.fighterOne, this.fighterTwo]) {
        fighter.updateVisualState(deltaTime);
        if (fighter.attack && (fighter !== localFighter || !this.onlinePredictedAttack)) {
          fighter.attack.elapsed += deltaTime;
        }
      }
      for (const particle of this.particles) particle.update(deltaTime);
      this.particles = this.particles.filter((particle) => particle.life > 0);
      for (const number of this.damageNumbers) {
        number.life -= deltaTime;
        number.y -= 30 * deltaTime;
      }
      this.damageNumbers = this.damageNumbers.filter((number) => number.life > 0);
    }

    update(deltaTime) {
      this.elapsed += deltaTime;
      this.shake *= Math.pow(0.008, deltaTime);
      this.flash = Math.max(0, this.flash - deltaTime * 2.6);
      if (this.callout) {
        this.callout.life -= deltaTime;
        if (this.callout.life <= 0) this.callout = null;
      }

      if (this.state === "intro") {
        this.introTimer -= deltaTime;
        this.fighterOne.updateVisualState(deltaTime);
        this.fighterTwo.updateVisualState(deltaTime);
        if (this.introTimer < 0.72 && !this.introFightShown) {
          this.introFightShown = true;
          this.showRoundMessage(
            this.mode === "practice" ? "PRACTICE MODE" : `ROUND ${this.round} OF ${MAX_ROUNDS}`,
            this.mode === "practice" ? "TRAIN" : "FIGHT",
          );
          this.synth.announce();
        }
        if (this.introTimer <= 0) {
          this.state = "fighting";
          roundMessage.classList.add("is-hidden");
        }
      } else if (this.state === "fighting") {
        if (this.mode !== "practice") this.timer = Math.max(0, this.timer - deltaTime);
        const inputOne = this.getKeyboardInput(1);
        this.fighterOne.update(deltaTime, inputOne, this.fighterTwo);
        if (this.state === "fighting") {
          const inputTwo = this.mode === "cpu"
            ? this.getCpuInput(deltaTime)
            : this.getKeyboardInput(2);
          this.fighterTwo.update(deltaTime, inputTwo, this.fighterOne);
        }
        if (this.state === "fighting") this.resolveFighterSpacing();
        if (this.mode !== "practice" && this.timer <= 0) this.finishRoundDecision();
      } else if (this.state === "ground") {
        this.timer = Math.max(0, this.timer - deltaTime);
        this.updateGround(deltaTime);
        if (this.timer <= 0 && this.state === "ground") {
          this.endGround();
          this.finishRoundDecision();
        }
      } else if (this.state === "roundOver") {
        this.roundDelay -= deltaTime;
        this.fighterOne.updateVisualState(deltaTime);
        this.fighterTwo.updateVisualState(deltaTime);
        if (this.finishAnnouncement) {
          this.finishAnnouncementTimer -= deltaTime;
          if (this.finishAnnouncementTimer <= 0) {
            this.showRoundMessage(this.finishAnnouncement.kicker, this.finishAnnouncement.title);
            this.finishAnnouncement = null;
          }
        }
        if (this.roundDelay <= 0) {
          if (this.matchWinner) this.showResult();
          else {
            this.round += 1;
            this.startRound();
          }
        }
      }

      for (const particle of this.particles) particle.update(deltaTime);
      this.particles = this.particles.filter((particle) => particle.life > 0);
      for (const number of this.damageNumbers) {
        number.life -= deltaTime;
        number.y -= 30 * deltaTime;
      }
      this.damageNumbers = this.damageNumbers.filter((number) => number.life > 0);
    }

    spawnDamageNumber(x, y, damage, outcome) {
      if (this.mode !== "practice") return;
      const suffix = outcome === "critical" ? " CRIT" : outcome === "blocked" ? " BLOCK" : "";
      this.damageNumbers.push({
        x,
        y,
        text: `${damage.toFixed(2)}${suffix}`,
        color: outcome === "critical" ? "#ffffff" : outcome === "blocked" ? "#8be9ff" : "#d6ff7d",
        life: 0.9,
        maxLife: 0.9,
      });
    }

    spawnImpact(x, y, color, count) {
      for (let index = 0; index < count; index += 1) {
        const angle = random(-Math.PI, Math.PI);
        const speed = random(120, 490);
        this.particles.push(new Particle({
          x,
          y,
          color,
          velocityX: Math.cos(angle) * speed,
          velocityY: Math.sin(angle) * speed,
          life: random(0.22, 0.5),
          size: random(3, 8),
        }));
      }
      this.particles.push(new Particle({ x, y, color, kind: "ring", size: 15, life: 0.34 }));
    }

    spawnDust(x, y, color, count) {
      for (let index = 0; index < count; index += 1) {
        this.particles.push(new Particle({
          x: x + random(-26, 26),
          y: y + random(-4, 4),
          color,
          kind: "dust",
          velocityX: random(-65, 65),
          velocityY: random(-16, -3),
          life: random(0.28, 0.58),
          size: random(10, 22),
        }));
      }
    }

    loop(time) {
      const deltaTime = Math.min((time - this.lastTime) / 1000 || 0, 1 / 30);
      this.lastTime = time;
      if (this.hitStop > 0) this.hitStop -= deltaTime;
      else if (this.mode === "online" && this.onlineRole && !["menu", "matchOver"].includes(this.state)) {
        this.updateOnlineReplica(deltaTime);
      } else if (!["paused", "menu", "matchOver"].includes(this.state)) this.update(deltaTime);
      else if (this.state === "menu") this.elapsed += deltaTime;
      if (!document.hidden) this.draw();
      pressed.clear();
      requestAnimationFrame((nextTime) => this.loop(nextTime));
    }

    draw() {
      ctx.setTransform(canvasRenderScale, 0, 0, canvasRenderScale, 0, 0);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.save();
      if (this.shake > 0.1) ctx.translate(random(-this.shake, this.shake), random(-this.shake, this.shake));
      this.drawOctagon(ctx);
      if (this.state !== "menu") {
        if (this.state === "ground" && this.ground) this.drawGround(ctx);
        else {
          this.fighterOne.draw(ctx);
          this.fighterTwo.draw(ctx);
        }
        for (const particle of this.particles) particle.draw(ctx);
        this.drawDamageNumbers(ctx);
        this.drawHud(ctx);
        this.drawCallout(ctx);
      }
      ctx.restore();

      if (this.flash > 0) {
        ctx.save();
        ctx.globalAlpha = this.flash;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.restore();
      }
    }

    drawGround(context) {
      const { attacker, target, center } = this.ground;
      target.draw(context, {
        frame: 0,
        x: center + 42,
        y: FLOOR + 8,
        rotation: -attacker.facing * Math.PI / 2,
        scale: 0.86,
        facing: attacker.facing,
        hideStatus: true,
      });
      attacker.draw(context, {
        frame: 7,
        x: center - attacker.facing * 18,
        y: FLOOR + 6,
        scale: 0.9,
        facing: attacker.facing,
        hideStatus: true,
      });
      context.save();
      context.textAlign = "center";
      context.fillStyle = attacker.color;
      context.font = "700 11px Orbitron, sans-serif";
      context.shadowColor = attacker.color;
      context.shadowBlur = 10;
      context.fillText("GROUND CONTROL // PUNCH TO STRIKE", center, FLOOR - 235);
      context.restore();
    }

    isArenaLayerReady(image) {
      return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    }

    drawArenaLayer(context, image, alpha = 1) {
      if (!this.isArenaLayerReady(image)) return false;
      const sourceWidth = image.naturalWidth;
      const sourceHeight = image.naturalHeight;
      const targetAspect = WIDTH / HEIGHT;
      const sourceAspect = sourceWidth / sourceHeight;
      let cropX = 0;
      let cropY = 0;
      let cropWidth = sourceWidth;
      let cropHeight = sourceHeight;

      if (sourceAspect < targetAspect) {
        cropHeight = sourceWidth / targetAspect;
        cropY = (sourceHeight - cropHeight) * ARENA_VERTICAL_CROP_ANCHOR;
      } else if (sourceAspect > targetAspect) {
        cropWidth = sourceHeight * targetAspect;
        cropX = (sourceWidth - cropWidth) / 2;
      }

      context.save();
      const inheritedAlpha = Number.isFinite(context.globalAlpha) ? context.globalAlpha : 1;
      context.globalAlpha = inheritedAlpha * clamp(alpha, 0, 1);
      context.drawImage(
        image,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        WIDTH,
        HEIGHT,
      );
      context.restore();
      return true;
    }

    drawArenaCrowd(context) {
      const firstFrame = arenaCrowdImages[0];
      if (!this.isArenaLayerReady(firstFrame)) return false;
      const allFramesReady = arenaCrowdImages.every((image) => this.isArenaLayerReady(image));
      if (ARENA_REDUCED_MOTION || !allFramesReady) {
        return this.drawArenaLayer(context, firstFrame);
      }

      const framePosition = (this.elapsed / ARENA_CROWD_FRAME_SECONDS) % arenaCrowdImages.length;
      const frameIndex = Math.floor(framePosition);
      const nextIndex = (frameIndex + 1) % arenaCrowdImages.length;
      const frameProgress = framePosition - frameIndex;
      const blendStart = 1 - ARENA_CROWD_BLEND_FRACTION;
      const linearMix = clamp(
        (frameProgress - blendStart) / ARENA_CROWD_BLEND_FRACTION,
        0,
        1,
      );
      const smoothMix = linearMix * linearMix * (3 - 2 * linearMix);
      this.drawArenaLayer(context, arenaCrowdImages[frameIndex]);
      if (smoothMix > 0) this.drawArenaLayer(context, arenaCrowdImages[nextIndex], smoothMix);
      return true;
    }

    drawOctagon(context) {
      const foregroundReady = this.isArenaLayerReady(arenaForegroundImage);
      const crowdReady = this.isArenaLayerReady(arenaCrowdImages[0]);
      if (foregroundReady && crowdReady) {
        this.drawArenaCrowd(context);
        this.drawArenaLayer(context, arenaForegroundImage);
      } else {
        this.drawLegacyOctagon(context);
      }
    }

    drawLegacyOctagon(context) {
      const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
      sky.addColorStop(0, "#05050d");
      sky.addColorStop(0.58, "#111127");
      sky.addColorStop(1, "#211020");
      context.fillStyle = sky;
      context.fillRect(-30, -30, WIDTH + 60, HEIGHT + 60);

      const arenaGlow = context.createRadialGradient(WIDTH / 2, 230, 20, WIDTH / 2, 310, 560);
      arenaGlow.addColorStop(0, "rgba(53, 242, 229, 0.09)");
      arenaGlow.addColorStop(0.45, "rgba(141, 92, 255, 0.05)");
      arenaGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = arenaGlow;
      context.fillRect(0, 0, WIDTH, HEIGHT);

      context.save();
      context.globalAlpha = 0.7;
      for (let index = 0; index < 90; index += 1) {
        const x = (index * 47) % WIDTH;
        const row = Math.floor(index / 28);
        const y = 275 + row * 35 + Math.sin(index * 1.7) * 8;
        context.fillStyle = index % 9 === 0 ? "#50334f" : "#11111e";
        context.beginPath();
        context.arc(x, y, 9 + (index % 4), 0, Math.PI * 2);
        context.fill();
        context.fillRect(x - 9, y + 7, 18, 26);
      }
      context.restore();

      context.save();
      context.strokeStyle = "rgba(147, 150, 185, 0.16)";
      context.lineWidth = 1;
      const fenceTop = 118;
      const fenceBottom = 492;
      for (let x = 80; x <= WIDTH - 80; x += 24) {
        context.beginPath();
        context.moveTo(x, fenceTop);
        context.lineTo(x + 185, fenceBottom);
        context.stroke();
        context.beginPath();
        context.moveTo(x, fenceBottom);
        context.lineTo(x + 185, fenceTop);
        context.stroke();
      }
      context.strokeStyle = "rgba(53, 242, 229, 0.35)";
      context.lineWidth = 4;
      context.shadowColor = "#35f2e5";
      context.shadowBlur = 12;
      context.beginPath();
      context.moveTo(88, fenceBottom);
      context.lineTo(88, 90);
      context.lineTo(WIDTH - 88, 90);
      context.lineTo(WIDTH - 88, fenceBottom);
      context.stroke();
      context.restore();

      const mat = context.createLinearGradient(0, 410, 0, HEIGHT);
      mat.addColorStop(0, "#22243a");
      mat.addColorStop(1, "#0b0c17");
      context.fillStyle = mat;
      context.strokeStyle = "rgba(255, 59, 157, 0.52)";
      context.lineWidth = 5;
      context.shadowColor = "#ff3b9d";
      context.shadowBlur = 14;
      context.beginPath();
      context.moveTo(214, 407);
      context.lineTo(WIDTH - 214, 407);
      context.lineTo(WIDTH - 58, 535);
      context.lineTo(WIDTH - 165, 694);
      context.lineTo(165, 694);
      context.lineTo(58, 535);
      context.closePath();
      context.fill();
      context.stroke();
      context.shadowBlur = 0;

      context.save();
      context.translate(WIDTH / 2, 552);
      context.scale(1, 0.36);
      context.strokeStyle = "rgba(53, 242, 229, 0.22)";
      context.lineWidth = 8;
      context.beginPath();
      context.arc(0, 0, 180, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = "rgba(255, 255, 255, 0.055)";
      context.font = "800 58px Orbitron, sans-serif";
      context.textAlign = "center";
      context.fillText("NEON MMA", 0, 18);
      context.restore();

      context.globalAlpha = 0.028;
      context.fillStyle = "#fff";
      for (let y = 0; y < HEIGHT; y += 5) context.fillRect(0, y, WIDTH, 1);
      context.globalAlpha = 1;
    }

    drawHud(context) {
      const width = 430;
      this.drawHudFrame(context);
      this.drawFighterHud(context, this.fighterOne, 50, false, width);
      this.drawFighterHud(context, this.fighterTwo, WIDTH - 50 - width, true, width);

      context.save();
      context.textAlign = "center";
      context.fillStyle = "#f6f7ff";
      context.font = "700 40px Orbitron, sans-serif";
      context.shadowColor = "rgba(255,255,255,0.24)";
      context.shadowBlur = 12;
      if (this.mode === "practice") {
        context.fillText("∞", WIDTH / 2, 59);
      } else {
        const totalSeconds = Math.ceil(this.timer);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = String(totalSeconds % 60).padStart(2, "0");
        context.fillText(`${minutes}:${seconds}`, WIDTH / 2, 59);
      }
      context.shadowBlur = 0;
      context.fillStyle = "#d9d9e5";
      context.font = "700 10px Orbitron, sans-serif";
      context.fillText(
        this.mode === "practice" ? "NO TIME LIMIT" : `ROUND ${this.round} / ${MAX_ROUNDS}`,
        WIDTH / 2,
        79,
      );
      const onlineLatencyMs = this.online?.latencyMs;
      const onlineQuality = Number.isFinite(onlineLatencyMs)
        ? onlineLatency.dataset.quality
        : "unknown";
      context.fillStyle = this.mode === "online"
        ? ONLINE_LATENCY_COLORS[onlineQuality] ?? ONLINE_LATENCY_COLORS.unknown
        : "#55576b";
      context.fillText(
        this.mode === "cpu"
          ? "QUICK FIGHT"
          : this.mode === "practice"
            ? "DAMAGE DISPLAY"
            : this.mode === "online"
              ? `ONLINE // ${this.onlineRole === "player1" ? "PLAYER 1" : "PLAYER 2"} // ${Number.isFinite(onlineLatencyMs) ? `${onlineLatencyMs} MS` : "-- MS"}`
              : "LOCAL SPARRING",
        WIDTH / 2,
        98,
      );
      context.restore();
    }

    drawHudFrame(context) {
      context.save();
      const topFade = context.createLinearGradient(0, 0, 0, 128);
      topFade.addColorStop(0, "rgba(3, 4, 12, 0.93)");
      topFade.addColorStop(0.76, "rgba(5, 6, 16, 0.7)");
      topFade.addColorStop(1, "rgba(5, 6, 16, 0)");
      context.fillStyle = topFade;
      context.fillRect(0, 0, WIDTH, 128);

      const centerX = WIDTH / 2;
      const centerGradient = context.createLinearGradient(centerX - 92, 0, centerX + 92, 0);
      centerGradient.addColorStop(0, "rgba(17, 27, 38, 0.98)");
      centerGradient.addColorStop(0.5, "rgba(9, 10, 23, 0.99)");
      centerGradient.addColorStop(1, "rgba(36, 15, 35, 0.98)");
      this.traceRoundedRect(context, centerX - 94, 12, 188, 98, 18);
      context.fillStyle = centerGradient;
      context.fill();
      context.strokeStyle = "rgba(2, 3, 10, 0.96)";
      context.lineWidth = 5;
      context.stroke();
      context.strokeStyle = "rgba(220, 225, 255, 0.32)";
      context.lineWidth = 1.5;
      context.stroke();

      context.beginPath();
      context.moveTo(centerX - 58, 108);
      context.lineTo(centerX, 108);
      context.strokeStyle = this.fighterOne.color;
      context.lineWidth = 2;
      context.stroke();
      context.beginPath();
      context.moveTo(centerX, 108);
      context.lineTo(centerX + 58, 108);
      context.strokeStyle = this.fighterTwo.color;
      context.stroke();
      context.restore();
    }

    traceRoundedRect(context, x, y, width, height, radius) {
      const safeRadius = Math.min(radius, width / 2, height / 2);
      context.beginPath();
      context.moveTo(x + safeRadius, y);
      context.lineTo(x + width - safeRadius, y);
      context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
      context.lineTo(x + width, y + height - safeRadius);
      context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
      context.lineTo(x + safeRadius, y + height);
      context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
      context.lineTo(x, y + safeRadius);
      context.quadraticCurveTo(x, y, x + safeRadius, y);
      context.closePath();
    }

    drawDamageNumbers(context) {
      for (const number of this.damageNumbers) {
        const alpha = clamp(number.life / number.maxLife, 0, 1);
        context.save();
        context.globalAlpha = Math.min(1, alpha * 1.8);
        context.fillStyle = number.color;
        context.strokeStyle = "rgba(4, 4, 14, 0.92)";
        context.lineWidth = 5;
        context.textAlign = "center";
        context.font = "800 22px Orbitron, sans-serif";
        context.shadowColor = number.color;
        context.shadowBlur = 12;
        context.strokeText(number.text, number.x, number.y);
        context.fillText(number.text, number.x, number.y);
        context.restore();
      }
    }

    drawFighterHud(context, fighter, x, reverse, width) {
      context.save();
      context.textAlign = reverse ? "right" : "left";
      const textX = reverse ? x + width : x;
      context.fillStyle = "#f5f5ff";
      context.font = "700 21px Orbitron, sans-serif";
      context.strokeStyle = "rgba(2, 3, 10, 0.9)";
      context.lineWidth = 4;
      context.strokeText(fighter.name, textX, 31);
      context.fillText(fighter.name, textX, 31);
      context.fillStyle = fighter.color;
      context.font = "600 9px Chakra Petch, sans-serif";
      context.fillText(fighter.style, textX, 46);

      const headX = reverse ? x + 92 : x + width - 92;
      const bodyX = reverse ? x + 43 : x + width - 43;
      this.drawHealthStatusIcon(context, "head", headX, 35, fighter.displayHead, fighter.color);
      this.drawHealthStatusIcon(context, "body", bodyX, 35, fighter.displayBody, fighter.color);
      this.drawStaminaBar(context, fighter, x, 65, width, 10, reverse);

      for (let index = 0; index < MAX_ROUNDS; index += 1) {
        const dotX = reverse ? x + width - index * 19 : x + index * 19;
        context.beginPath();
        context.arc(dotX, 96, 3.5, 0, Math.PI * 2);
        context.fillStyle = index < fighter.roundWins ? fighter.color : "rgba(255,255,255,0.12)";
        context.shadowColor = fighter.color;
        context.shadowBlur = index < fighter.roundWins ? 9 : 0;
        context.fill();
      }
      context.restore();
    }

    drawHealthStatusIcon(context, type, centerX, centerY, health, accent) {
      const status = getHudHealthState(health);
      const criticalPulse = status.tier === "critical"
        ? 0.78 + Math.sin(this.elapsed * 8) * 0.22
        : 1;

      context.save();
      context.globalAlpha = criticalPulse;
      context.beginPath();
      context.arc(centerX, centerY, 22, 0, Math.PI * 2);
      context.fillStyle = "rgba(3, 4, 12, 0.96)";
      context.fill();
      context.strokeStyle = "rgba(1, 2, 8, 0.95)";
      context.lineWidth = 5;
      context.stroke();

      context.beginPath();
      context.arc(centerX, centerY, 19, 0, Math.PI * 2);
      context.fillStyle = `${status.color}20`;
      context.fill();
      context.strokeStyle = `${accent}a8`;
      context.lineWidth = 2;
      context.stroke();

      context.beginPath();
      context.arc(centerX, centerY, 16, 0, Math.PI * 2);
      context.strokeStyle = `${status.color}80`;
      context.lineWidth = 1;
      context.stroke();

      context.fillStyle = status.color;
      context.strokeStyle = status.color;
      context.shadowColor = status.color;
      context.shadowBlur = status.glow;
      if (type === "head") this.drawHeadHealthGlyph(context, centerX - 1, centerY);
      else this.drawBodyHealthGlyph(context, centerX - 1, centerY);
      context.shadowBlur = 0;
      context.restore();
    }

    drawHeadHealthGlyph(context, centerX, centerY) {
      context.beginPath();
      context.arc(centerX - 1, centerY - 5, 6, 0, Math.PI * 2);
      context.fill();
      context.fillRect(centerX - 4, centerY, 7, 8);
      context.beginPath();
      context.moveTo(centerX - 9, centerY + 10);
      context.quadraticCurveTo(centerX - 1, centerY + 4, centerX + 7, centerY + 10);
      context.lineTo(centerX + 7, centerY + 12);
      context.lineTo(centerX - 9, centerY + 12);
      context.closePath();
      context.fill();
    }

    drawBodyHealthGlyph(context, centerX, centerY) {
      context.beginPath();
      context.arc(centerX, centerY - 10, 3.7, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(centerX - 11, centerY - 4);
      context.quadraticCurveTo(centerX - 5, centerY - 8, centerX - 3, centerY - 4);
      context.lineTo(centerX - 5, centerY + 10);
      context.lineTo(centerX, centerY + 13);
      context.lineTo(centerX + 5, centerY + 10);
      context.lineTo(centerX + 3, centerY - 4);
      context.quadraticCurveTo(centerX + 5, centerY - 8, centerX + 11, centerY - 4);
      context.lineTo(centerX + 8, centerY + 2);
      context.lineTo(centerX + 5, centerY - 1);
      context.lineTo(centerX + 4, centerY + 7);
      context.lineTo(centerX - 4, centerY + 7);
      context.lineTo(centerX - 5, centerY - 1);
      context.lineTo(centerX - 8, centerY + 2);
      context.closePath();
      context.fill();
    }

    drawStaminaBar(context, fighter, x, y, width, height, reverse) {
      const labelSpace = 66;
      const trackX = reverse ? x + labelSpace : x + 8;
      const trackWidth = width - labelSpace - 8;
      const labelX = reverse ? x + 10 : x + width - 10;

      this.traceRoundedRect(context, x, y - 6, width, height + 12, 10);
      context.fillStyle = "rgba(2, 3, 10, 0.92)";
      context.fill();
      context.strokeStyle = "rgba(1, 2, 7, 0.95)";
      context.lineWidth = 4;
      context.stroke();
      context.strokeStyle = `${fighter.color}78`;
      context.lineWidth = 1.5;
      context.stroke();

      context.save();
      this.traceRoundedRect(context, trackX, y, trackWidth, height, height / 2);
      context.clip();
      context.fillStyle = "rgba(255,255,255,0.08)";
      context.fillRect(trackX, y, trackWidth, height);
      const capacityWidth = clamp(trackWidth * (fighter.displayStaminaCap / 100), 0, trackWidth);
      const staminaWidth = clamp(trackWidth * (fighter.displayStamina / 100), 0, capacityWidth);
      const capacityX = reverse ? trackX + trackWidth - capacityWidth : trackX;
      const staminaX = reverse ? trackX + trackWidth - staminaWidth : trackX;

      context.fillStyle = `${fighter.color}3d`;
      context.fillRect(capacityX, y, capacityWidth, height);
      context.fillStyle = fighter.color;
      context.shadowColor = fighter.color;
      context.shadowBlur = 7;
      context.fillRect(staminaX, y, staminaWidth, height);
      context.shadowBlur = 0;
      context.restore();

      context.textAlign = reverse ? "left" : "right";
      context.fillStyle = fighter.color;
      context.font = "700 8px Orbitron, sans-serif";
      context.fillText("STAMINA", labelX, y + 8);

      if (capacityWidth < trackWidth - 1) {
        const capX = reverse ? trackX + trackWidth - capacityWidth : trackX + capacityWidth;
        context.strokeStyle = "rgba(255, 179, 92, 0.9)";
        context.beginPath();
        context.moveTo(capX, y - 1);
        context.lineTo(capX, y + height + 1);
        context.stroke();
      }
    }

    drawCallout(context) {
      if (!this.callout) return;
      const alpha = clamp(this.callout.life / this.callout.maxLife, 0, 1);
      context.save();
      context.globalAlpha = Math.min(1, alpha * 2.2);
      context.translate(WIDTH / 2, 155);
      context.fillStyle = "rgba(5,5,15,0.75)";
      context.strokeStyle = this.callout.color;
      context.lineWidth = 1;
      context.fillRect(-105, -18, 210, 36);
      context.strokeRect(-105, -18, 210, 36);
      context.fillStyle = this.callout.color;
      context.shadowColor = this.callout.color;
      context.shadowBlur = 13;
      context.textAlign = "center";
      context.font = "700 12px Orbitron, sans-serif";
      context.fillText(this.callout.text, 0, 5);
      context.restore();
    }
  }

  const keys = new Set();
  const pressed = new Set();
  const onlineControlCodes = new Set([
    "KeyW", "KeyA", "KeyS", "KeyD", "KeyT", "KeyY", "KeyG", "KeyH", "KeyE", "Space",
  ]);
  const onlineActionCodes = new Set(["KeyT", "KeyY", "KeyG", "KeyH"]);
  const game = new NeonMMA();

  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)
      && game.state !== "menu") event.preventDefault();
    if (!keys.has(event.code)) pressed.add(event.code);
    keys.add(event.code);
    if (!event.repeat && onlineControlCodes.has(event.code) && game.sendOnlineInputNow()) {
      if (onlineActionCodes.has(event.code)) pressed.delete(event.code);
    }
    if (event.code === "Escape" && !event.repeat) {
      if (game.state === "menu"
        && !menuScreen.classList.contains("is-hidden")
        && menuScreen.dataset.menuSection !== "root") {
        game.showMenuSection("root");
      } else {
        game.togglePause();
      }
    }
    if (event.code === "Enter"
      && game.state === "menu"
      && !menuScreen.classList.contains("is-hidden")
      && menuScreen.dataset.menuSection === "root"
      && !event.repeat) game.start("cpu");
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
    if (onlineControlCodes.has(event.code)) game.sendOnlineInputNow(false);
  });
  window.addEventListener("blur", () => {
    keys.clear();
    pressed.clear();
    game.sendOnlineInputNow(false);
    if (["fighting", "ground"].includes(game.state)) game.togglePause();
  });
  window.addEventListener("resize", syncCanvasResolution);
  document.addEventListener?.("visibilitychange", () => game.syncOnlineBackgroundTicker());
  document.addEventListener?.("fullscreenchange", syncCanvasResolution);

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.mode === "online") game.openOnlineLobby();
      else game.start(button.dataset.mode);
    });
  });
  document.querySelectorAll("[data-menu-target]").forEach((button) => {
    button.addEventListener("click", () => game.showMenuSection(button.dataset.menuTarget));
  });
  document.querySelectorAll("[data-menu-back]").forEach((button) => {
    button.addEventListener("click", () => game.showMenuSection("root"));
  });
  onlineConnectForm.addEventListener("submit", (event) => {
    event.preventDefault();
    game.connectOnline(onlineNameInput.value);
  });
  onlineAccept.addEventListener("click", () => {
    if (!game.pendingChallenger) return;
    game.online?.acceptChallenge(game.pendingChallenger.id);
    game.hideOnlineChallenge();
  });
  onlineDecline.addEventListener("click", () => {
    if (!game.pendingChallenger) return;
    game.online?.declineChallenge(game.pendingChallenger.id);
    game.hideOnlineChallenge();
    game.setOnlineStatus({ state: "online", message: "CONNECTED // SEARCHING FOR FIGHTERS" });
  });
  onlineBack.addEventListener("click", () => {
    game.online?.disconnect();
    game.hideOnlineChallenge();
    game.hideOutgoingChallenge();
    game.setOnlineConnectionState(false);
    game.mode = "cpu";
    game.returnToMenu("online");
  });
  document.querySelector("#resume-button").addEventListener("click", () => game.togglePause());
  rematchButton.addEventListener("click", () => {
    if (game.mode === "online") game.returnToOnlineLobby();
    else game.start(game.mode);
  });
  document.querySelectorAll(".menu-button").forEach((button) => {
    button.addEventListener("click", () => game.returnToMenu());
  });
  document.querySelector(".brand").addEventListener("click", (event) => {
    event.preventDefault();
    game.returnToMenu();
  });

  soundButton.addEventListener("click", () => {
    game.synth.muted = !game.synth.muted;
    soundButton.classList.toggle("is-muted", game.synth.muted);
    soundIcon.textContent = game.synth.muted ? "×" : "♪";
    soundButton.setAttribute("aria-label", game.synth.muted ? "Activar sonido" : "Silenciar sonido");
    if (!game.synth.muted) game.synth.tone(420, 0.08, "sine", 0.02, 640);
  });

  document.querySelector("#fullscreen-button").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await shell.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // Fullscreen can be disabled inside an embedded preview.
    }
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { game, Fighter, ATTACKS, GAMEPLAY_RULES, getHudHealthState };
  }
})();

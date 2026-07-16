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
  const combatControls = document.querySelector("#combat-controls");
  const soundButton = document.querySelector("#sound-button");
  const soundIcon = document.querySelector("#sound-icon");

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const FLOOR = 604;
  const ROUND_TIME = 60;
  const MAX_ROUNDS = 3;
  const STAGE_LEFT = 105;
  const STAGE_RIGHT = WIDTH - 105;
  const SPRITE_COLUMNS = 4;
  const SPRITE_ROWS = 2;

  const spriteSheet = new Image();
  spriteSheet.src = "assets/fighter-mma-sprites.png";

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const random = (min, max) => Math.random() * (max - min) + min;

  function overlap(a, b) {
    return a.x < b.x + b.width
      && a.x + a.width > b.x
      && a.y < b.y + b.height
      && a.y + a.height > b.y;
  }

  const ATTACKS = {
    jab: {
      label: "JAB",
      frame: 1,
      target: "head",
      startup: 0.07,
      active: 0.07,
      recovery: 0.14,
      damage: 6,
      stamina: 5,
      reach: 118,
      idealRange: 88,
      stun: 0.11,
      knockback: 38,
    },
    cross: {
      label: "CROSS",
      frame: 2,
      target: "head",
      startup: 0.14,
      active: 0.08,
      recovery: 0.23,
      damage: 11,
      stamina: 10,
      reach: 136,
      idealRange: 106,
      stun: 0.2,
      knockback: 68,
    },
    bodyKick: {
      label: "BODY KICK",
      frame: 3,
      target: "body",
      startup: 0.2,
      active: 0.1,
      recovery: 0.33,
      damage: 14,
      stamina: 16,
      reach: 168,
      idealRange: 137,
      stun: 0.24,
      knockback: 82,
    },
    headKick: {
      label: "HEAD KICK",
      frame: 4,
      target: "head",
      startup: 0.28,
      active: 0.1,
      recovery: 0.44,
      damage: 20,
      stamina: 25,
      reach: 184,
      idealRange: 153,
      stun: 0.34,
      knockback: 125,
      heavy: true,
    },
    takedown: {
      label: "TAKEDOWN",
      frame: 7,
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
      this.name = config.name;
      this.style = config.style;
      this.color = config.color;
      this.accent = config.accent;
      this.player = config.player;
      this.roundWins = 0;
      this.matchScore = 0;
      this.animationTime = 0;
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
      this.stamina = 100;
      this.attack = null;
      this.guard = null;
      this.stun = 0;
      this.evadeTimer = 0;
      this.evadeCooldown = 0;
      this.invulnerable = 0;
      this.knockdownTimer = 0;
      this.roundDamage = 0;
      this.takedowns = 0;
      this.knockdownsScored = 0;
      this.knockdownsSuffered = 0;
      this.moveFlash = 0;
    }

    get hurtbox() {
      return {
        x: this.x - 43,
        y: FLOOR - 178,
        width: 86,
        height: 174,
      };
    }

    get currentAttack() {
      return this.attack ? ATTACKS[this.attack.type] : null;
    }

    get maxStamina() {
      return 55 + this.bodyHealth * 0.45;
    }

    update(deltaTime, input, opponent) {
      this.animationTime += deltaTime;
      this.stun = Math.max(0, this.stun - deltaTime);
      this.evadeTimer = Math.max(0, this.evadeTimer - deltaTime);
      this.evadeCooldown = Math.max(0, this.evadeCooldown - deltaTime);
      this.invulnerable = Math.max(0, this.invulnerable - deltaTime);
      this.moveFlash = Math.max(0, this.moveFlash - deltaTime);
      this.displayHead = lerp(this.displayHead, this.headHealth, 1 - Math.pow(0.00003, deltaTime));
      this.displayBody = lerp(this.displayBody, this.bodyHealth, 1 - Math.pow(0.00003, deltaTime));

      if (this.knockdownTimer > 0) {
        this.knockdownTimer -= deltaTime;
        this.velocityX *= Math.pow(0.02, deltaTime);
        this.x += this.velocityX * deltaTime;
        if (this.knockdownTimer <= 0) {
          this.headHealth = Math.max(this.headHealth, 10);
          this.bodyHealth = Math.max(this.bodyHealth, 8);
          this.stun = 0.4;
          this.game.showCallout("BACK ON THE FEET", this.color, 0.8);
        }
        return;
      }

      if (!this.attack && this.stun <= 0 && this.evadeTimer <= 0 && Math.abs(opponent.x - this.x) > 4) {
        this.facing = opponent.x > this.x ? 1 : -1;
      }

      this.guard = null;
      if (!this.attack && this.stun <= 0 && this.evadeTimer <= 0) {
        if (input.guardHigh) this.guard = "high";
        else if (input.guardLow) this.guard = "low";
      }

      if (!this.attack && this.stun <= 0 && this.evadeTimer <= 0) {
        const movementPenalty = 0.68 + (this.stamina / 100) * 0.32;
        const targetVelocity = this.guard ? input.move * 105 : input.move * 260 * movementPenalty;
        this.velocityX = lerp(this.velocityX, targetVelocity, 1 - Math.pow(0.001, deltaTime));

        if (input.evade && this.evadeCooldown <= 0 && this.stamina >= 10) {
          this.startEvade(opponent);
        } else if (input.takedown) {
          this.startAttack("takedown");
        } else if (input.headKick) {
          this.startAttack("headKick");
        } else if (input.bodyKick) {
          this.startAttack("bodyKick");
        } else if (input.cross) {
          this.startAttack("cross");
        } else if (input.jab) {
          this.startAttack("jab");
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

      const regenRate = this.attack ? 2.5 : this.guard ? 6 : this.evadeTimer > 0 ? 1 : 17;
      this.stamina = clamp(this.stamina + regenRate * deltaTime, 0, this.maxStamina);
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
      if (this.stamina < definition.stamina) {
        this.game.showCallout("LOW STAMINA", "#ffb35c", 0.45);
        this.game.synth.tone(90, 0.07, "square", 0.012, 65);
        return;
      }
      this.stamina -= definition.stamina;
      this.attack = { type, elapsed: 0, connected: false };
      this.guard = null;
      this.moveFlash = 0.3;
    }

    updateAttack(deltaTime, opponent) {
      const definition = this.currentAttack;
      this.attack.elapsed += deltaTime;
      const activeStart = definition.startup;
      const activeEnd = activeStart + definition.active;

      if (this.attack.type === "takedown" && this.attack.elapsed > 0.08 && this.attack.elapsed < activeEnd) {
        this.x += this.facing * 190 * deltaTime;
      }

      if (this.attack.elapsed >= activeStart
        && this.attack.elapsed <= activeEnd
        && !this.attack.connected
        && overlap(this.getAttackHitbox(), opponent.hurtbox)) {
        this.attack.connected = true;
        this.game.resolveAttack(this, opponent, definition);
      }

      const totalDuration = definition.startup + definition.active + definition.recovery;
      if (this.attack && this.attack.elapsed >= totalDuration) this.attack = null;
    }

    getAttackHitbox() {
      const definition = this.currentAttack;
      return {
        x: this.facing === 1 ? this.x + 16 : this.x - definition.reach - 16,
        y: FLOOR - 184,
        width: definition.reach,
        height: 178,
      };
    }

    draw(context, options = {}) {
      const frame = options.frame ?? this.getFrame();
      const drawX = options.x ?? this.x;
      const drawY = options.y ?? FLOOR;
      const rotation = options.rotation ?? (this.knockdownTimer > 0 ? -this.facing * Math.PI / 2 : 0);
      const scale = options.scale ?? 1;
      const facing = options.facing ?? this.facing;
      const sheetWidth = spriteSheet.naturalWidth || 1774;
      const sheetHeight = spriteSheet.naturalHeight || 887;
      const frameWidth = sheetWidth / SPRITE_COLUMNS;
      const frameHeight = sheetHeight / SPRITE_ROWS;
      const column = frame % SPRITE_COLUMNS;
      const row = Math.floor(frame / SPRITE_COLUMNS);
      const destinationSize = 350 * scale;

      context.save();
      context.globalAlpha = 0.38;
      context.fillStyle = "#020207";
      context.filter = "blur(7px)";
      context.beginPath();
      context.ellipse(drawX, drawY + 4, this.knockdownTimer > 0 ? 105 : 64, 14, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();

      context.save();
      context.translate(drawX, drawY);
      context.rotate(rotation);
      context.scale(facing, 1);
      context.shadowColor = this.color;
      context.shadowBlur = this.moveFlash > 0 ? 24 : 12;

      if (spriteSheet.complete && sheetWidth > 0) {
        context.drawImage(
          spriteSheet,
          column * frameWidth,
          row * frameHeight,
          frameWidth,
          frameHeight,
          -destinationSize / 2,
          -destinationSize,
          destinationSize,
          destinationSize,
        );
      } else {
        context.fillStyle = this.color;
        context.fillRect(-38, -170, 76, 170);
      }
      context.restore();

      if (this.guard && !options.hideStatus) {
        context.save();
        context.globalAlpha = 0.46 + Math.sin(this.animationTime * 20) * 0.08;
        context.strokeStyle = this.guard === "high" ? this.color : this.accent;
        context.shadowColor = context.strokeStyle;
        context.shadowBlur = 15;
        context.lineWidth = 3;
        context.beginPath();
        const guardY = this.guard === "high" ? FLOOR - 132 : FLOOR - 70;
        context.arc(this.x + this.facing * 22, guardY, 48, -1.2, 1.2);
        context.stroke();
        context.restore();
      }

      if (!options.hideStatus) this.drawStatus(context);
    }

    getFrame() {
      if (this.attack) return this.currentAttack.frame;
      if (this.guard === "high") return 5;
      if (this.guard === "low") return 6;
      return 0;
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
      context.fillText(label, this.x, FLOOR - 214);
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
      this.shake = 0;
      this.hitStop = 0;
      this.flash = 0;
      this.elapsed = 0;
      this.callout = null;
      this.aiTimer = 0;
      this.aiIntent = this.emptyInput();
      this.lastTime = performance.now();

      this.fighterOne = new Fighter(this, {
        name: "ROOK",
        style: "PRESSURE STRIKER",
        color: "#35f2e5",
        accent: "#d6ff7d",
        player: 1,
        x: 380,
        facing: 1,
      });
      this.fighterTwo = new Fighter(this, {
        name: "VEX",
        style: "COUNTER WRESTLER",
        color: "#ff3b9d",
        accent: "#ffc35b",
        player: 2,
        x: 900,
        facing: -1,
      });

      requestAnimationFrame((time) => this.loop(time));
    }

    emptyInput() {
      return {
        move: 0,
        guardHigh: false,
        guardLow: false,
        jab: false,
        cross: false,
        bodyKick: false,
        headKick: false,
        takedown: false,
        evade: false,
      };
    }

    start(mode) {
      this.synth.ensure();
      this.mode = mode;
      this.round = 1;
      this.matchWinner = null;
      this.matchMethod = "";
      this.fighterOne.roundWins = 0;
      this.fighterTwo.roundWins = 0;
      this.fighterOne.matchScore = 0;
      this.fighterTwo.matchScore = 0;
      menuScreen.classList.add("is-hidden");
      pauseScreen.classList.add("is-hidden");
      resultScreen.classList.add("is-hidden");
      combatControls.classList.remove("is-hidden");
      this.startRound();
      canvas.focus();
    }

    startRound() {
      this.fighterOne.resetRound(380, 1);
      this.fighterTwo.resetRound(900, -1);
      this.timer = ROUND_TIME;
      this.ground = null;
      this.particles.length = 0;
      this.state = "intro";
      this.introTimer = 1.8;
      this.introFightShown = false;
      this.aiTimer = 0;
      this.aiIntent = this.emptyInput();
      this.showRoundMessage(`ROUND ${this.round} OF ${MAX_ROUNDS}`, "READY");
      this.synth.announce();
    }

    returnToMenu() {
      this.state = "menu";
      this.ground = null;
      this.matchWinner = null;
      menuScreen.classList.remove("is-hidden");
      pauseScreen.classList.add("is-hidden");
      resultScreen.classList.add("is-hidden");
      roundMessage.classList.add("is-hidden");
      combatControls.classList.add("is-hidden");
    }

    togglePause() {
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
        return {
          move: (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
          guardHigh: keys.has("KeyW"),
          guardLow: keys.has("KeyS"),
          jab: pressed.has("KeyF"),
          cross: pressed.has("KeyG"),
          bodyKick: pressed.has("KeyR"),
          headKick: pressed.has("KeyT"),
          takedown: pressed.has("KeyE"),
          evade: pressed.has("Space"),
        };
      }
      return {
        move: (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0),
        guardHigh: keys.has("ArrowUp"),
        guardLow: keys.has("ArrowDown"),
        jab: pressed.has("KeyK"),
        cross: pressed.has("KeyL"),
        bodyKick: pressed.has("KeyO"),
        headKick: pressed.has("KeyP"),
        takedown: pressed.has("KeyI"),
        evade: pressed.has("Slash"),
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
        } else if (cpu.stamina < 24) {
          this.aiIntent.move = -direction;
          this.aiIntent.guardHigh = Math.random() < 0.5;
        } else if (distance > 165) {
          this.aiIntent.move = direction;
        } else if (distance < 62) {
          this.aiIntent.move = -direction;
          if (Math.random() < 0.2) this.aiIntent.takedown = true;
        } else {
          const choice = Math.random();
          if (distance < 105 && choice < 0.13) this.aiIntent.takedown = true;
          else if (choice < 0.4) this.aiIntent.jab = true;
          else if (choice < 0.63) this.aiIntent.cross = true;
          else if (distance > 105 && choice < 0.84) this.aiIntent.bodyKick = true;
          else if (distance > 125 && choice < 0.94) this.aiIntent.headKick = true;
          else this.aiIntent.move = Math.random() < 0.5 ? direction : -direction;
        }
      }

      const input = { ...this.aiIntent };
      this.aiIntent.jab = false;
      this.aiIntent.cross = false;
      this.aiIntent.bodyKick = false;
      this.aiIntent.headKick = false;
      this.aiIntent.takedown = false;
      this.aiIntent.evade = false;
      return input;
    }

    resolveAttack(attacker, target, definition) {
      if (target.invulnerable > 0) {
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
      const staminaQuality = 0.68 + (attacker.stamina / 100) * 0.32;
      const counterBonus = target.attack ? 1.14 : 1;
      const guardMultiplier = matchingGuard ? 0.26 : 1;
      const damage = definition.damage * rangeQuality * staminaQuality * counterBonus * guardMultiplier;

      if (definition.target === "head") target.headHealth = clamp(target.headHealth - damage, 0, 100);
      else target.bodyHealth = clamp(target.bodyHealth - damage, 0, 100);

      attacker.roundDamage += damage;
      attacker.matchScore += damage;
      target.stamina = Math.max(0, target.stamina - (matchingGuard ? definition.damage * 0.42 : damage * 0.15));
      target.stun = matchingGuard ? 0.08 : definition.stun;
      target.velocityX = attacker.facing * definition.knockback * (matchingGuard ? 0.28 : 1);
      if (!matchingGuard) target.attack = null;

      this.spawnImpact(target.x - attacker.facing * 18, definition.target === "head" ? FLOOR - 142 : FLOOR - 78, attacker.color, definition.heavy ? 22 : 14);
      this.shake = definition.heavy && !matchingGuard ? 14 : matchingGuard ? 3 : 7;
      this.hitStop = definition.heavy ? 0.065 : 0.035;
      this.flash = definition.heavy && !matchingGuard ? 0.13 : 0.04;
      this.synth.strike(matchingGuard, definition.heavy);

      if (matchingGuard) {
        this.showCallout("BLOCKED", target.color, 0.4);
      } else if (counterBonus > 1) {
        this.showCallout("COUNTER", attacker.color, 0.55);
      } else if (rangeQuality > 0.94) {
        this.showCallout("CLEAN HIT", attacker.color, 0.42);
      }

      if (target.headHealth <= 0) {
        this.finishFight(attacker, "K.O.");
      } else if (target.bodyHealth <= 0) {
        this.finishFight(attacker, "BODY TKO");
      } else if (definition.heavy && !matchingGuard && target.headHealth < 34 && Math.random() < 0.48) {
        this.knockDown(attacker, target);
      }
    }

    knockDown(attacker, target) {
      target.knockdownsSuffered += 1;
      attacker.knockdownsScored += 1;
      attacker.matchScore += 18;
      target.knockdownTimer = 1.75;
      target.velocityX = attacker.facing * 150;
      target.attack = null;
      this.showCallout("KNOCKDOWN", attacker.color, 1);
      if (target.knockdownsSuffered >= 3) this.finishFight(attacker, "TKO");
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
          ? { ...this.emptyInput(), jab: sequence.strikeCooldown <= 0 }
          : this.getKeyboardInput(2);
      const defenderInput = sequence.target.player === 1
        ? this.getKeyboardInput(1)
        : this.mode === "cpu"
          ? { ...this.emptyInput(), guardHigh: Math.random() < 0.75 }
          : this.getKeyboardInput(2);

      if ((attackerInput.jab || attackerInput.cross) && sequence.strikeCooldown <= 0 && sequence.attacker.stamina >= 4) {
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
      const minimum = 78;
      if (distance < minimum && distance > 0.01) {
        const direction = two.x > one.x ? 1 : -1;
        const correction = (minimum - distance) / 2;
        one.x -= direction * correction;
        two.x += direction * correction;
        one.x = clamp(one.x, STAGE_LEFT, STAGE_RIGHT);
        two.x = clamp(two.x, STAGE_LEFT, STAGE_RIGHT);
      }
    }

    finishFight(winner, method) {
      if (["roundOver", "matchOver"].includes(this.state)) return;
      this.matchWinner = winner;
      this.matchMethod = method;
      this.state = "roundOver";
      this.ground = null;
      this.roundDelay = 2.3;
      this.showRoundMessage(`${winner.name} // ${method}`, method);
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
      resultScreen.classList.remove("is-hidden");
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
        this.fighterOne.animationTime += deltaTime;
        this.fighterTwo.animationTime += deltaTime;
        if (this.introTimer < 0.72 && !this.introFightShown) {
          this.introFightShown = true;
          this.showRoundMessage(`ROUND ${this.round} OF ${MAX_ROUNDS}`, "FIGHT");
          this.synth.announce();
        }
        if (this.introTimer <= 0) {
          this.state = "fighting";
          roundMessage.classList.add("is-hidden");
        }
      } else if (this.state === "fighting") {
        this.timer = Math.max(0, this.timer - deltaTime);
        this.fighterOne.update(deltaTime, this.getKeyboardInput(1), this.fighterTwo);
        if (this.state === "fighting") {
          const inputTwo = this.mode === "cpu" ? this.getCpuInput(deltaTime) : this.getKeyboardInput(2);
          this.fighterTwo.update(deltaTime, inputTwo, this.fighterOne);
        }
        if (this.state === "fighting") this.resolveFighterSpacing();
        if (this.timer <= 0) this.finishRoundDecision();
      } else if (this.state === "ground") {
        this.timer = Math.max(0, this.timer - deltaTime);
        this.updateGround(deltaTime);
        if (this.timer <= 0 && this.state === "ground") {
          this.endGround();
          this.finishRoundDecision();
        }
      } else if (this.state === "roundOver") {
        this.roundDelay -= deltaTime;
        this.fighterOne.animationTime += deltaTime;
        this.fighterTwo.animationTime += deltaTime;
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
      else if (!["paused", "menu", "matchOver"].includes(this.state)) this.update(deltaTime);
      else if (this.state === "menu") this.elapsed += deltaTime;
      this.draw();
      pressed.clear();
      requestAnimationFrame((nextTime) => this.loop(nextTime));
    }

    draw() {
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
      context.fillText("GROUND CONTROL // F/G TO STRIKE", center, FLOOR - 235);
      context.restore();
    }

    drawOctagon(context) {
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
      this.drawFighterHud(context, this.fighterOne, 50, false, width);
      this.drawFighterHud(context, this.fighterTwo, WIDTH - 50 - width, true, width);

      context.save();
      context.textAlign = "center";
      context.fillStyle = "#f6f7ff";
      context.font = "700 43px Orbitron, sans-serif";
      context.shadowColor = "rgba(255,255,255,0.24)";
      context.shadowBlur = 12;
      context.fillText(String(Math.ceil(this.timer)).padStart(2, "0"), WIDTH / 2, 67);
      context.shadowBlur = 0;
      context.fillStyle = "#77798e";
      context.font = "700 10px Chakra Petch, sans-serif";
      context.fillText(`ROUND ${this.round} / ${MAX_ROUNDS}`, WIDTH / 2, 88);
      context.fillStyle = "#55576b";
      context.fillText(this.mode === "cpu" ? "QUICK FIGHT" : "LOCAL SPARRING", WIDTH / 2, 104);
      context.restore();
    }

    drawFighterHud(context, fighter, x, reverse, width) {
      context.save();
      context.textAlign = reverse ? "right" : "left";
      const textX = reverse ? x + width : x;
      context.fillStyle = "#f5f5ff";
      context.font = "700 19px Orbitron, sans-serif";
      context.fillText(fighter.name, textX, 30);
      context.fillStyle = fighter.color;
      context.font = "600 9px Chakra Petch, sans-serif";
      context.fillText(fighter.style, textX, 43);

      this.drawBar(context, x, 51, width, 20, fighter.displayHead / 100, fighter.color, reverse, "HEAD");
      this.drawBar(context, x, 76, width, 7, fighter.displayBody / 100, "#ffad57", reverse, "BODY");
      this.drawBar(context, x, 88, width, 6, fighter.stamina / 100, "#d6ff7d", reverse, "STA");

      for (let index = 0; index < MAX_ROUNDS; index += 1) {
        const dotX = reverse ? x + width - index * 19 : x + index * 19;
        context.beginPath();
        context.arc(dotX, 108, 4.5, 0, Math.PI * 2);
        context.fillStyle = index < fighter.roundWins ? fighter.color : "rgba(255,255,255,0.12)";
        context.shadowColor = fighter.color;
        context.shadowBlur = index < fighter.roundWins ? 9 : 0;
        context.fill();
      }
      context.restore();
    }

    drawBar(context, x, y, width, height, ratio, color, reverse, label) {
      context.fillStyle = "rgba(1, 1, 8, 0.78)";
      context.strokeStyle = "rgba(255,255,255,0.14)";
      context.lineWidth = 1;
      context.fillRect(x, y, width, height);
      context.strokeRect(x, y, width, height);
      const fillWidth = clamp(width * ratio, 0, width);
      context.fillStyle = color;
      context.shadowColor = color;
      context.shadowBlur = height > 10 ? 10 : 5;
      context.fillRect(reverse ? x + width - fillWidth : x, y, fillWidth, height);
      context.shadowBlur = 0;
      if (height > 10) {
        context.fillStyle = "rgba(255,255,255,0.6)";
        context.font = "700 8px Chakra Petch, sans-serif";
        context.textAlign = reverse ? "left" : "right";
        context.fillText(label, reverse ? x + 7 : x + width - 7, y + 14);
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
  const game = new NeonMMA();

  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)
      && game.state !== "menu") event.preventDefault();
    if (!keys.has(event.code)) pressed.add(event.code);
    keys.add(event.code);
    if (event.code === "Escape" && !event.repeat) game.togglePause();
    if (event.code === "Enter" && game.state === "menu" && !event.repeat) game.start("cpu");
  });

  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => {
    keys.clear();
    pressed.clear();
    if (["fighting", "ground"].includes(game.state)) game.togglePause();
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => game.start(button.dataset.mode));
  });
  document.querySelector("#resume-button").addEventListener("click", () => game.togglePause());
  document.querySelector("#rematch-button").addEventListener("click", () => game.start(game.mode));
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
})();

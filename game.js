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
  const soundButton = document.querySelector("#sound-button");
  const soundIcon = document.querySelector("#sound-icon");

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const FLOOR = 592;
  const GRAVITY = 2250;
  const MATCH_TIME = 60;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const random = (min, max) => Math.random() * (max - min) + min;

  function rectanglesOverlap(a, b) {
    return a.x < b.x + b.width
      && a.x + a.width > b.x
      && a.y < b.y + b.height
      && a.y + a.height > b.y;
  }

  function roundedRect(context, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.roundRect(x, y, width, height, safeRadius);
  }

  class Synth {
    constructor() {
      this.context = null;
      this.muted = false;
    }

    ensureContext() {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.context = new AudioContext();
      }
      if (this.context?.state === "suspended") this.context.resume();
    }

    tone(frequency, duration, type = "sine", volume = 0.04, endFrequency = frequency) {
      if (this.muted) return;
      this.ensureContext();
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

    hit(blocked = false) {
      this.tone(blocked ? 180 : 92, blocked ? 0.08 : 0.12, "square", blocked ? 0.025 : 0.045, 48);
      if (!blocked) this.tone(420, 0.045, "sawtooth", 0.018, 170);
    }

    special() {
      this.tone(130, 0.28, "sawtooth", 0.04, 720);
      this.tone(620, 0.22, "sine", 0.028, 180);
    }

    jump() {
      this.tone(240, 0.11, "square", 0.018, 390);
    }

    announce() {
      this.tone(210, 0.16, "square", 0.025, 420);
    }
  }

  class Particle {
    constructor({ x, y, color, kind = "spark", velocityX = 0, velocityY = 0, size = 5, life = 0.45 }) {
      this.x = x;
      this.y = y;
      this.color = color;
      this.kind = kind;
      this.velocityX = velocityX;
      this.velocityY = velocityY;
      this.size = size;
      this.life = life;
      this.maxLife = life;
    }

    update(deltaTime) {
      this.life -= deltaTime;
      this.x += this.velocityX * deltaTime;
      this.y += this.velocityY * deltaTime;
      if (this.kind === "spark") this.velocityY += 520 * deltaTime;
      this.velocityX *= Math.pow(0.08, deltaTime);
    }

    draw(context) {
      const progress = clamp(this.life / this.maxLife, 0, 1);
      context.save();
      context.globalAlpha = progress;
      context.strokeStyle = this.color;
      context.fillStyle = this.color;
      context.shadowColor = this.color;
      context.shadowBlur = 13;

      if (this.kind === "ring") {
        context.lineWidth = 3 * progress;
        context.beginPath();
        context.arc(this.x, this.y, this.size * (1 + (1 - progress) * 3.2), 0, Math.PI * 2);
        context.stroke();
      } else if (this.kind === "dust") {
        context.globalAlpha = progress * 0.35;
        context.beginPath();
        context.ellipse(this.x, this.y, this.size * (2 - progress), this.size * 0.35, 0, 0, Math.PI * 2);
        context.fill();
      } else {
        context.lineWidth = Math.max(1, this.size * progress * 0.45);
        context.beginPath();
        context.moveTo(this.x, this.y);
        context.lineTo(this.x - this.velocityX * 0.035, this.y - this.velocityY * 0.035);
        context.stroke();
      }
      context.restore();
    }
  }

  const ATTACKS = {
    basic: {
      duration: 0.34,
      activeStart: 0.1,
      activeEnd: 0.21,
      damage: 9,
      reach: 116,
      height: 82,
      yOffset: 29,
      knockbackX: 370,
      knockbackY: -125,
      hitStun: 0.22,
      cooldown: 0.24,
    },
    special: {
      duration: 0.62,
      activeStart: 0.17,
      activeEnd: 0.34,
      damage: 17,
      reach: 184,
      height: 120,
      yOffset: 12,
      knockbackX: 570,
      knockbackY: -245,
      hitStun: 0.38,
      cooldown: 0.58,
      energyCost: 40,
    },
  };

  class Fighter {
    constructor(game, config) {
      this.game = game;
      this.name = config.name;
      this.subtitle = config.subtitle;
      this.color = config.color;
      this.accent = config.accent;
      this.dark = config.dark;
      this.width = 76;
      this.height = 158;
      this.wins = 0;
      this.displayHealth = 100;
      this.animationTime = 0;
      this.reset(config.x, config.facing);
    }

    reset(x, facing) {
      this.x = x;
      this.y = FLOOR - this.height;
      this.velocityX = 0;
      this.velocityY = 0;
      this.facing = facing;
      this.health = 100;
      this.displayHealth = 100;
      this.energy = 0;
      this.attack = null;
      this.attackCooldown = 0;
      this.hitStun = 0;
      this.flash = 0;
      this.blocking = false;
      this.isGrounded = true;
      this.hasLanded = true;
    }

    get hurtbox() {
      return {
        x: this.x - this.width / 2,
        y: this.y,
        width: this.width,
        height: this.height,
      };
    }

    get attackDefinition() {
      return this.attack ? ATTACKS[this.attack.type] : null;
    }

    update(deltaTime, input, opponent) {
      this.animationTime += deltaTime;
      this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
      this.hitStun = Math.max(0, this.hitStun - deltaTime);
      this.flash = Math.max(0, this.flash - deltaTime);
      this.displayHealth = lerp(this.displayHealth, this.health, 1 - Math.pow(0.00002, deltaTime));

      const wasGrounded = this.isGrounded;
      if (!this.attack && this.hitStun <= 0 && Math.abs(opponent.x - this.x) > 4) {
        this.facing = opponent.x > this.x ? 1 : -1;
      }

      this.blocking = Boolean(input.block && this.isGrounded && !this.attack && this.hitStun <= 0);

      if (this.hitStun <= 0 && !this.attack) {
        const targetVelocity = this.blocking ? 0 : input.move * 355;
        this.velocityX = lerp(this.velocityX, targetVelocity, 1 - Math.pow(0.0008, deltaTime));

        if (input.jump && this.isGrounded && !this.blocking) {
          this.velocityY = -850;
          this.isGrounded = false;
          this.game.spawnDust(this.x, FLOOR, this.color, 7);
          this.game.synth.jump();
        }

        if (input.special && this.attackCooldown <= 0) {
          this.startAttack("special");
        } else if (input.attack && this.attackCooldown <= 0) {
          this.startAttack("basic");
        }
      } else if (this.attack) {
        this.velocityX *= Math.pow(0.015, deltaTime);
      } else {
        this.velocityX *= Math.pow(0.2, deltaTime);
      }

      if (this.attack) this.updateAttack(deltaTime, opponent);

      this.velocityY += GRAVITY * deltaTime;
      this.x += this.velocityX * deltaTime;
      this.y += this.velocityY * deltaTime;
      this.x = clamp(this.x, 58, WIDTH - 58);

      if (this.y + this.height >= FLOOR) {
        this.y = FLOOR - this.height;
        this.velocityY = 0;
        this.isGrounded = true;
      } else {
        this.isGrounded = false;
      }

      if (!wasGrounded && this.isGrounded) {
        this.game.spawnDust(this.x, FLOOR, this.color, 10);
      }
    }

    startAttack(type) {
      const definition = ATTACKS[type];
      if (type === "special") {
        if (this.energy < definition.energyCost) {
          this.game.spawnEmptyEnergy(this);
          this.attackCooldown = 0.16;
          return;
        }
        this.energy -= definition.energyCost;
        this.game.synth.special();
      }

      this.attack = { type, elapsed: 0, connected: false };
      this.attackCooldown = definition.cooldown;
    }

    updateAttack(deltaTime, opponent) {
      const definition = this.attackDefinition;
      this.attack.elapsed += deltaTime;

      if (this.attack.type === "special"
        && this.attack.elapsed > 0.08
        && this.attack.elapsed < definition.activeEnd) {
        this.x += this.facing * 315 * deltaTime;
      }

      const isActive = this.attack.elapsed >= definition.activeStart
        && this.attack.elapsed <= definition.activeEnd;

      if (isActive && !this.attack.connected && rectanglesOverlap(this.getAttackHitbox(), opponent.hurtbox)) {
        this.attack.connected = true;
        this.game.dealHit(this, opponent, definition, this.attack.type);
      }

      if (this.attack.elapsed >= definition.duration) this.attack = null;
    }

    getAttackHitbox() {
      const definition = this.attackDefinition;
      const leftEdge = this.x + (this.facing === 1 ? this.width * 0.22 : -definition.reach - this.width * 0.22);
      return {
        x: leftEdge,
        y: this.y + definition.yOffset,
        width: definition.reach,
        height: definition.height,
      };
    }

    receiveHit(attacker, definition) {
      const blocked = this.blocking;
      const damageMultiplier = blocked ? 0.34 : 1;
      const forceMultiplier = blocked ? 0.28 : 1;
      this.health = clamp(this.health - definition.damage * damageMultiplier, 0, 100);
      this.energy = clamp(this.energy + (blocked ? 7 : 5), 0, 100);
      this.velocityX = attacker.facing * definition.knockbackX * forceMultiplier;
      this.velocityY = definition.knockbackY * forceMultiplier;
      this.hitStun = blocked ? 0.1 : definition.hitStun;
      this.flash = blocked ? 0.06 : 0.1;
      if (!blocked) this.attack = null;
      return blocked;
    }

    draw(context) {
      const airborne = !this.isGrounded;
      const speedAmount = clamp(Math.abs(this.velocityX) / 355, 0, 1);
      const idleBob = this.isGrounded ? Math.sin(this.animationTime * 4.2) * 2.2 : 0;
      const walkPhase = this.animationTime * 11;
      const walkSwing = Math.sin(walkPhase) * 0.42 * speedAmount;
      let attackProgress = 0;
      if (this.attack) attackProgress = clamp(this.attack.elapsed / this.attackDefinition.duration, 0, 1);

      context.save();
      context.globalAlpha = 0.38;
      context.fillStyle = "#000";
      context.filter = "blur(6px)";
      context.beginPath();
      context.ellipse(this.x, FLOOR + 7, airborne ? 30 : 56, airborne ? 7 : 13, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();

      if (this.attack?.type === "special") {
        const pulse = 0.62 + Math.sin(this.animationTime * 28) * 0.2;
        context.save();
        context.globalAlpha = pulse;
        context.strokeStyle = this.accent;
        context.shadowColor = this.accent;
        context.shadowBlur = 22;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(this.x, this.y + 76, 61 + attackProgress * 28, -1.2, 1.9);
        context.stroke();
        context.restore();
      }

      context.save();
      context.translate(this.x, this.y + idleBob);
      context.scale(this.facing, 1);

      const legLift = airborne ? -0.65 : 0;
      this.drawLimb(context, -17, 104, 57, 0.12 + walkSwing + legLift, 18, this.dark);
      this.drawLimb(context, 17, 105, 57, -0.12 - walkSwing - legLift * 0.7, 18, this.color);

      context.save();
      context.fillStyle = this.flash > 0 ? "#ffffff" : this.dark;
      context.strokeStyle = this.color;
      context.lineWidth = 3;
      context.shadowColor = this.color;
      context.shadowBlur = 13;
      context.beginPath();
      context.moveTo(-31, 40);
      context.lineTo(-24, 18);
      context.lineTo(23, 16);
      context.lineTo(35, 47);
      context.lineTo(25, 111);
      context.lineTo(-25, 111);
      context.closePath();
      context.fill();
      context.stroke();

      context.globalAlpha = 0.44;
      context.strokeStyle = this.accent;
      context.beginPath();
      context.moveTo(-19, 48);
      context.lineTo(19, 72);
      context.moveTo(18, 38);
      context.lineTo(-15, 91);
      context.stroke();
      context.restore();

      let rearArmAngle = -0.3 - walkSwing * 0.8;
      let frontArmAngle = 0.35 + walkSwing * 0.8;
      if (this.blocking) {
        rearArmAngle = -1.55;
        frontArmAngle = -1.23;
      } else if (this.attack?.type === "basic") {
        frontArmAngle = -1.35 + Math.sin(attackProgress * Math.PI) * 1.45;
        rearArmAngle = -0.85;
      } else if (this.attack?.type === "special") {
        frontArmAngle = -1.55 + Math.sin(attackProgress * Math.PI) * 1.2;
        rearArmAngle = -1.15 + Math.sin(attackProgress * Math.PI) * 0.7;
      }

      this.drawLimb(context, -28, 42, 55, rearArmAngle, 16, this.dark);
      this.drawLimb(context, 29, 41, this.attack?.type === "basic" ? 68 : 58, frontArmAngle, 17, this.color);

      context.save();
      context.fillStyle = this.flash > 0 ? "#fff" : this.dark;
      context.strokeStyle = this.color;
      context.lineWidth = 3;
      context.shadowColor = this.color;
      context.shadowBlur = 12;
      roundedRect(context, -25, -4, 49, 49, 18);
      context.fill();
      context.stroke();
      context.fillStyle = this.accent;
      context.shadowColor = this.accent;
      context.shadowBlur = 16;
      roundedRect(context, -17, 16, 37, 6, 3);
      context.fill();
      context.restore();

      if (this.blocking) {
        context.save();
        context.globalAlpha = 0.48 + Math.sin(this.animationTime * 18) * 0.1;
        context.strokeStyle = this.accent;
        context.shadowColor = this.accent;
        context.shadowBlur = 20;
        context.lineWidth = 4;
        context.beginPath();
        context.arc(42, 65, 54, -1.22, 1.2);
        context.stroke();
        context.restore();
      }

      context.restore();
    }

    drawLimb(context, x, y, length, angle, width, color) {
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      context.lineCap = "round";
      context.strokeStyle = this.flash > 0 ? "#fff" : color;
      context.lineWidth = width;
      context.shadowColor = this.color;
      context.shadowBlur = 9;
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(0, length);
      context.stroke();
      context.fillStyle = this.accent;
      context.beginPath();
      context.arc(0, length, width * 0.53, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  class NeonBrawl {
    constructor() {
      this.synth = new Synth();
      this.state = "menu";
      this.previousState = "fighting";
      this.mode = "cpu";
      this.round = 1;
      this.timer = MATCH_TIME;
      this.roundDelay = 0;
      this.introTimer = 0;
      this.introFightShown = false;
      this.matchWinner = null;
      this.particles = [];
      this.shake = 0;
      this.hitStop = 0;
      this.screenFlash = 0;
      this.elapsed = 0;
      this.aiTimer = 0;
      this.aiIntent = this.emptyInput();
      this.lastTime = performance.now();

      this.fighterOne = new Fighter(this, {
        name: "KIRA",
        subtitle: "PLAYER 01",
        x: 335,
        facing: 1,
        color: "#35f2e5",
        accent: "#d8ff7c",
        dark: "#142d42",
      });
      this.fighterTwo = new Fighter(this, {
        name: "VEX",
        subtitle: "PLAYER 02",
        x: 945,
        facing: -1,
        color: "#ff3b9d",
        accent: "#ffc45c",
        dark: "#421638",
      });

      this.stars = Array.from({ length: 54 }, () => ({
        x: random(0, WIDTH),
        y: random(40, 330),
        size: random(0.5, 1.8),
        phase: random(0, Math.PI * 2),
      }));
      this.buildings = this.createBuildings();
      requestAnimationFrame((time) => this.loop(time));
    }

    emptyInput() {
      return { move: 0, jump: false, block: false, attack: false, special: false };
    }

    createBuildings() {
      const buildings = [];
      let x = -20;
      while (x < WIDTH + 50) {
        const width = random(52, 112);
        buildings.push({
          x,
          width,
          height: random(82, 235),
          seed: Math.floor(random(0, 99)),
        });
        x += width + random(7, 19);
      }
      return buildings;
    }

    start(mode) {
      this.synth.ensureContext();
      this.mode = mode;
      this.round = 1;
      this.fighterOne.wins = 0;
      this.fighterTwo.wins = 0;
      this.matchWinner = null;
      menuScreen.classList.add("is-hidden");
      pauseScreen.classList.add("is-hidden");
      resultScreen.classList.add("is-hidden");
      this.startRound();
      canvas.focus();
    }

    startRound() {
      this.fighterOne.reset(335, 1);
      this.fighterTwo.reset(945, -1);
      this.timer = MATCH_TIME;
      this.particles.length = 0;
      this.state = "intro";
      this.introTimer = 1.75;
      this.introFightShown = false;
      this.aiTimer = 0;
      this.aiIntent = this.emptyInput();
      this.showRoundMessage(`RONDA ${this.round}`, "READY");
      this.synth.announce();
    }

    returnToMenu() {
      this.state = "menu";
      this.matchWinner = null;
      this.particles.length = 0;
      pauseScreen.classList.add("is-hidden");
      resultScreen.classList.add("is-hidden");
      roundMessage.classList.add("is-hidden");
      menuScreen.classList.remove("is-hidden");
    }

    togglePause() {
      if (this.state === "paused") {
        this.state = this.previousState;
        pauseScreen.classList.add("is-hidden");
        canvas.focus();
      } else if (this.state === "fighting" || this.state === "intro") {
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

    finishRound() {
      if (this.state !== "fighting") return;

      const oneHealth = this.fighterOne.health;
      const twoHealth = this.fighterTwo.health;
      let winner = null;
      if (oneHealth > twoHealth) winner = this.fighterOne;
      if (twoHealth > oneHealth) winner = this.fighterTwo;

      if (winner) winner.wins += 1;
      this.matchWinner = winner?.wins >= 2 ? winner : null;
      this.state = "roundOver";
      this.roundDelay = 2.15;
      this.showRoundMessage(winner ? `${winner.name} DOMINA` : "SIN VENCEDOR", winner ? "K.O." : "DRAW");
      this.synth.tone(winner ? 78 : 120, 0.55, "sawtooth", 0.05, 42);
    }

    showResult() {
      this.state = "matchOver";
      const winner = this.matchWinner;
      resultKicker.innerHTML = "<span></span> COMBATE FINALIZADO";
      resultTitle.textContent = `${winner.name} GANA`;
      resultTitle.style.color = winner.color;
      resultCopy.textContent = winner === this.fighterOne
        ? "La arena tiene una nueva leyenda."
        : this.mode === "cpu"
          ? "Vex controló la arena. La revancha está lista."
          : "La rivalidad acaba de comenzar.";
      roundMessage.classList.add("is-hidden");
      resultScreen.classList.remove("is-hidden");
    }

    dealHit(attacker, target, definition, type) {
      const blocked = target.receiveHit(attacker, definition);
      attacker.energy = clamp(attacker.energy + (blocked ? 5 : type === "special" ? 18 : 12), 0, 100);
      const hitX = target.x - attacker.facing * 15;
      const hitY = target.y + 62;
      const color = blocked ? target.accent : attacker.color;
      const amount = type === "special" ? 25 : blocked ? 9 : 16;

      for (let index = 0; index < amount; index += 1) {
        const angle = random(-0.9, 0.9) + (attacker.facing === 1 ? 0 : Math.PI);
        const speed = random(160, type === "special" ? 690 : 470);
        this.particles.push(new Particle({
          x: hitX,
          y: hitY + random(-22, 22),
          color,
          velocityX: Math.cos(angle) * speed,
          velocityY: Math.sin(angle) * speed - random(20, 120),
          size: random(3, 8),
          life: random(0.24, 0.58),
        }));
      }

      this.particles.push(new Particle({
        x: hitX,
        y: hitY,
        color,
        kind: "ring",
        size: type === "special" ? 24 : 14,
        life: type === "special" ? 0.46 : 0.3,
      }));
      this.shake = type === "special" ? 17 : blocked ? 3 : 8;
      this.hitStop = type === "special" ? 0.075 : blocked ? 0.018 : 0.038;
      this.screenFlash = type === "special" ? 0.18 : 0.06;
      this.synth.hit(blocked);
    }

    spawnDust(x, y, color, count) {
      for (let index = 0; index < count; index += 1) {
        this.particles.push(new Particle({
          x: x + random(-22, 22),
          y: y + random(-3, 4),
          color,
          kind: "dust",
          velocityX: random(-60, 60),
          velocityY: random(-15, -3),
          size: random(9, 21),
          life: random(0.3, 0.6),
        }));
      }
    }

    spawnEmptyEnergy(fighter) {
      for (let index = 0; index < 4; index += 1) {
        this.particles.push(new Particle({
          x: fighter.x + random(-10, 10),
          y: fighter.y + 25,
          color: "#7c7c93",
          velocityX: random(-80, 80),
          velocityY: random(-160, -80),
          size: 3,
          life: 0.28,
        }));
      }
      this.synth.tone(90, 0.08, "square", 0.012, 70);
    }

    getKeyboardInput(player) {
      if (player === 1) {
        return {
          move: (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
          jump: pressed.has("KeyW"),
          block: keys.has("KeyS"),
          attack: pressed.has("KeyF"),
          special: pressed.has("KeyG"),
        };
      }
      return {
        move: (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0),
        jump: pressed.has("ArrowUp"),
        block: keys.has("ArrowDown"),
        attack: pressed.has("KeyK"),
        special: pressed.has("KeyL"),
      };
    }

    getCpuInput(deltaTime) {
      this.aiTimer -= deltaTime;
      const cpu = this.fighterTwo;
      const rival = this.fighterOne;
      const distance = Math.abs(rival.x - cpu.x);
      const direction = rival.x > cpu.x ? 1 : -1;

      if (this.aiTimer <= 0) {
        this.aiTimer = random(0.09, 0.18);
        this.aiIntent = this.emptyInput();

        const rivalThreatening = rival.attack
          && rival.attack.elapsed < rival.attackDefinition.activeEnd + 0.06
          && distance < 205;

        if (rivalThreatening && Math.random() < 0.64) {
          this.aiIntent.block = true;
        } else if (distance > 155) {
          this.aiIntent.move = direction;
          if (distance > 360 && Math.random() < 0.1) this.aiIntent.jump = true;
        } else {
          this.aiIntent.move = Math.random() < 0.18 ? -direction : 0;
          if (cpu.energy >= 40 && Math.random() < 0.23) {
            this.aiIntent.special = true;
          } else if (Math.random() < 0.56) {
            this.aiIntent.attack = true;
          } else if (Math.random() < 0.25) {
            this.aiIntent.block = true;
          }
        }
      }

      const result = { ...this.aiIntent };
      this.aiIntent.jump = false;
      this.aiIntent.attack = false;
      this.aiIntent.special = false;
      return result;
    }

    resolveFighterCollision() {
      const one = this.fighterOne;
      const two = this.fighterTwo;
      const verticalOverlap = one.y < two.y + two.height && one.y + one.height > two.y;
      const minimumDistance = (one.width + two.width) * 0.43;
      const distance = Math.abs(two.x - one.x);

      if (verticalOverlap && distance < minimumDistance && distance > 0.01) {
        const overlap = minimumDistance - distance;
        const direction = two.x > one.x ? 1 : -1;
        one.x -= direction * overlap * 0.5;
        two.x += direction * overlap * 0.5;
        one.x = clamp(one.x, 58, WIDTH - 58);
        two.x = clamp(two.x, 58, WIDTH - 58);
      }
    }

    update(deltaTime) {
      this.elapsed += deltaTime;
      this.screenFlash = Math.max(0, this.screenFlash - deltaTime * 2.7);
      this.shake *= Math.pow(0.009, deltaTime);

      if (this.state === "intro") {
        this.introTimer -= deltaTime;
        this.fighterOne.animationTime += deltaTime;
        this.fighterTwo.animationTime += deltaTime;
        if (this.introTimer < 0.72 && !this.introFightShown) {
          this.introFightShown = true;
          this.showRoundMessage(`RONDA ${this.round}`, "FIGHT");
          this.synth.announce();
        }
        if (this.introTimer <= 0) {
          this.state = "fighting";
          roundMessage.classList.add("is-hidden");
        }
      } else if (this.state === "fighting") {
        this.timer = Math.max(0, this.timer - deltaTime);
        this.fighterOne.update(deltaTime, this.getKeyboardInput(1), this.fighterTwo);
        const playerTwoInput = this.mode === "cpu"
          ? this.getCpuInput(deltaTime)
          : this.getKeyboardInput(2);
        this.fighterTwo.update(deltaTime, playerTwoInput, this.fighterOne);
        this.resolveFighterCollision();

        if (this.fighterOne.health <= 0 || this.fighterTwo.health <= 0 || this.timer <= 0) {
          this.finishRound();
        }
      } else if (this.state === "roundOver") {
        this.roundDelay -= deltaTime;
        this.fighterOne.animationTime += deltaTime;
        this.fighterTwo.animationTime += deltaTime;
        if (this.roundDelay <= 0) {
          if (this.matchWinner) {
            this.showResult();
          } else {
            this.round += 1;
            this.startRound();
          }
        }
      }

      for (const particle of this.particles) particle.update(deltaTime);
      this.particles = this.particles.filter((particle) => particle.life > 0);
    }

    loop(time) {
      const rawDelta = (time - this.lastTime) / 1000;
      const deltaTime = Math.min(rawDelta || 0, 1 / 30);
      this.lastTime = time;

      if (this.hitStop > 0) {
        this.hitStop -= deltaTime;
      } else if (this.state !== "paused" && this.state !== "menu" && this.state !== "matchOver") {
        this.update(deltaTime);
      } else if (this.state === "menu") {
        this.elapsed += deltaTime;
      }

      this.draw();
      pressed.clear();
      requestAnimationFrame((nextTime) => this.loop(nextTime));
    }

    draw() {
      ctx.save();
      if (this.shake > 0.1) ctx.translate(random(-this.shake, this.shake), random(-this.shake, this.shake));
      this.drawArena(ctx);

      if (this.state !== "menu") {
        this.fighterOne.draw(ctx);
        this.fighterTwo.draw(ctx);
        for (const particle of this.particles) particle.draw(ctx);
        this.drawHud(ctx);
      }
      ctx.restore();

      if (this.screenFlash > 0) {
        ctx.save();
        ctx.globalAlpha = this.screenFlash;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.restore();
      }
    }

    drawArena(context) {
      const sky = context.createLinearGradient(0, 0, 0, FLOOR);
      sky.addColorStop(0, "#070717");
      sky.addColorStop(0.55, "#151137");
      sky.addColorStop(1, "#30102e");
      context.fillStyle = sky;
      context.fillRect(-30, -30, WIDTH + 60, HEIGHT + 60);

      for (const star of this.stars) {
        const alpha = 0.22 + Math.sin(this.elapsed * 1.7 + star.phase) * 0.13;
        context.globalAlpha = alpha;
        context.fillStyle = "#d8e6ff";
        context.fillRect(star.x, star.y, star.size, star.size);
      }
      context.globalAlpha = 1;

      const moonGlow = context.createRadialGradient(1010, 150, 10, 1010, 150, 105);
      moonGlow.addColorStop(0, "rgba(255, 68, 164, 0.33)");
      moonGlow.addColorStop(0.2, "rgba(255, 68, 164, 0.14)");
      moonGlow.addColorStop(1, "rgba(255, 68, 164, 0)");
      context.fillStyle = moonGlow;
      context.beginPath();
      context.arc(1010, 150, 105, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(255, 83, 174, 0.5)";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(1010, 150, 58, 0, Math.PI * 2);
      context.stroke();

      const skylineY = 395;
      for (const building of this.buildings) {
        const top = skylineY - building.height;
        const buildingGradient = context.createLinearGradient(0, top, 0, skylineY);
        buildingGradient.addColorStop(0, "#171938");
        buildingGradient.addColorStop(1, "#080a1c");
        context.fillStyle = buildingGradient;
        context.fillRect(building.x, top, building.width, building.height);
        context.strokeStyle = "rgba(88, 94, 165, 0.22)";
        context.strokeRect(building.x, top, building.width, building.height);

        const columns = Math.floor(building.width / 17);
        const rows = Math.floor(building.height / 20);
        for (let column = 0; column < columns; column += 1) {
          for (let row = 0; row < rows; row += 1) {
            if ((column * 7 + row * 11 + building.seed) % 5 > 1) continue;
            context.fillStyle = (column + row + building.seed) % 2
              ? "rgba(53, 242, 229, 0.43)"
              : "rgba(255, 59, 157, 0.39)";
            context.fillRect(building.x + 9 + column * 17, top + 11 + row * 20, 5, 8);
          }
        }
      }

      const horizonGlow = context.createLinearGradient(0, 360, 0, 515);
      horizonGlow.addColorStop(0, "rgba(255, 59, 157, 0)");
      horizonGlow.addColorStop(0.5, "rgba(255, 59, 157, 0.12)");
      horizonGlow.addColorStop(1, "rgba(53, 242, 229, 0.02)");
      context.fillStyle = horizonGlow;
      context.fillRect(0, 340, WIDTH, 190);

      const floorGradient = context.createLinearGradient(0, FLOOR - 65, 0, HEIGHT);
      floorGradient.addColorStop(0, "#121329");
      floorGradient.addColorStop(1, "#070713");
      context.fillStyle = floorGradient;
      context.fillRect(0, FLOOR - 62, WIDTH, HEIGHT - FLOOR + 62);

      context.strokeStyle = "rgba(53, 242, 229, 0.13)";
      context.lineWidth = 1;
      const vanishingX = WIDTH / 2;
      const horizon = FLOOR - 62;
      for (let x = -400; x <= WIDTH + 400; x += 90) {
        context.beginPath();
        context.moveTo(vanishingX, horizon);
        context.lineTo(x, HEIGHT);
        context.stroke();
      }
      for (let index = 0; index < 8; index += 1) {
        const progress = index / 8;
        const y = horizon + Math.pow(progress, 2.1) * (HEIGHT - horizon);
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(WIDTH, y);
        context.stroke();
      }

      context.strokeStyle = "rgba(255, 59, 157, 0.6)";
      context.shadowColor = "#ff3b9d";
      context.shadowBlur = 16;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, FLOOR);
      context.lineTo(WIDTH, FLOOR);
      context.stroke();
      context.shadowBlur = 0;

      context.globalAlpha = 0.035;
      context.fillStyle = "#fff";
      for (let y = 0; y < HEIGHT; y += 5) context.fillRect(0, y, WIDTH, 1);
      context.globalAlpha = 1;
    }

    drawHud(context) {
      const margin = 55;
      const barWidth = 430;
      const barY = 50;
      const barHeight = 23;
      this.drawFighterHud(context, this.fighterOne, margin, barY, barWidth, barHeight, false);
      this.drawFighterHud(context, this.fighterTwo, WIDTH - margin - barWidth, barY, barWidth, barHeight, true);

      context.save();
      context.textAlign = "center";
      context.fillStyle = "#f4f5ff";
      context.font = "700 45px Orbitron, sans-serif";
      context.shadowColor = "rgba(255,255,255,0.28)";
      context.shadowBlur = 15;
      context.fillText(String(Math.ceil(this.timer)).padStart(2, "0"), WIDTH / 2, 76);
      context.shadowBlur = 0;
      context.fillStyle = "#777890";
      context.font = "600 10px Chakra Petch, sans-serif";
      context.letterSpacing = "3px";
      context.fillText(this.mode === "cpu" ? "SOLO PROTOCOL" : "LOCAL DUEL", WIDTH / 2, 98);
      context.restore();
    }

    drawFighterHud(context, fighter, x, y, width, height, reverse) {
      context.save();
      context.textAlign = reverse ? "right" : "left";
      context.fillStyle = "#f5f5ff";
      context.font = "700 20px Orbitron, sans-serif";
      context.fillText(fighter.name, reverse ? x + width : x, y - 12);
      context.fillStyle = fighter.color;
      context.font = "600 9px Chakra Petch, sans-serif";
      context.fillText(fighter.subtitle, reverse ? x + width : x, y + 43);

      context.fillStyle = "rgba(2, 2, 10, 0.72)";
      context.strokeStyle = "rgba(255, 255, 255, 0.18)";
      context.lineWidth = 2;
      context.fillRect(x, y, width, height);
      context.strokeRect(x, y, width, height);

      const healthWidth = width * (fighter.displayHealth / 100);
      const gradient = context.createLinearGradient(x, 0, x + width, 0);
      gradient.addColorStop(0, fighter.color);
      gradient.addColorStop(1, fighter.accent);
      context.fillStyle = gradient;
      context.shadowColor = fighter.color;
      context.shadowBlur = 13;
      context.fillRect(reverse ? x + width - healthWidth : x, y, healthWidth, height);
      context.shadowBlur = 0;

      const energyY = y + height + 6;
      const energyWidth = width * (fighter.energy / 100);
      context.fillStyle = "rgba(255, 255, 255, 0.08)";
      context.fillRect(x, energyY, width, 5);
      context.fillStyle = fighter.accent;
      context.fillRect(reverse ? x + width - energyWidth : x, energyY, energyWidth, 5);

      for (let index = 0; index < 2; index += 1) {
        const dotX = reverse ? x + width - index * 21 : x + index * 21;
        context.beginPath();
        context.arc(dotX, y + 60, 5.5, 0, Math.PI * 2);
        context.fillStyle = index < fighter.wins ? fighter.color : "rgba(255,255,255,0.12)";
        context.shadowColor = fighter.color;
        context.shadowBlur = index < fighter.wins ? 10 : 0;
        context.fill();
      }
      context.restore();
    }
  }

  const keys = new Set();
  const pressed = new Set();
  const game = new NeonBrawl();

  window.addEventListener("keydown", (event) => {
    const blockedKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];
    if (blockedKeys.includes(event.code) && game.state !== "menu") event.preventDefault();
    if (!keys.has(event.code)) pressed.add(event.code);
    keys.add(event.code);

    if (event.code === "Escape" && !event.repeat) game.togglePause();
    if (event.code === "Enter" && game.state === "menu" && !event.repeat) game.start("cpu");
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });

  window.addEventListener("blur", () => {
    keys.clear();
    pressed.clear();
    if (game.state === "fighting") game.togglePause();
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
      if (!document.fullscreenElement) {
        await shell.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Some browsers disable fullscreen when the page is inside a preview frame.
    }
  });
})();

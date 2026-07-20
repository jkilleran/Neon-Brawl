"use strict";

const COMBAT_CONFIG = require("./combat-config.js");

const RULES = COMBAT_CONFIG.gameplayRules;
const ATTACKS = COMBAT_CONFIG.attacks;
const { left: STAGE_LEFT, right: STAGE_RIGHT, floor: FLOOR } = COMBAT_CONFIG.stage;
const FIXED_DELTA = 1 / COMBAT_CONFIG.simulationHz;
const GUARD_TRANSITION_RATE = COMBAT_CONFIG.guardTransitionRate;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (from, to, amount) => from + (to - from) * amount;
const emptyInput = () => ({
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
});
const emptyRoundStats = () => ({
  thrown: 0,
  landed: 0,
  missed: 0,
  blocked: 0,
  critical: 0,
  headLanded: 0,
  bodyLanded: 0,
});

function attackTypeFromInput(input) {
  if (input.rightKick) return input.bodyModifier ? "rightKickBody" : "rightKickHead";
  if (input.leftKick) return input.bodyModifier ? "leftKickBody" : "leftKickHead";
  if (input.rightPunch) return input.bodyModifier ? "rightPunchBody" : "rightPunchHead";
  if (input.leftPunch) return input.bodyModifier ? "leftPunchBody" : "leftPunchHead";
  return null;
}

function createInputSlot() {
  return {
    latest: emptyInput(),
    queuedAction: null,
    receivedSequence: 0,
    processedSequence: 0,
  };
}

class ServerFighter {
  constructor(simulation, { player, name, x, facing }) {
    this.simulation = simulation;
    this.player = player;
    this.name = name;
    this.roundWins = 0;
    this.matchScore = 0;
    this.animationTime = 0;
    this.longTermStamina = 100;
    this.resetRound(x, facing);
  }

  get maxStamina() {
    return Math.min(this.longTermStamina, 55 + this.bodyHealth * 0.45);
  }

  get currentAttack() {
    return this.attack ? ATTACKS[this.attack.type] : null;
  }

  get attackFacing() {
    return this.attack?.facing ?? this.facing;
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
    this.takedowns = 0;
    this.knockdownsScored = 0;
    this.knockdownsSuffered = 0;
    this.moveFlash = 0;
    this.impactMarker = null;
    this.hitReaction = null;
    this.blockReaction = null;
    this.roundStats = emptyRoundStats();
    this.practiceResetTimer = 0;
  }

  recoverBetweenRounds() {
    this.longTermStamina = clamp(
      this.longTermStamina + RULES.cornerLongTermRecovery,
      RULES.minLongTermStamina,
      100,
    );
  }

  spendStrikeStamina(baseCost, multiplier = RULES.strikeStaminaScale) {
    const cost = baseCost * multiplier;
    this.stamina = Math.max(0, this.stamina - cost);
    const reserveRatio = this.stamina / Math.max(1, this.maxStamina);
    const fatiguePressure = reserveRatio < 0.35 ? (0.35 - reserveRatio) / 0.35 : 0;
    let longTermLoss = cost * 0.035;
    if (fatiguePressure > 0) longTermLoss += cost * (0.08 + fatiguePressure * 0.14);
    if (this.stamina <= 0.5) longTermLoss += 2.5;
    this.longTermStamina = clamp(
      this.longTermStamina - longTermLoss,
      RULES.minLongTermStamina,
      100,
    );
    this.stamina = Math.min(this.stamina, this.maxStamina);
  }

  applyInefficientStrikePenalty(definition) {
    if (this.attack?.inefficientPenaltyApplied) return;
    const multiplier = Math.max(0, RULES.inefficientStrikeStaminaScale - RULES.strikeStaminaScale);
    if (this.attack) this.attack.inefficientPenaltyApplied = true;
    this.spendStrikeStamina(definition.stamina, multiplier);
  }

  startEvade(opponent) {
    const away = opponent.x > this.x ? -1 : 1;
    this.stamina -= 10;
    this.evadeTimer = 0.26;
    this.invulnerable = 0.19;
    this.evadeCooldown = 0.55;
    this.velocityX = away * 480;
    this.simulation.setCallout("EVADE", this.player, 0.35);
  }

  startAttack(type) {
    const definition = ATTACKS[type];
    if (!definition || this.attack || this.stun > 0 || this.evadeTimer > 0) return false;
    const staminaCost = definition.stamina * RULES.strikeStaminaScale;
    if (this.stamina < staminaCost) {
      this.simulation.setCallout("LOW STAMINA", 0, 0.45);
      return false;
    }
    this.spendStrikeStamina(definition.stamina);
    this.attack = {
      type,
      elapsed: 0,
      connected: false,
      inefficientPenaltyApplied: false,
      facing: this.facing,
      stationaryStart: Math.abs(this.velocityX) <= RULES.criticalAttackerMaxSpeed,
    };
    this.roundStats.thrown += 1;
    this.guard = null;
    this.moveFlash = 0.3;
    return true;
  }

  updateVisualState(deltaTime) {
    this.animationTime += deltaTime;
    this.moveFlash = Math.max(0, this.moveFlash - deltaTime);
    for (const effectName of ["hitReaction", "blockReaction"]) {
      const effect = this[effectName];
      if (!effect) continue;
      effect.elapsed += deltaTime;
      if (effect.elapsed >= effect.duration) this[effectName] = null;
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
    this.stun = Math.max(0, this.stun - deltaTime);
    this.evadeTimer = Math.max(0, this.evadeTimer - deltaTime);
    this.evadeCooldown = Math.max(0, this.evadeCooldown - deltaTime);
    this.invulnerable = Math.max(0, this.invulnerable - deltaTime);
    this.displayHead = lerp(this.displayHead, this.headHealth, 1 - Math.pow(0.00003, deltaTime));
    this.displayBody = lerp(this.displayBody, this.bodyHealth, 1 - Math.pow(0.00003, deltaTime));
    this.displayStamina = lerp(this.displayStamina, this.stamina, 1 - Math.pow(0.00008, deltaTime));
    this.displayStaminaCap = lerp(this.displayStaminaCap, this.maxStamina, 1 - Math.pow(0.00008, deltaTime));

    if (this.knockdownTimer > 0) {
      this.knockdownTimer = Math.max(0, this.knockdownTimer - deltaTime);
      this.velocityX *= Math.pow(0.02, deltaTime);
      this.x = clamp(this.x + this.velocityX * deltaTime, STAGE_LEFT, STAGE_RIGHT);
      if (this.knockdownTimer <= 0) {
        this.headHealth = Math.max(this.headHealth, 10);
        this.bodyHealth = Math.max(this.bodyHealth, 8);
        this.stun = 0.4;
        this.knockdownDuration = 0;
        this.simulation.setCallout("BACK ON THE FEET", 0, 0.8);
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
      } else if (opponent.knockdownTimer <= 0) {
        const type = attackTypeFromInput(input);
        if (type) this.startAttack(type);
      }
    } else if (this.attack) {
      this.velocityX *= Math.pow(0.008, deltaTime);
      this.updateAttack(deltaTime, opponent);
    } else if (this.evadeTimer > 0) {
      this.velocityX *= Math.pow(0.3, deltaTime);
    } else {
      this.velocityX *= Math.pow(0.05, deltaTime);
    }

    this.x = clamp(this.x + this.velocityX * deltaTime, STAGE_LEFT, STAGE_RIGHT);
    const regenRate = this.attack ? 1.5 : this.guard ? 4 : this.evadeTimer > 0 ? 0.75 : 14;
    const enduranceRecovery = 0.62 + (this.maxStamina / 100) * 0.38;
    this.stamina = clamp(this.stamina + regenRate * enduranceRecovery * deltaTime, 0, this.maxStamina);
  }

  updateAttack(deltaTime, opponent) {
    const definition = this.currentAttack;
    if (!definition || !this.attack) return;
    this.attack.elapsed += deltaTime;
    const activeEnd = definition.startup + definition.active;
    if (this.attack.elapsed >= definition.startup
      && this.attack.elapsed <= activeEnd
      && !this.attack.connected
      && this.simulation.canStrikeConnect(this, opponent)) {
      this.attack.connected = true;
      this.simulation.queueContact(this, opponent, definition, { ...this.attack });
    }
    const totalDuration = activeEnd + definition.recovery;
    if (this.attack && this.attack.elapsed >= totalDuration) {
      if (!this.attack.connected) {
        this.applyInefficientStrikePenalty(definition);
        this.roundStats.missed += 1;
      }
      this.attack = null;
    }
  }

  serialize() {
    return {
      x: this.x,
      facing: this.facing,
      velocityX: this.velocityX,
      headHealth: this.headHealth,
      bodyHealth: this.bodyHealth,
      displayHead: this.displayHead,
      displayBody: this.displayBody,
      stamina: this.stamina,
      longTermStamina: this.longTermStamina,
      displayStamina: this.displayStamina,
      displayStaminaCap: this.displayStaminaCap,
      attack: this.attack ? { ...this.attack } : null,
      guard: this.guard,
      guardBlend: this.guardBlend,
      guardVisual: this.guardVisual,
      stun: this.stun,
      evadeTimer: this.evadeTimer,
      evadeCooldown: this.evadeCooldown,
      invulnerable: this.invulnerable,
      knockdownTimer: this.knockdownTimer,
      knockdownDuration: this.knockdownDuration,
      knockdownTarget: this.knockdownTarget,
      knockdownAnimation: this.knockdownAnimation,
      finishAnimation: this.finishAnimation ? { ...this.finishAnimation } : null,
      roundDamage: this.roundDamage,
      takedowns: this.takedowns,
      knockdownsScored: this.knockdownsScored,
      knockdownsSuffered: this.knockdownsSuffered,
      moveFlash: this.moveFlash,
      impactMarker: this.impactMarker ? { ...this.impactMarker } : null,
      hitReaction: this.hitReaction ? { ...this.hitReaction } : null,
      blockReaction: this.blockReaction ? { ...this.blockReaction } : null,
      animationTime: this.animationTime,
      roundWins: this.roundWins,
      matchScore: this.matchScore,
      roundStats: { ...this.roundStats },
      practiceResetTimer: 0,
    };
  }
}

class OnlineMatchSimulation {
  constructor({ random = Math.random } = {}) {
    this.random = random;
    this.inputs = {
      player1: createInputSlot(),
      player2: createInputSlot(),
    };
    this.fighterOne = new ServerFighter(this, {
      player: 1, name: "ROOK", x: 380, facing: 1,
    });
    this.fighterTwo = new ServerFighter(this, {
      player: 2, name: "VEX", x: 900, facing: -1,
    });
    this.round = 1;
    this.roundHistory = [];
    this.recordedRounds = new Set();
    this.matchWinner = null;
    this.matchMethod = "";
    this.callout = null;
    this.flash = 0;
    this.shake = 0;
    this.hitStop = 0;
    this.eventSequence = 0;
    this.events = [];
    this.pendingContacts = [];
    this.serverFrame = 0;
    this.active = false;
    this.startRound();
  }

  activate() {
    this.active = true;
  }

  receiveInput(role, input, sequence) {
    const slot = this.inputs[role];
    if (!slot || !Number.isSafeInteger(sequence) || sequence <= slot.receivedSequence) return false;
    slot.receivedSequence = sequence;
    slot.latest = {
      ...slot.latest,
      ...input,
      leftPunch: false,
      rightPunch: false,
      leftKick: false,
      rightKick: false,
    };
    const type = attackTypeFromInput(input);
    if (type && !slot.queuedAction) {
      slot.queuedAction = { type, sequence };
    }
    return true;
  }

  consumeInput(role) {
    const slot = this.inputs[role];
    const input = { ...slot.latest };
    if (slot.queuedAction) {
      const { type } = slot.queuedAction;
      input.leftPunch = type === "leftPunchHead" || type === "leftPunchBody";
      input.rightPunch = type === "rightPunchHead" || type === "rightPunchBody";
      input.leftKick = type === "leftKickHead" || type === "leftKickBody";
      input.rightKick = type === "rightKickHead" || type === "rightKickBody";
      input.bodyModifier = type.endsWith("Body");
      slot.queuedAction = null;
    }
    slot.processedSequence = slot.receivedSequence;
    return input;
  }

  startRound() {
    if (this.round > 1) {
      this.fighterOne.recoverBetweenRounds();
      this.fighterTwo.recoverBetweenRounds();
    }
    this.fighterOne.resetRound(380, 1);
    this.fighterTwo.resetRound(900, -1);
    this.timer = RULES.roundTimeSeconds;
    this.state = "intro";
    this.introTimer = 1.8;
    this.roundDelay = 0;
    this.matchWinner = null;
    this.callout = null;
    this.events = [];
  }

  setCallout(text, player = 0, life = 0.5) {
    const color = player === 1 ? "#35f2e5" : player === 2 ? "#ff3b9d" : "#ffffff";
    this.callout = { text, color, life, maxLife: life };
  }

  emitEvent(type, payload = {}) {
    this.eventSequence += 1;
    this.events.push({ id: this.eventSequence, type, age: 0, ...payload });
    if (this.events.length > 24) this.events.shift();
  }

  canStrikeConnect(attacker, target) {
    const forwardDistance = (target.x - attacker.x) * attacker.attackFacing;
    return forwardDistance > 0
      && Math.abs(target.x - attacker.x) <= RULES.guaranteedStrikeDistance;
  }

  queueContact(attacker, target, definition, attack) {
    this.pendingContacts.push({ attacker, target, definition, attack });
  }

  resolveQueuedContacts() {
    const contacts = this.pendingContacts;
    this.pendingContacts = [];
    const contexts = contacts.map(({ attacker, target, definition }) => ({
      attackerStamina: attacker.stamina,
      attackerMaxStamina: attacker.maxStamina,
      targetAttack: target.attack,
      targetVelocityX: target.velocityX,
      targetedHealth: definition.target === "head" ? target.headHealth : target.bodyHealth,
      matchingGuard: definition.target === "head" ? target.guard === "high" : target.guard === "low",
      targetInvulnerable: target.invulnerable,
    }));
    for (const [index, contact] of contacts.entries()) {
      if (!contact.attacker.attack) contact.attacker.attack = contact.attack;
      this.resolveAttack(contact.attacker, contact.target, contact.definition, contexts[index]);
    }
    for (const fighter of [this.fighterOne, this.fighterTwo]) {
      if (fighter.hitReaction) fighter.attack = null;
    }
  }

  resolveAttack(attacker, target, definition, context = null) {
    if ((context?.targetInvulnerable ?? target.invulnerable) > 0) {
      attacker.applyInefficientStrikePenalty(definition);
      attacker.roundStats.missed += 1;
      this.setCallout("CLEAN EVADE", target.player, 0.55);
      return;
    }

    const distance = Math.abs(attacker.x - target.x);
    const matchingGuard = context?.matchingGuard
      ?? (definition.target === "head" ? target.guard === "high" : target.guard === "low");
    const rangeQuality = clamp(
      1 - Math.abs(distance - definition.idealRange) / definition.idealRange * 0.34,
      0.66,
      1,
    );
    const attackerStamina = context?.attackerStamina ?? attacker.stamina;
    const attackerMaxStamina = context?.attackerMaxStamina ?? attacker.maxStamina;
    const shortTermRatio = attackerStamina / Math.max(1, attackerMaxStamina);
    const longTermRatio = attackerMaxStamina / 100;
    const staminaQuality = 0.62 + shortTermRatio * 0.28 + longTermRatio * 0.1;
    const counterBonus = (context ? context.targetAttack : target.attack) ? 1.14 : 1;
    const movementCritical = !matchingGuard
      && attacker.attack?.stationaryStart
      && Math.abs(context?.targetVelocityX ?? target.velocityX) >= RULES.criticalTargetMinSpeed;
    const targetedHealth = context?.targetedHealth
      ?? (definition.target === "head" ? target.headHealth : target.bodyHealth);
    const vulnerableThreshold = RULES.vulnerableCriticalHealthThresholdByRound[this.round - 1];
    const vulnerableCritical = !matchingGuard
      && !movementCritical
      && targetedHealth < vulnerableThreshold
      && this.random() < RULES.vulnerableCriticalChance;
    const critical = movementCritical || vulnerableCritical;
    const criticalKnockdown = critical && this.random() < RULES.criticalKnockdownChance;
    const criticalMultiplier = critical ? RULES.criticalDamageMultiplier : 1;
    const guardMultiplier = matchingGuard ? 0.26 : 1;
    const bodyMultiplier = definition.target === "body" ? RULES.bodyDamageScale : 1;
    const strikeDamageScale = critical ? RULES.criticalStrikeDamageScale : RULES.strikeDamageScale;
    const damage = definition.damage
      * strikeDamageScale
      * bodyMultiplier
      * rangeQuality
      * staminaQuality
      * counterBonus
      * criticalMultiplier
      * guardMultiplier;

    if (matchingGuard) attacker.roundStats.blocked += 1;
    else {
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
    target.stun = matchingGuard ? 0.08 : critical ? RULES.criticalStunSeconds : definition.stun;
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
        target.roundStats.missed += 1;
      }
      target.attack = null;
      target.guard = null;
      target.guardBlend = 0;
      target.hitReaction = {
        target: definition.target,
        severity: critical ? "critical" : "clean",
        direction: attacker.attackFacing,
        elapsed: 0,
        duration: critical ? 0.62 : definition.heavy ? 0.42 : definition.target === "body" ? 0.36 : 0.32,
      };
    }

    const impactY = definition.target === "head" ? FLOOR - 255 : FLOOR - 170;
    const impactX = target.x - attacker.attackFacing * (definition.target === "head" ? 28 : 42);
    const impactLife = critical ? 0.42 : definition.heavy ? 0.28 : 0.2;
    target.impactMarker = {
      x: impactX,
      y: impactY,
      color: matchingGuard ? (target.player === 1 ? "#35f2e5" : "#ff3b9d") : "#ffffff",
      life: impactLife,
      maxLife: impactLife,
    };
    this.shake = matchingGuard ? 2.5 : critical ? 18 : definition.heavy ? 12 : 7;
    this.hitStop = matchingGuard ? 0.022 : critical ? 0.105 : definition.heavy ? 0.065 : 0.035;
    this.flash = matchingGuard ? 0.018 : critical ? 0.22 : definition.heavy ? 0.13 : 0.05;
    this.emitEvent("impact", {
      x: impactX,
      y: impactY,
      color: attacker.player === 1 ? "#35f2e5" : "#ff3b9d",
      blocked: matchingGuard,
      heavy: Boolean(definition.heavy),
      critical,
    });

    if (matchingGuard) this.setCallout("BLOCKED", target.player, 0.4);
    else if (critical) this.setCallout("CRITICAL HIT", 0, 0.72);
    else if (counterBonus > 1) this.setCallout("COUNTER", attacker.player, 0.55);
    else this.setCallout("CLEAN HIT", attacker.player, 0.42);

    if (target.headHealth <= 0) this.finishFight(attacker, "K.O.", target, "head");
    else if (target.bodyHealth <= 0) this.finishFight(attacker, "BODY K.O.", target, "body");
    else if (criticalKnockdown) this.knockDown(attacker, target, definition.target);
  }

  knockDown(attacker, target, targetZone) {
    target.knockdownsSuffered += 1;
    attacker.knockdownsScored += 1;
    attacker.matchScore += 18;
    target.knockdownDuration = 2;
    target.knockdownTimer = 2;
    target.knockdownTarget = targetZone;
    const variants = COMBAT_CONFIG.knockdownVariants[targetZone];
    target.knockdownAnimation = variants[Math.floor(this.random() * variants.length)];
    target.velocityX = attacker.attackFacing * 150;
    target.attack = null;
    target.hitReaction = null;
    target.blockReaction = null;
    this.setCallout(targetZone === "body" ? "BODY KNOCKDOWN" : "HEAD KNOCKDOWN", attacker.player, 1);
    this.emitEvent("knockdown", { target: targetZone, player: target.player });
  }

  resolveSpacing() {
    const distance = Math.abs(this.fighterTwo.x - this.fighterOne.x);
    if (distance >= RULES.minimumFighterDistance || distance <= 0.01) return;
    const direction = this.fighterTwo.x > this.fighterOne.x ? 1 : -1;
    const correction = (RULES.minimumFighterDistance - distance) / 2;
    this.fighterOne.x = clamp(this.fighterOne.x - direction * correction, STAGE_LEFT, STAGE_RIGHT);
    this.fighterTwo.x = clamp(this.fighterTwo.x + direction * correction, STAGE_LEFT, STAGE_RIGHT);
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

  recordRound({ winner, method = "DECISION", scoreOne, scoreTwo }) {
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

  finishFight(winner, method, loser, target) {
    if (["roundOver", "matchOver"].includes(this.state)) return;
    this.matchWinner = winner;
    this.matchMethod = method;
    this.recordRound({ winner, method });
    this.state = "roundOver";
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
    const animations = COMBAT_CONFIG.knockoutVariants[target];
    loser.finishAnimation = {
      target,
      animation: animations[Math.floor(this.random() * animations.length)],
      elapsed: 0,
      duration: 1.65,
    };
    this.setCallout(`${winner.name} // ${method}`, winner.player, 1.15);
    this.emitEvent("finish", { winner: winner.player, method, target });
  }

  finishRoundDecision() {
    if (this.state !== "fighting") return;
    const scoreOne = this.fighterOne.roundDamage + this.fighterOne.knockdownsScored * 18;
    const scoreTwo = this.fighterTwo.roundDamage + this.fighterTwo.knockdownsScored * 18;
    let winner;
    if (Math.abs(scoreOne - scoreTwo) < 0.5) {
      winner = this.fighterOne.headHealth + this.fighterOne.bodyHealth
        >= this.fighterTwo.headHealth + this.fighterTwo.bodyHealth
        ? this.fighterOne
        : this.fighterTwo;
    } else winner = scoreOne > scoreTwo ? this.fighterOne : this.fighterTwo;
    winner.roundWins += 1;
    this.recordRound({
      winner,
      method: "DECISION",
      scoreOne: winner === this.fighterOne ? 10 : 9,
      scoreTwo: winner === this.fighterTwo ? 10 : 9,
    });
    this.state = "roundOver";
    this.roundDelay = 2.35;
    this.setCallout(`${winner.name} TAKES ROUND ${this.round}`, winner.player, 1.2);
    if (this.round >= COMBAT_CONFIG.maxRounds) {
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

  update(deltaTime = FIXED_DELTA) {
    if (!this.active || this.state === "matchOver") return;
    this.serverFrame += 1;
    this.flash = Math.max(0, this.flash - deltaTime * 2.8);
    this.shake *= Math.pow(0.02, deltaTime);
    if (this.callout) {
      this.callout.life -= deltaTime;
      if (this.callout.life <= 0) this.callout = null;
    }
    for (const event of this.events) event.age += deltaTime;
    this.events = this.events.filter((event) => event.age <= 0.8);
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - deltaTime);
      return;
    }

    if (this.state === "intro") {
      this.introTimer -= deltaTime;
      this.fighterOne.updateVisualState(deltaTime);
      this.fighterTwo.updateVisualState(deltaTime);
      if (this.introTimer <= 0) this.state = "fighting";
      return;
    }

    if (this.state === "fighting") {
      this.timer = Math.max(0, this.timer - deltaTime);
      const inputOne = this.consumeInput("player1");
      const inputTwo = this.consumeInput("player2");
      this.pendingContacts = [];
      this.fighterOne.update(deltaTime, inputOne, this.fighterTwo);
      if (this.state === "fighting") this.fighterTwo.update(deltaTime, inputTwo, this.fighterOne);
      if (this.state === "fighting" && this.pendingContacts.length) this.resolveQueuedContacts();
      if (this.state === "fighting") this.resolveSpacing();
      if (this.timer <= 0 && this.state === "fighting") this.finishRoundDecision();
      return;
    }

    if (this.state === "roundOver") {
      this.roundDelay -= deltaTime;
      this.fighterOne.updateVisualState(deltaTime);
      this.fighterTwo.updateVisualState(deltaTime);
      if (this.roundDelay <= 0) {
        if (this.matchWinner) this.state = "matchOver";
        else {
          this.round += 1;
          this.startRound();
        }
      }
    }
  }

  roundOverlay() {
    if (this.state === "intro") {
      return {
        hidden: false,
        kicker: `ROUND ${this.round} OF ${COMBAT_CONFIG.maxRounds}`,
        title: this.introTimer < 0.72 ? "FIGHT" : "READY",
      };
    }
    if (this.state === "roundOver") {
      return {
        hidden: false,
        kicker: this.matchWinner ? `${this.matchWinner.name} // ${this.matchMethod}` : `ROUND ${this.round}`,
        title: this.matchWinner ? this.matchMethod : "10 - 9",
      };
    }
    return { hidden: true, kicker: "", title: "" };
  }

  snapshot() {
    return {
      authority: "server",
      serverFrame: this.serverFrame,
      state: this.state,
      round: this.round,
      timer: this.timer,
      introTimer: this.introTimer,
      roundDelay: this.roundDelay,
      matchMethod: this.matchMethod,
      matchWinner: this.matchWinner === this.fighterOne ? 1 : this.matchWinner === this.fighterTwo ? 2 : null,
      roundHistory: this.roundHistory,
      callout: this.callout,
      flash: this.flash,
      shake: this.shake,
      inputAcknowledgements: {
        player1: this.inputs.player1.processedSequence,
        player2: this.inputs.player2.processedSequence,
      },
      fighterOne: this.fighterOne.serialize(),
      fighterTwo: this.fighterTwo.serialize(),
      particles: null,
      damageNumbers: null,
      events: this.events.map((event) => ({ ...event })),
      roundOverlay: this.roundOverlay(),
    };
  }
}

module.exports = {
  OnlineMatchSimulation,
  FIXED_DELTA,
  emptyInput,
  attackTypeFromInput,
};

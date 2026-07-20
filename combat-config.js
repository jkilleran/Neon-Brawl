(() => {
  "use strict";

  const gameplayRules = Object.freeze({
    roundTimeSeconds: 3 * 60,
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
    vulnerableCriticalHealthThresholdByRound: Object.freeze([45, 65, 75]),
    vulnerableCriticalChance: 1 / 3.5,
    criticalDamageMultiplier: 1.75,
    criticalStunSeconds: 1,
    minLongTermStamina: 35,
    cornerLongTermRecovery: 4,
  });

  const attacks = Object.freeze({
    leftPunchHead: Object.freeze({
      target: "head", startup: 0.09, active: 0.07, recovery: 0.18,
      damage: 6, stamina: 5, reach: 122, idealRange: 91, stun: 0.11, knockback: 38,
    }),
    rightPunchHead: Object.freeze({
      target: "head", startup: 0.14, active: 0.08, recovery: 0.25,
      damage: 11, stamina: 10, reach: 140, idealRange: 108, stun: 0.2, knockback: 68,
    }),
    leftPunchBody: Object.freeze({
      target: "body", startup: 0.11, active: 0.08, recovery: 0.2,
      damage: 8, stamina: 7, reach: 116, idealRange: 84, stun: 0.14, knockback: 44,
    }),
    rightPunchBody: Object.freeze({
      target: "body", startup: 0.16, active: 0.08, recovery: 0.26,
      damage: 12, stamina: 11, reach: 132, idealRange: 101, stun: 0.22, knockback: 70,
    }),
    leftKickHead: Object.freeze({
      target: "head", startup: 0.24, active: 0.1, recovery: 0.39,
      damage: 17, stamina: 20, reach: 180, idealRange: 148, stun: 0.3, knockback: 108,
      heavy: true,
    }),
    rightKickHead: Object.freeze({
      target: "head", startup: 0.29, active: 0.11, recovery: 0.46,
      damage: 21, stamina: 26, reach: 188, idealRange: 156, stun: 0.37, knockback: 132,
      heavy: true,
    }),
    leftKickBody: Object.freeze({
      target: "body", startup: 0.21, active: 0.1, recovery: 0.34,
      damage: 14, stamina: 16, reach: 170, idealRange: 139, stun: 0.24, knockback: 84,
    }),
    rightKickBody: Object.freeze({
      target: "body", startup: 0.25, active: 0.1, recovery: 0.4,
      damage: 17, stamina: 20, reach: 178, idealRange: 146, stun: 0.29, knockback: 101,
      heavy: true,
    }),
  });

  const config = Object.freeze({
    gameplayRules,
    attacks,
    maxRounds: 3,
    simulationHz: 60,
    snapshotHz: 30,
    guardTransitionRate: 6,
    stage: Object.freeze({ left: 105, right: 1175, width: 1280, floor: 604 }),
    knockdownVariants: Object.freeze({
      head: Object.freeze([
        "headKnockdown", "headKnockdownForward", "headKnockdownSeated",
        "headKnockdownShoulderRoll", "headKnockdownKneeDrop",
      ]),
      body: Object.freeze([
        "bodyKnockdown", "bodyKnockdownKneel", "bodyKnockdownSeated",
        "bodyKnockdownElbowFold", "bodyKnockdownThreePoint",
      ]),
    }),
    knockoutVariants: Object.freeze({
      head: Object.freeze([
        "headKnockout", "headKnockoutProne", "headKnockoutSide", "headKnockoutKneeCollapse",
      ]),
      body: Object.freeze([
        "bodyKnockout", "bodyKnockoutProne", "bodyKnockoutSupine", "bodyKnockoutSeatedSlump",
      ]),
    }),
  });

  globalThis.NEON_BRAWL_COMBAT_CONFIG = config;
  globalThis.NEON_BRAWL_GAMEPLAY_RULES = gameplayRules;
  if (typeof module !== "undefined" && module.exports) module.exports = config;
})();

(() => {
  "use strict";

  const TEN_FRAME_PHASES = Object.freeze([
    "guard",
    "anticipation",
    "load",
    "extension-1",
    "extension-2",
    "contact",
    "recoil-1",
    "recoil-2",
    "recovery",
    "guard-return",
  ]);

  const EARLY_CONTACT_PHASES = Object.freeze([
    "guard",
    "anticipation",
    "load",
    "contact",
    "follow-through-1",
    "follow-through-2",
    "recoil-1",
    "recoil-2",
    "recovery",
    "guard-return",
  ]);

  const strike = ({
    id,
    label,
    file,
    limb,
    target,
    p1,
    p2,
    contactFrame = 6,
    provenance = "generated-v3",
  }) => Object.freeze({
    id,
    label,
    sheet: id,
    file,
    limb,
    target,
    input: Object.freeze({ p1, p2, bodyModifier: target === "body" ? "Space" : null }),
    frameCount: 10,
    contactFrame,
    frameLabels: contactFrame === 6 ? TEN_FRAME_PHASES : EARLY_CONTACT_PHASES,
    sourceFacing: "right",
    mirrorForFacingLeft: true,
    provenance,
    verification: "visual-and-runtime",
  });

  const strikes = Object.freeze({
    leftPunchHead: strike({
      id: "leftPunchHead",
      label: "LEFT PUNCH // HEAD",
      file: "/assets/animations/strikes/left-punch-head-v3.png",
      limb: "left-hand",
      target: "head",
      p1: "U",
      p2: "N",
    }),
    rightPunchHead: strike({
      id: "rightPunchHead",
      label: "RIGHT PUNCH // HEAD",
      file: "/assets/animations/strikes/right-punch-head-v3.png",
      limb: "right-hand",
      target: "head",
      p1: "I",
      p2: "M",
    }),
    leftPunchBody: strike({
      id: "leftPunchBody",
      label: "LEFT PUNCH // BODY",
      file: "/assets/animations/strikes/left-punch-body-v3.png",
      limb: "left-hand",
      target: "body",
      p1: "Space + U",
      p2: "Space + N",
    }),
    rightPunchBody: strike({
      id: "rightPunchBody",
      label: "RIGHT PUNCH // BODY",
      file: "/assets/animations/strikes/right-punch-body-v3.png",
      limb: "right-hand",
      target: "body",
      p1: "Space + I",
      p2: "Space + M",
    }),
    leftKickHead: strike({
      id: "leftKickHead",
      label: "LEFT KICK // HEAD",
      file: "/assets/animations/strikes/left-kick-head-v3.png",
      limb: "left-leg",
      target: "head",
      p1: "J",
      p2: ",",
      contactFrame: 4,
    }),
    rightKickHead: strike({
      id: "rightKickHead",
      label: "RIGHT KICK // HEAD",
      file: "/assets/animations/strikes/right-kick-head-v3.png",
      limb: "right-leg",
      target: "head",
      p1: "K",
      p2: ".",
      contactFrame: 4,
    }),
    leftKickBody: strike({
      id: "leftKickBody",
      label: "LEFT KICK // BODY",
      file: "/assets/animations/strikes/left-kick-body-v3.png",
      limb: "left-leg",
      target: "body",
      p1: "Space + J",
      p2: "Space + ,",
    }),
    rightKickBody: strike({
      id: "rightKickBody",
      label: "RIGHT KICK // BODY",
      file: "/assets/animations/strikes/right-kick-body-v3.png",
      limb: "right-leg",
      target: "body",
      p1: "Space + K",
      p2: "Space + .",
      provenance: "generated-and-normalized-v3",
    }),
  });

  const strikeSheets = Object.fromEntries(Object.values(strikes).map((movement) => [
    movement.sheet,
    Object.freeze({
      src: movement.file,
      columns: 4,
      rows: 3,
      frames: movement.frameCount,
      fallbackWidth: 1536,
      fallbackHeight: 1023,
    }),
  ]));

  const sheets = Object.freeze({
    ...strikeSheets,
    hitReactions: Object.freeze({
      src: "/assets/anim-hit-reactions-v2.png",
      columns: 5,
      rows: 4,
      frames: 20,
      fallbackWidth: 1400,
      fallbackHeight: 1120,
    }),
    footwork: Object.freeze({
      src: "/assets/anim-footwork-v2.png",
      columns: 5,
      rows: 4,
      frames: 20,
      fallbackWidth: 1400,
      fallbackHeight: 1120,
    }),
    guards: Object.freeze({
      src: "/assets/anim-guards-v2.png",
      columns: 5,
      rows: 4,
      frames: 20,
      fallbackWidth: 1400,
      fallbackHeight: 1120,
    }),
    legacy: Object.freeze({
      src: "/assets/fighter-mma-sprites.png",
      columns: 4,
      rows: 2,
      frames: 8,
      fallbackWidth: 1774,
      fallbackHeight: 887,
    }),
  });

  const manifest = Object.freeze({
    version: "3.0.0",
    frameLimitPerMovement: 10,
    canonicalSourceFacing: "right",
    strikes,
    sheets,
  });

  globalThis.NEON_BRAWL_ANIMATIONS = manifest;
  if (typeof module !== "undefined" && module.exports) module.exports = manifest;
})();

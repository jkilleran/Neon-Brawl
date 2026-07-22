(() => {
  "use strict";

  const STORAGE_KEY = "neonBrawlInputSettingsV1";
  const STRIKE_ACTIONS = Object.freeze([
    "leftPunch",
    "rightPunch",
    "leftKick",
    "rightKick",
  ]);
  const ACTIONS = Object.freeze([
    Object.freeze({ id: "moveLeft", label: "Mover izquierda", shortLabel: "IZQ", kind: "held" }),
    Object.freeze({ id: "moveRight", label: "Mover derecha", shortLabel: "DER", kind: "held" }),
    Object.freeze({ id: "guardHigh", label: "Guardia alta", shortLabel: "ALTA", kind: "held" }),
    Object.freeze({ id: "guardLow", label: "Guardia baja", shortLabel: "BAJA", kind: "held" }),
    Object.freeze({ id: "leftPunch", label: "Puño izquierdo", shortLabel: "PI", kind: "pressed" }),
    Object.freeze({ id: "rightPunch", label: "Puño derecho", shortLabel: "PD", kind: "pressed" }),
    Object.freeze({ id: "leftKick", label: "Patada izquierda", shortLabel: "KI", kind: "pressed" }),
    Object.freeze({ id: "rightKick", label: "Patada derecha", shortLabel: "KD", kind: "pressed" }),
    Object.freeze({ id: "bodyModifier", label: "Modificador al cuerpo", shortLabel: "BODY", kind: "held" }),
    Object.freeze({ id: "evade", label: "Evasión", shortLabel: "EVADE", kind: "held" }),
  ]);
  const ACTION_IDS = Object.freeze(ACTIONS.map((action) => action.id));
  const RESERVED_CODES = new Set(["Escape", "Tab", "Enter", "F5", "F11", "F12"]);

  const DEFAULT_BINDINGS = Object.freeze({
    1: Object.freeze({
      moveLeft: "KeyA",
      moveRight: "KeyD",
      guardHigh: "KeyW",
      guardLow: "KeyS",
      leftPunch: "KeyT",
      rightPunch: "KeyY",
      leftKick: "KeyG",
      rightKick: "KeyH",
      bodyModifier: "Space",
      evade: "KeyE",
    }),
    2: Object.freeze({
      moveLeft: "ArrowLeft",
      moveRight: "ArrowRight",
      guardHigh: "ArrowUp",
      guardLow: "ArrowDown",
      leftPunch: "KeyI",
      rightPunch: "KeyO",
      leftKick: "KeyK",
      rightKick: "KeyL",
      bodyModifier: "ShiftRight",
      evade: "KeyP",
    }),
  });

  const GAMEPAD_LAYOUT = Object.freeze({
    guardHigh: Object.freeze({ button: 4, label: "LB / L1" }),
    guardLow: Object.freeze({ button: 6, label: "LT / L2" }),
    leftPunch: Object.freeze({ button: 2, label: "X / □" }),
    rightPunch: Object.freeze({ button: 3, label: "Y / △" }),
    leftKick: Object.freeze({ button: 0, label: "A / ✕" }),
    rightKick: Object.freeze({ button: 1, label: "B / ○" }),
    bodyModifier: Object.freeze({ button: 5, label: "RB / R1" }),
    evade: Object.freeze({ button: 7, label: "RT / R2" }),
    pause: Object.freeze({ button: 9, label: "MENU / OPTIONS" }),
  });

  const cloneBindings = () => ({
    1: { ...DEFAULT_BINDINGS[1] },
    2: { ...DEFAULT_BINDINGS[2] },
  });

  const defaultSettings = () => ({
    version: 1,
    bindings: cloneBindings(),
    gamepadDeadzone: 0.22,
    touchMode: "auto",
    touchOpacity: 0.72,
    touchScale: 1,
  });

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

  function formatCode(code) {
    const labels = {
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
      Space: "SPACE",
      ShiftLeft: "L SHIFT",
      ShiftRight: "R SHIFT",
      ControlLeft: "L CTRL",
      ControlRight: "R CTRL",
      AltLeft: "L ALT",
      AltRight: "R ALT",
      Backquote: "`",
      BracketLeft: "[",
      BracketRight: "]",
      Semicolon: ";",
      Quote: "'",
      Comma: ",",
      Period: ".",
      Slash: "/",
      Backslash: "\\",
      Minus: "-",
      Equal: "=",
    };
    if (labels[code]) return labels[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^Numpad\d$/.test(code)) return `NUM ${code.slice(6)}`;
    return String(code || "--").replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase();
  }

  function normalizeSettings(candidate) {
    const normalized = defaultSettings();
    if (!candidate || typeof candidate !== "object") return normalized;
    for (const player of [1, 2]) {
      const source = candidate.bindings?.[player];
      if (!source || typeof source !== "object") continue;
      const usedCodes = new Set();
      for (const action of ACTION_IDS) {
        const code = source[action];
        if (typeof code === "string"
          && code.length > 0
          && !RESERVED_CODES.has(code)
          && !usedCodes.has(code)) {
          normalized.bindings[player][action] = code;
          usedCodes.add(code);
        }
      }
    }
    if (["auto", "on", "off"].includes(candidate.touchMode)) {
      normalized.touchMode = candidate.touchMode;
    }
    normalized.touchOpacity = clamp(Number(candidate.touchOpacity) || 0.72, 0.35, 1);
    normalized.touchScale = clamp(Number(candidate.touchScale) || 1, 0.8, 1.2);
    normalized.gamepadDeadzone = clamp(Number(candidate.gamepadDeadzone) || 0.22, 0.08, 0.45);
    return normalized;
  }

  class NeonBrawlInputManager {
    constructor(options = {}) {
      this.storage = options.storage ?? globalThis.localStorage;
      this.navigator = options.navigator ?? globalThis.navigator;
      this.matchMedia = options.matchMedia ?? globalThis.matchMedia;
      this.settings = this.loadSettings();
      this.touchCapable = this.detectTouchCapability();
      this.heldKeys = new Set();
      this.pressedKeys = new Set();
      this.touchHeld = { 1: new Set(), 2: new Set() };
      this.touchPressed = { 1: new Set(), 2: new Set() };
      this.gamepadHeld = { 1: new Set(), 2: new Set() };
      this.gamepadPressed = { 1: new Set(), 2: new Set() };
      this.gamepadMove = { 1: 0, 2: 0 };
      this.previousGamepadHeld = { 1: new Set(), 2: new Set() };
      this.connectedPads = [];
      this.changeListeners = new Set();
      this.inputListeners = new Set();
    }

    detectTouchCapability() {
      const touchPoints = Number(this.navigator?.maxTouchPoints) || 0;
      let coarsePointer = false;
      try {
        coarsePointer = Boolean(this.matchMedia?.("(pointer: coarse)")?.matches);
      } catch {
        coarsePointer = false;
      }
      return touchPoints > 0 || coarsePointer;
    }

    loadSettings() {
      try {
        const stored = this.storage?.getItem(STORAGE_KEY);
        return normalizeSettings(stored ? JSON.parse(stored) : null);
      } catch {
        return defaultSettings();
      }
    }

    saveSettings() {
      try {
        this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch {
        // Private browsing or strict storage policies can disable persistence.
      }
      for (const listener of this.changeListeners) listener(this.getSettings());
    }

    getSettings() {
      return {
        ...this.settings,
        bindings: {
          1: { ...this.settings.bindings[1] },
          2: { ...this.settings.bindings[2] },
        },
      };
    }

    getPreference(name) {
      return this.settings[name];
    }

    onSettingsChange(listener) {
      this.changeListeners.add(listener);
      return () => this.changeListeners.delete(listener);
    }

    onInputChange(listener) {
      this.inputListeners.add(listener);
      return () => this.inputListeners.delete(listener);
    }

    emitInputChange(player, action, active) {
      for (const listener of this.inputListeners) listener({ player, action, active });
    }

    getBinding(player, action) {
      return this.settings.bindings[player]?.[action] ?? "";
    }

    setBinding(player, action, code) {
      if (![1, 2].includes(Number(player))
        || !ACTION_IDS.includes(action)
        || typeof code !== "string"
        || !code
        || RESERVED_CODES.has(code)) return false;
      const bindings = this.settings.bindings[player];
      const previousCode = bindings[action];
      const conflict = ACTION_IDS.find((candidate) => (
        candidate !== action && bindings[candidate] === code
      ));
      if (conflict) bindings[conflict] = previousCode;
      bindings[action] = code;
      this.releaseAll();
      this.saveSettings();
      return true;
    }

    resetBindings(player = null) {
      if ([1, 2].includes(Number(player))) {
        this.settings.bindings[player] = { ...DEFAULT_BINDINGS[player] };
      } else {
        this.settings.bindings = cloneBindings();
      }
      this.releaseAll();
      this.saveSettings();
    }

    resetSettings() {
      this.settings = defaultSettings();
      this.releaseAll();
      this.saveSettings();
    }

    setPreference(name, value) {
      if (name === "touchMode" && ["auto", "on", "off"].includes(value)) {
        this.settings.touchMode = value;
      } else if (name === "touchOpacity") {
        this.settings.touchOpacity = clamp(Number(value) || 0.72, 0.35, 1);
      } else if (name === "touchScale") {
        this.settings.touchScale = clamp(Number(value) || 1, 0.8, 1.2);
      } else if (name === "gamepadDeadzone") {
        this.settings.gamepadDeadzone = clamp(Number(value) || 0.22, 0.08, 0.45);
      } else {
        return false;
      }
      this.saveSettings();
      return true;
    }

    handleKeyDown(code, repeat = false) {
      if (typeof code !== "string" || !code) return;
      const newlyHeld = !this.heldKeys.has(code);
      if (!repeat && newlyHeld) this.pressedKeys.add(code);
      this.heldKeys.add(code);
      if (!newlyHeld) return;
      for (const player of [1, 2]) {
        const action = ACTION_IDS.find((candidate) => this.getBinding(player, candidate) === code);
        if (action) this.emitInputChange(player, action, true);
      }
    }

    handleKeyUp(code) {
      const wasHeld = this.heldKeys.has(code);
      this.heldKeys.delete(code);
      if (!wasHeld) return;
      for (const player of [1, 2]) {
        const action = ACTION_IDS.find((candidate) => this.getBinding(player, candidate) === code);
        if (action) this.emitInputChange(player, action, false);
      }
    }

    isMappedCode(code, player = null) {
      const players = player ? [Number(player)] : [1, 2];
      return players.some((candidate) => Object.values(this.settings.bindings[candidate]).includes(code));
    }

    isStrikeCode(code, player = 1) {
      return STRIKE_ACTIONS.some((action) => this.getBinding(player, action) === code);
    }

    setTouchAction(action, active, player = 1) {
      if (!ACTION_IDS.includes(action) || ![1, 2].includes(Number(player))) return;
      const held = this.touchHeld[player];
      const wasActive = held.has(action);
      if (active) {
        if (!wasActive) this.touchPressed[player].add(action);
        held.add(action);
      } else {
        held.delete(action);
      }
      if (wasActive !== Boolean(active)) this.emitInputChange(player, action, Boolean(active));
    }

    releaseTouch(player = 1) {
      if (![1, 2].includes(Number(player))) return;
      this.touchHeld[player].clear();
      this.touchPressed[player].clear();
    }

    buttonActive(gamepad, index) {
      const button = gamepad?.buttons?.[index];
      return Boolean(button && (button.pressed || button.value > 0.5));
    }

    pollGamepads() {
      let pads = [];
      try {
        pads = [...(this.navigator?.getGamepads?.() ?? [])].filter(Boolean);
      } catch {
        pads = [];
      }
      this.connectedPads = pads;
      for (const player of [1, 2]) {
        const gamepad = pads[player - 1];
        const held = new Set();
        let move = 0;
        if (gamepad) {
          const rawAxis = Number(gamepad.axes?.[0]) || 0;
          const deadzone = this.settings.gamepadDeadzone;
          if (Math.abs(rawAxis) > deadzone) {
            move = Math.sign(rawAxis) * ((Math.abs(rawAxis) - deadzone) / (1 - deadzone));
          }
          if (this.buttonActive(gamepad, 14)) move = -1;
          if (this.buttonActive(gamepad, 15)) move = 1;
          for (const [action, mapping] of Object.entries(GAMEPAD_LAYOUT)) {
            if (this.buttonActive(gamepad, mapping.button)) held.add(action);
          }
        }
        const previous = this.previousGamepadHeld[player];
        this.gamepadPressed[player] = new Set([...held].filter((action) => !previous.has(action)));
        this.gamepadHeld[player] = held;
        this.previousGamepadHeld[player] = new Set(held);
        this.gamepadMove[player] = clamp(move, -1, 1);
      }
      return this.getConnectedGamepads();
    }

    getConnectedGamepads() {
      return this.connectedPads.map((gamepad, index) => ({
        slot: index + 1,
        index: gamepad.index,
        id: gamepad.id || `Controller ${index + 1}`,
        mapping: gamepad.mapping || "standard",
      }));
    }

    keyHeld(player, action) {
      return this.heldKeys.has(this.getBinding(player, action));
    }

    keyPressed(player, action) {
      return this.pressedKeys.has(this.getBinding(player, action));
    }

    actionHeld(player, action) {
      return this.keyHeld(player, action)
        || this.touchHeld[player].has(action)
        || this.gamepadHeld[player].has(action);
    }

    actionPressed(player, action) {
      return this.keyPressed(player, action)
        || this.touchPressed[player].has(action)
        || this.gamepadPressed[player].has(action);
    }

    getPlayerInput(player, includeActions = true) {
      const keyboardMove = (this.actionHeld(player, "moveRight") ? 1 : 0)
        - (this.actionHeld(player, "moveLeft") ? 1 : 0);
      const analogMove = this.gamepadMove[player] || 0;
      const move = Math.abs(analogMove) > Math.abs(keyboardMove) ? analogMove : keyboardMove;
      return {
        move,
        guardHigh: this.actionHeld(player, "guardHigh"),
        guardLow: this.actionHeld(player, "guardLow"),
        leftPunch: includeActions && this.actionPressed(player, "leftPunch"),
        rightPunch: includeActions && this.actionPressed(player, "rightPunch"),
        leftKick: includeActions && this.actionPressed(player, "leftKick"),
        rightKick: includeActions && this.actionPressed(player, "rightKick"),
        bodyModifier: this.actionHeld(player, "bodyModifier"),
        takedown: false,
        evade: this.actionHeld(player, "evade"),
      };
    }

    pausePressed() {
      return this.gamepadPressed[1].has("pause") || this.gamepadPressed[2].has("pause");
    }

    consumeActions(player = 1) {
      for (const action of STRIKE_ACTIONS) {
        this.pressedKeys.delete(this.getBinding(player, action));
        this.touchPressed[player].delete(action);
        this.gamepadPressed[player].delete(action);
      }
    }

    endFrame() {
      this.pressedKeys.clear();
      this.touchPressed[1].clear();
      this.touchPressed[2].clear();
      this.gamepadPressed[1].clear();
      this.gamepadPressed[2].clear();
    }

    releaseAll() {
      this.heldKeys.clear();
      this.pressedKeys.clear();
      for (const player of [1, 2]) {
        this.touchHeld[player].clear();
        this.touchPressed[player].clear();
        this.gamepadHeld[player].clear();
        this.gamepadPressed[player].clear();
        this.previousGamepadHeld[player].clear();
        this.gamepadMove[player] = 0;
      }
    }

    shouldShowTouchControls() {
      if (this.settings.touchMode === "on") return true;
      if (this.settings.touchMode === "off") return false;
      return this.touchCapable;
    }
  }

  const api = {
    NeonBrawlInputManager,
    ACTIONS,
    ACTION_IDS,
    STRIKE_ACTIONS,
    DEFAULT_BINDINGS,
    GAMEPAD_LAYOUT,
    RESERVED_CODES,
    formatCode,
    normalizeSettings,
  };

  globalThis.NEON_BRAWL_INPUT = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();

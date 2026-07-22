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

  const RESERVED_GAMEPAD_BUTTONS = new Set([9]);
  const DEFAULT_GAMEPAD_BINDINGS = Object.freeze({
    1: Object.freeze({
      moveLeft: 14,
      moveRight: 15,
      guardHigh: 4,
      guardLow: 6,
      leftPunch: 2,
      rightPunch: 3,
      leftKick: 0,
      rightKick: 1,
      bodyModifier: 5,
      evade: 7,
    }),
    2: Object.freeze({
      moveLeft: 14,
      moveRight: 15,
      guardHigh: 4,
      guardLow: 6,
      leftPunch: 2,
      rightPunch: 3,
      leftKick: 0,
      rightKick: 1,
      bodyModifier: 5,
      evade: 7,
    }),
  });
  const GAMEPAD_LAYOUT = Object.freeze({
    ...Object.fromEntries(ACTION_IDS.map((action) => [
      action,
      Object.freeze({ button: DEFAULT_GAMEPAD_BINDINGS[1][action] }),
    ])),
    pause: Object.freeze({ button: 9, label: "MENU / OPTIONS" }),
  });

  const TOUCH_SLOTS = Object.freeze([
    Object.freeze({ id: "guardTop", label: "Arriba izquierda" }),
    Object.freeze({ id: "moveLeft", label: "Centro izquierda" }),
    Object.freeze({ id: "moveRight", label: "Centro derecha" }),
    Object.freeze({ id: "guardBottom", label: "Abajo izquierda" }),
    Object.freeze({ id: "attackTopLeft", label: "Ataque superior izq." }),
    Object.freeze({ id: "attackTopRight", label: "Ataque superior der." }),
    Object.freeze({ id: "attackBottomLeft", label: "Ataque inferior izq." }),
    Object.freeze({ id: "attackBottomRight", label: "Ataque inferior der." }),
    Object.freeze({ id: "utilityLeft", label: "Utilidad izquierda" }),
    Object.freeze({ id: "utilityRight", label: "Utilidad derecha" }),
  ]);
  const TOUCH_SLOT_IDS = Object.freeze(TOUCH_SLOTS.map((slot) => slot.id));
  const DEFAULT_TOUCH_BINDINGS = Object.freeze({
    guardTop: "guardHigh",
    moveLeft: "moveLeft",
    moveRight: "moveRight",
    guardBottom: "guardLow",
    attackTopLeft: "leftPunch",
    attackTopRight: "rightPunch",
    attackBottomLeft: "leftKick",
    attackBottomRight: "rightKick",
    utilityLeft: "bodyModifier",
    utilityRight: "evade",
  });

  const cloneBindings = () => ({
    1: { ...DEFAULT_BINDINGS[1] },
    2: { ...DEFAULT_BINDINGS[2] },
  });

  const cloneGamepadBindings = () => ({
    1: { ...DEFAULT_GAMEPAD_BINDINGS[1] },
    2: { ...DEFAULT_GAMEPAD_BINDINGS[2] },
  });

  const cloneTouchBindings = () => ({ ...DEFAULT_TOUCH_BINDINGS });

  const defaultSettings = () => ({
    version: 2,
    bindings: cloneBindings(),
    gamepadBindings: cloneGamepadBindings(),
    touchBindings: cloneTouchBindings(),
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

  function formatGamepadButton(button) {
    const labels = {
      0: "A / ✕",
      1: "B / ○",
      2: "X / □",
      3: "Y / △",
      4: "LB / L1",
      5: "RB / R1",
      6: "LT / L2",
      7: "RT / R2",
      8: "VIEW / SHARE",
      9: "MENU / OPTIONS",
      10: "LS / L3",
      11: "RS / R3",
      12: "D-PAD ↑",
      13: "D-PAD ↓",
      14: "D-PAD ←",
      15: "D-PAD →",
    };
    return labels[button] || `BUTTON ${Number(button) + 1}`;
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
      const gamepadSource = candidate.gamepadBindings?.[player];
      if (gamepadSource && typeof gamepadSource === "object") {
        const candidateButtons = ACTION_IDS.map((action) => Number(gamepadSource[action]));
        const uniqueButtons = new Set(candidateButtons);
        if (candidateButtons.every((button) => (
          Number.isInteger(button)
          && button >= 0
          && button <= 31
          && !RESERVED_GAMEPAD_BUTTONS.has(button)
        )) && uniqueButtons.size === ACTION_IDS.length) {
          for (const action of ACTION_IDS) {
            normalized.gamepadBindings[player][action] = Number(gamepadSource[action]);
          }
        }
      }
    }
    const touchSource = candidate.touchBindings;
    if (touchSource && typeof touchSource === "object") {
      const candidateActions = TOUCH_SLOT_IDS.map((slot) => touchSource[slot]);
      if (candidateActions.every((action) => ACTION_IDS.includes(action))
        && new Set(candidateActions).size === ACTION_IDS.length) {
        for (const slot of TOUCH_SLOT_IDS) {
          normalized.touchBindings[slot] = touchSource[slot];
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
      this.previousGamepadButtons = { 1: new Set(), 2: new Set() };
      this.connectedPads = [];
      this.changeListeners = new Set();
      this.inputListeners = new Set();
      this.gamepadButtonListeners = new Set();
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
        gamepadBindings: {
          1: { ...this.settings.gamepadBindings[1] },
          2: { ...this.settings.gamepadBindings[2] },
        },
        touchBindings: { ...this.settings.touchBindings },
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

    onGamepadButtonPress(listener) {
      this.gamepadButtonListeners.add(listener);
      return () => this.gamepadButtonListeners.delete(listener);
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

    getGamepadBinding(player, action) {
      return this.settings.gamepadBindings[player]?.[action];
    }

    setGamepadBinding(player, action, button) {
      player = Number(player);
      button = Number(button);
      if (![1, 2].includes(player)
        || !ACTION_IDS.includes(action)
        || !Number.isInteger(button)
        || button < 0
        || button > 31
        || RESERVED_GAMEPAD_BUTTONS.has(button)) return false;
      const bindings = this.settings.gamepadBindings[player];
      const previousButton = bindings[action];
      const conflict = ACTION_IDS.find((candidate) => (
        candidate !== action && bindings[candidate] === button
      ));
      if (conflict) bindings[conflict] = previousButton;
      bindings[action] = button;
      this.releaseAll();
      this.saveSettings();
      return true;
    }

    resetGamepadBindings(player = null) {
      if ([1, 2].includes(Number(player))) {
        this.settings.gamepadBindings[player] = { ...DEFAULT_GAMEPAD_BINDINGS[player] };
      } else {
        this.settings.gamepadBindings = cloneGamepadBindings();
      }
      this.releaseAll();
      this.saveSettings();
    }

    getTouchBinding(slot) {
      return this.settings.touchBindings[slot] || "";
    }

    setTouchBinding(slot, action) {
      if (!TOUCH_SLOT_IDS.includes(slot) || !ACTION_IDS.includes(action)) return false;
      const previousAction = this.settings.touchBindings[slot];
      const conflictSlot = TOUCH_SLOT_IDS.find((candidate) => (
        candidate !== slot && this.settings.touchBindings[candidate] === action
      ));
      if (conflictSlot) this.settings.touchBindings[conflictSlot] = previousAction;
      this.settings.touchBindings[slot] = action;
      this.releaseTouch(1);
      this.saveSettings();
      return true;
    }

    resetTouchBindings() {
      this.settings.touchBindings = cloneTouchBindings();
      this.releaseTouch(1);
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
        const activeButtons = new Set();
        let move = 0;
        if (gamepad) {
          const rawAxis = Number(gamepad.axes?.[0]) || 0;
          const deadzone = this.settings.gamepadDeadzone;
          if (Math.abs(rawAxis) > deadzone) {
            move = Math.sign(rawAxis) * ((Math.abs(rawAxis) - deadzone) / (1 - deadzone));
          }
          for (let button = 0; button < (gamepad.buttons?.length || 0); button += 1) {
            if (this.buttonActive(gamepad, button)) activeButtons.add(button);
          }
          for (const button of activeButtons) {
            if (!this.previousGamepadButtons[player].has(button)) {
              for (const listener of this.gamepadButtonListeners) listener({ player, button });
            }
          }
          for (const [action, button] of Object.entries(this.settings.gamepadBindings[player])) {
            if (activeButtons.has(button)) held.add(action);
          }
          if (activeButtons.has(GAMEPAD_LAYOUT.pause.button)) held.add("pause");
        }
        const previous = this.previousGamepadHeld[player];
        this.gamepadPressed[player] = new Set([...held].filter((action) => !previous.has(action)));
        this.gamepadHeld[player] = held;
        this.previousGamepadHeld[player] = new Set(held);
        this.previousGamepadButtons[player] = activeButtons;
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
        this.previousGamepadButtons[player].clear();
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
    DEFAULT_GAMEPAD_BINDINGS,
    DEFAULT_TOUCH_BINDINGS,
    TOUCH_SLOTS,
    TOUCH_SLOT_IDS,
    GAMEPAD_LAYOUT,
    RESERVED_GAMEPAD_BUTTONS,
    RESERVED_CODES,
    formatCode,
    formatGamepadButton,
    normalizeSettings,
  };

  globalThis.NEON_BRAWL_INPUT = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();

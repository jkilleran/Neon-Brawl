const assert = require("node:assert/strict");

const {
  NeonBrawlInputManager,
  DEFAULT_BINDINGS,
  DEFAULT_GAMEPAD_BINDINGS,
  DEFAULT_TOUCH_BINDINGS,
  DEFAULT_TOUCH_POSITIONS,
  formatCode,
  formatGamepadButton,
} = require("../input-manager.js");

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

const button = (pressed = false, value = pressed ? 1 : 0) => ({ pressed, value });
const gamepad = ({ id, axis = 0, buttons = {} }) => ({
  id,
  index: id === "Pad Two" ? 1 : 0,
  mapping: "standard",
  axes: [axis],
  buttons: Array.from({ length: 16 }, (_, index) => buttons[index] ?? button()),
});

const storage = new MemoryStorage();
let pads = [];
const navigator = {
  maxTouchPoints: 0,
  getGamepads: () => pads,
};
const input = new NeonBrawlInputManager({
  storage,
  navigator,
  matchMedia: () => ({ matches: false }),
});

assert.deepEqual(input.getSettings().bindings[1], DEFAULT_BINDINGS[1]);
assert.deepEqual(input.getSettings().gamepadBindings[1], DEFAULT_GAMEPAD_BINDINGS[1]);
assert.deepEqual(input.getSettings().touchBindings, DEFAULT_TOUCH_BINDINGS);
assert.deepEqual(input.getSettings().touchPositions, DEFAULT_TOUCH_POSITIONS);
assert.equal(DEFAULT_GAMEPAD_BINDINGS[1].guardHigh, 6, "L2 should be the default high guard");
assert.equal(DEFAULT_GAMEPAD_BINDINGS[1].bodyModifier, 7, "R2 should be the default body modifier");
assert.equal(DEFAULT_GAMEPAD_BINDINGS[1].evade, null, "Evade should remain unassigned by default");
assert.equal(input.getPreference("soundEnabled"), true);
assert.equal(input.getPreference("screenShake"), "full");
assert.equal(input.getPreference("showControlHints"), false);
assert.equal(formatCode("ArrowLeft"), "←");
assert.equal(formatCode("KeyT"), "T");
assert.equal(formatGamepadButton(2), "X / □");
assert.equal(formatGamepadButton(null), "SIN ASIGNAR");

input.handleKeyDown("KeyD");
assert.equal(input.getActiveInputMethod(1), "keyboard");
assert.equal(input.getPlayerInput(1).move, 1, "P1 keyboard should move right");
input.handleKeyDown("KeyT");
assert.equal(input.getPlayerInput(1).leftPunch, true, "Strike should fire on its press edge");
input.endFrame();
assert.equal(input.getPlayerInput(1).leftPunch, false, "Held strike must not repeat every frame");
input.handleKeyUp("KeyD");
input.handleKeyUp("KeyT");

assert.equal(input.setBinding(1, "leftPunch", "KeyY"), true);
assert.equal(input.getBinding(1, "leftPunch"), "KeyY");
assert.equal(input.getBinding(1, "rightPunch"), "KeyT", "Conflicting bindings should swap");
assert.equal(input.setBinding(1, "leftPunch", "Escape"), false, "Reserved keys should be rejected");
const restored = new NeonBrawlInputManager({ storage, navigator });
assert.equal(restored.getBinding(1, "leftPunch"), "KeyY", "Bindings should persist");

input.resetBindings(1);
input.setTouchAction("bodyModifier", true);
input.setTouchAction("rightKick", true);
assert.equal(input.getActiveInputMethod(1), "touch");
let playerOne = input.getPlayerInput(1);
assert.equal(playerOne.bodyModifier, true);
assert.equal(playerOne.rightKick, true, "Multi-touch modifier and strike should combine");
input.endFrame();
assert.equal(input.getPlayerInput(1).rightKick, false, "Touch strikes should also be edge-triggered");
input.releaseTouch();

assert.equal(input.setTouchBinding("attackTopLeft", "rightPunch"), true);
assert.equal(input.getTouchBinding("attackTopLeft"), "rightPunch");
assert.equal(input.getTouchBinding("attackTopRight"), "leftPunch", "Touch conflicts should swap slots");
input.resetTouchBindings();
assert(input.getTouchPosition("utilityLeft").x < 0.5, "BODY should default to the left half of the screen");
assert.equal(input.setTouchPosition("utilityLeft", { x: 0.4, y: 0.7 }), true);
assert.deepEqual(input.getTouchPosition("utilityLeft"), { x: 0.4, y: 0.7 });
input.resetTouchPositions();
assert.deepEqual(input.getTouchPosition("utilityLeft"), DEFAULT_TOUCH_POSITIONS.utilityLeft);

assert.equal(input.setGamepadBinding(1, "leftPunch", 8), true);
assert.equal(input.getGamepadBinding(1, "leftPunch"), 8);
assert.equal(input.setGamepadBinding(1, "leftPunch", 9), false, "Pause button should remain reserved");
assert.equal(input.setGamepadBinding(1, "evade", 5), true);
assert.equal(input.getGamepadBinding(1, "evade"), 5);
assert.equal(input.clearGamepadBinding(1, "evade"), true);
assert.equal(input.getGamepadBinding(1, "evade"), null);

pads = [gamepad({
  id: "Pad One",
  axis: 0.7,
  buttons: {
    8: button(true),
    6: button(true),
  },
})];
let capturedGamepadButton = null;
input.onGamepadButtonPress(({ player, button: buttonIndex }) => {
  capturedGamepadButton = { player, button: buttonIndex };
});
input.pollGamepads();
assert.equal(input.getActiveInputMethod(1), "gamepad");
assert.deepEqual(capturedGamepadButton, { player: 1, button: 8 }, "New button edges should be available to the mapping UI");
playerOne = input.getPlayerInput(1);
assert(playerOne.move > 0.5 && playerOne.move <= 1, "Analog movement should apply its deadzone");
assert.equal(playerOne.guardHigh, true, "L2 should hold high guard");
assert.equal(playerOne.guardLow, false);
assert.equal(playerOne.bodyModifier, false);
assert.equal(playerOne.leftPunch, true, "X/Square should trigger the left punch");
input.endFrame();
input.pollGamepads();
assert.equal(input.getPlayerInput(1).leftPunch, false, "Held gamepad strikes must not spam");

pads = [gamepad({ id: "Pad One" })];
input.pollGamepads();
input.endFrame();
pads = [gamepad({ id: "Pad One", buttons: { 7: button(true), 8: button(true) } })];
input.pollGamepads();
playerOne = input.getPlayerInput(1);
assert.equal(playerOne.bodyModifier, true, "R2 should modify the next strike to the body");
assert.equal(playerOne.leftPunch, true, "R2 and a strike should remain a valid strike combination");

pads = [gamepad({ id: "Pad One" })];
input.pollGamepads();
input.endFrame();
pads = [gamepad({ id: "Pad One", buttons: { 6: button(true), 7: button(true), 8: button(true) } })];
input.pollGamepads();
playerOne = input.getPlayerInput(1);
assert.equal(playerOne.guardHigh, false, "The combined triggers should replace high guard");
assert.equal(playerOne.guardLow, true, "L2 + R2 should derive low guard");
assert.equal(playerOne.bodyModifier, true, "R2 remains held while low guard is active");
assert.equal(playerOne.leftPunch, false, "Low guard should take priority over gamepad strikes");

pads = [
  gamepad({ id: "Pad One" }),
  gamepad({ id: "Pad Two", axis: -1, buttons: { 1: button(true) } }),
];
input.pollGamepads();
const playerTwo = input.getPlayerInput(2);
assert.equal(playerTwo.move, -1, "Second connected controller should drive P2");
assert.equal(playerTwo.rightKick, true, "B/Circle should trigger P2 right kick");
assert.equal(input.getActiveInputMethod(2), "gamepad");
assert.equal(input.getMostRecentPlayer(), 2);

const persistedMappings = new NeonBrawlInputManager({ storage, navigator });
assert.equal(persistedMappings.getGamepadBinding(1, "leftPunch"), 8, "Gamepad mapping should persist");
assert.deepEqual(persistedMappings.getSettings().touchBindings, DEFAULT_TOUCH_BINDINGS, "Touch layout should persist after reset");
assert.deepEqual(persistedMappings.getTouchPosition("utilityLeft"), DEFAULT_TOUCH_POSITIONS.utilityLeft);

const legacyStorage = new MemoryStorage();
legacyStorage.setItem("neonBrawlInputSettingsV1", JSON.stringify({
  version: 4,
  bindings: DEFAULT_BINDINGS,
  gamepadBindings: {
    1: { ...DEFAULT_GAMEPAD_BINDINGS[1], guardHigh: 4, guardLow: 6, bodyModifier: 5, evade: 7 },
    2: { ...DEFAULT_GAMEPAD_BINDINGS[2], guardHigh: 4, guardLow: 6, bodyModifier: 5, evade: 7 },
  },
  touchBindings: DEFAULT_TOUCH_BINDINGS,
}));
const migratedInput = new NeonBrawlInputManager({ storage: legacyStorage, navigator });
assert.deepEqual(migratedInput.getSettings().gamepadBindings[1], DEFAULT_GAMEPAD_BINDINGS[1], "Legacy controller layouts should migrate to the final trigger defaults");

input.setPreference("touchMode", "on");
assert.equal(input.shouldShowTouchControls(), true);
input.setPreference("touchMode", "off");
assert.equal(input.shouldShowTouchControls(), false);
input.setPreference("soundEnabled", false);
input.setPreference("screenShake", "reduced");
input.setPreference("showControlHints", true);
assert.equal(input.getPreference("soundEnabled"), false);
assert.equal(input.getPreference("screenShake"), "reduced");
assert.equal(input.getPreference("showControlHints"), true);

console.log("Input manager test passed: remapping, persistence, active-method detection and all device types.");

const assert = require("node:assert/strict");

const {
  NeonBrawlInputManager,
  DEFAULT_BINDINGS,
  DEFAULT_GAMEPAD_BINDINGS,
  DEFAULT_TOUCH_BINDINGS,
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
assert.equal(formatCode("ArrowLeft"), "←");
assert.equal(formatCode("KeyT"), "T");
assert.equal(formatGamepadButton(2), "X / □");

input.handleKeyDown("KeyD");
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

assert.equal(input.setGamepadBinding(1, "leftPunch", 8), true);
assert.equal(input.getGamepadBinding(1, "leftPunch"), 8);
assert.equal(input.setGamepadBinding(1, "leftPunch", 9), false, "Pause button should remain reserved");

pads = [gamepad({
  id: "Pad One",
  axis: 0.7,
  buttons: {
    8: button(true),
    4: button(true),
    5: button(true),
  },
})];
let capturedGamepadButton = null;
input.onGamepadButtonPress(({ player, button: buttonIndex }) => {
  capturedGamepadButton = { player, button: buttonIndex };
});
input.pollGamepads();
assert.deepEqual(capturedGamepadButton, { player: 1, button: 8 }, "New button edges should be available to the mapping UI");
playerOne = input.getPlayerInput(1);
assert(playerOne.move > 0.5 && playerOne.move <= 1, "Analog movement should apply its deadzone");
assert.equal(playerOne.guardHigh, true, "LB/L1 should hold high guard");
assert.equal(playerOne.bodyModifier, true, "RB/R1 should hold the body modifier");
assert.equal(playerOne.leftPunch, true, "X/Square should trigger the left punch");
input.endFrame();
input.pollGamepads();
assert.equal(input.getPlayerInput(1).leftPunch, false, "Held gamepad strikes must not spam");

pads = [
  gamepad({ id: "Pad One" }),
  gamepad({ id: "Pad Two", axis: -1, buttons: { 1: button(true) } }),
];
input.pollGamepads();
const playerTwo = input.getPlayerInput(2);
assert.equal(playerTwo.move, -1, "Second connected controller should drive P2");
assert.equal(playerTwo.rightKick, true, "B/Circle should trigger P2 right kick");

const persistedMappings = new NeonBrawlInputManager({ storage, navigator });
assert.equal(persistedMappings.getGamepadBinding(1, "leftPunch"), 8, "Gamepad mapping should persist");
assert.deepEqual(persistedMappings.getSettings().touchBindings, DEFAULT_TOUCH_BINDINGS, "Touch layout should persist after reset");

input.setPreference("touchMode", "on");
assert.equal(input.shouldShowTouchControls(), true);
input.setPreference("touchMode", "off");
assert.equal(input.shouldShowTouchControls(), false);

console.log("Input manager test passed: remapping, persistence, gamepads, touch and anti-spam edges.");

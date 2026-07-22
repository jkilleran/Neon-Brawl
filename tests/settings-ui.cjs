const assert = require("node:assert/strict");
const { NeonBrawlInputManager } = require("../input-manager.js");

class FakeClassList {
  constructor(...values) {
    this.values = new Set(values);
  }

  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    if (force) this.add(value);
    else this.remove(value);
  }
}

class FakeElement {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.textContent = "";
    this.value = "";
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }

  focus() {}
}

const selectors = new Map();
const element = (selector, dataset) => {
  const value = new FakeElement(dataset);
  selectors.set(selector, value);
  return value;
};
const screen = element("#settings-screen");
screen.classList.add("is-hidden");
element("#settings-close");
element("#settings-reset-all");
element("#binding-capture-status");
const deviceStatus = element("#settings-device-status");
const deviceLabel = new FakeElement();
const deviceCount = new FakeElement();
deviceStatus.querySelector = (selector) => (selector === "span" ? deviceLabel : deviceCount);
element("#touch-mode");
element("#touch-opacity");
element("#touch-opacity-value");
element("#touch-scale");
element("#touch-scale-value");
element("#gamepad-deadzone");
element("#gamepad-deadzone-value");

const bindingButton = new FakeElement({ bindingPlayer: "1", bindingAction: "leftPunch" });
const playerTabs = [
  new FakeElement({ settingsPlayer: "1" }),
  new FakeElement({ settingsPlayer: "2" }),
];
const playerPanels = [
  new FakeElement({ settingsPanel: "1" }),
  new FakeElement({ settingsPanel: "2" }),
];
const resetButtons = [new FakeElement({ resetPlayer: "1" })];

global.document = {
  querySelector: (selector) => selectors.get(selector),
  querySelectorAll(selector) {
    if (selector === "[data-binding-player]") return [bindingButton];
    if (selector === "[data-settings-player]") return playerTabs;
    if (selector === "[data-settings-panel]") return playerPanels;
    if (selector === "[data-reset-player]") return resetButtons;
    return [];
  },
};

const { NeonBrawlSettingsUI } = require("../settings-ui.js");
const input = new NeonBrawlInputManager({
  storage: null,
  navigator: { getGamepads: () => [], maxTouchPoints: 0 },
});
let closeRequested = false;
const ui = new NeonBrawlSettingsUI(input, { onClose: () => { closeRequested = true; } });

ui.open();
assert.equal(ui.isOpen, true);
bindingButton.dispatch("click");
assert.equal(bindingButton.textContent, "PRESS KEY");
assert.equal(ui.captureKey({ code: "KeyQ", preventDefault() {}, stopPropagation() {} }), true);
assert.equal(input.getBinding(1, "leftPunch"), "KeyQ");
assert.equal(bindingButton.textContent, "Q");

playerTabs[1].dispatch("click");
assert.equal(playerPanels[0].classList.contains("is-hidden"), true);
assert.equal(playerPanels[1].classList.contains("is-hidden"), false);

selectors.get("#touch-mode").value = "on";
selectors.get("#touch-mode").dispatch("change");
assert.equal(input.shouldShowTouchControls(), true);

selectors.get("#settings-close").dispatch("click");
assert.equal(closeRequested, true);

console.log("Settings UI test passed: capture, player tabs, preferences and close flow.");

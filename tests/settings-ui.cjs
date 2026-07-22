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
    this.options = [];
    this.style = {};
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }

  focus() {}
  append(child) { this.options.push(child); }
  setAttribute() {}
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 500 }; }
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
element("#settings-context-label");
element("#settings-context-mode");
element("#settings-context-title");
element("#settings-context-copy");
element("#settings-active-profile");
element("#settings-player-tabs");
element("#sound-mode");
element("#screen-shake-mode");
element("#control-hints-mode");
element("#settings-fullscreen-button");
element("#keyboard-method-state");
element("#gamepad-method-state");
element("#touch-method-state");
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
element("#reset-gamepad-bindings");
element("#reset-touch-bindings");
element("#reset-touch-positions");
element("#gamepad-mapping-player");
element("#gamepad-low-guard-chord");
element("#touch-layout-stage");

const bindingButton = new FakeElement({ bindingPlayer: "1", bindingAction: "leftPunch" });
const gamepadBindingButton = new FakeElement({ gamepadBindingAction: "leftPunch" });
const touchBindingSelect = new FakeElement({ touchBindingSlot: "attackTopLeft" });
const touchPositionButton = new FakeElement({ touchPositionSlot: "utilityLeft" });
const playerTabs = [
  new FakeElement({ settingsPlayer: "1" }),
  new FakeElement({ settingsPlayer: "2" }),
];
const playerPanels = [
  new FakeElement({ settingsPanel: "1" }),
  new FakeElement({ settingsPanel: "2" }),
];
const resetButtons = [new FakeElement({ resetPlayer: "1" })];
const sectionTabs = ["general", "keyboard", "gamepad", "touch"].map((section) => (
  new FakeElement({ settingsSectionTarget: section })
));
const sections = ["general", "keyboard", "gamepad", "touch"].map((section, index) => {
  const panel = new FakeElement({ settingsSection: section });
  if (index > 0) panel.classList.add("is-hidden");
  return panel;
});
const methodShortcuts = ["keyboard", "gamepad", "touch"].map((method) => (
  new FakeElement({ methodShortcut: method })
));

global.document = {
  createElement: () => new FakeElement(),
  querySelector: (selector) => selectors.get(selector),
  querySelectorAll(selector) {
    if (selector === "[data-binding-player]") return [bindingButton];
    if (selector === "[data-settings-player]") return playerTabs;
    if (selector === "[data-settings-panel]") return playerPanels;
    if (selector === "[data-reset-player]") return resetButtons;
    if (selector === "[data-gamepad-binding-action]") return [gamepadBindingButton];
    if (selector === "[data-touch-binding-slot]") return [touchBindingSelect];
    if (selector === "[data-touch-position-slot]") return [touchPositionButton];
    if (selector === "[data-settings-section-target]") return sectionTabs;
    if (selector === "[data-settings-section]") return sections;
    if (selector === "[data-method-shortcut]") return methodShortcuts;
    return [];
  },
};

const { NeonBrawlSettingsUI } = require("../settings-ui.js");
const input = new NeonBrawlInputManager({
  storage: null,
  navigator: { getGamepads: () => [], maxTouchPoints: 0 },
});
let closeRequested = false;
let fullscreenRequested = false;
const ui = new NeonBrawlSettingsUI(input, {
  onClose: () => { closeRequested = true; },
  onToggleFullscreen: () => { fullscreenRequested = true; },
});

ui.open();
assert.equal(ui.isOpen, true);
assert.equal(ui.activeSection, "general");
sectionTabs[1].dispatch("click");
assert.equal(ui.activeSection, "keyboard");
bindingButton.dispatch("click");
assert.equal(bindingButton.textContent, "PRESS KEY");
assert.equal(ui.captureKey({ code: "KeyQ", preventDefault() {}, stopPropagation() {} }), true);
assert.equal(input.getBinding(1, "leftPunch"), "KeyQ");
assert.equal(bindingButton.textContent, "Q");

sectionTabs[2].dispatch("click");
assert.match(selectors.get("#gamepad-low-guard-chord").textContent, /LT \/ L2.*RT \/ R2/);
gamepadBindingButton.dispatch("click");
assert.equal(gamepadBindingButton.textContent, "PRESS BUTTON");
assert.equal(ui.captureGamepadButton(1, 8), true);
assert.equal(input.getGamepadBinding(1, "leftPunch"), 8);
assert.equal(gamepadBindingButton.textContent, "VIEW / SHARE");
gamepadBindingButton.dispatch("click");
assert.equal(ui.captureKey({ code: "Delete", preventDefault() {}, stopPropagation() {} }), true);
assert.equal(input.getGamepadBinding(1, "leftPunch"), null);
assert.equal(gamepadBindingButton.textContent, "SIN ASIGNAR");

sectionTabs[3].dispatch("click");
touchBindingSelect.value = "rightPunch";
touchBindingSelect.dispatch("change");
assert.equal(input.getTouchBinding("attackTopLeft"), "rightPunch");
assert.equal(touchPositionButton.textContent, "BODY");
assert.equal(touchPositionButton.style.left, "24.00%");
touchPositionButton.dispatch("pointerdown", {
  pointerId: 4,
  button: 0,
  clientX: 360,
  clientY: 350,
  preventDefault() {},
});
touchPositionButton.dispatch("pointerup", {
  pointerId: 4,
  clientX: 360,
  clientY: 350,
  preventDefault() {},
});
assert.deepEqual(input.getTouchPosition("utilityLeft"), { x: 0.36, y: 0.7 });
selectors.get("#reset-touch-positions").dispatch("click");
assert.deepEqual(input.getTouchPosition("utilityLeft"), { x: 0.24, y: 0.91 });

playerTabs[1].dispatch("click");
assert.equal(playerPanels[0].classList.contains("is-hidden"), true);
assert.equal(playerPanels[1].classList.contains("is-hidden"), false);

selectors.get("#touch-mode").value = "on";
selectors.get("#touch-mode").dispatch("change");
assert.equal(input.shouldShowTouchControls(), true);

selectors.get("#sound-mode").value = "off";
selectors.get("#sound-mode").dispatch("change");
assert.equal(input.getPreference("soundEnabled"), false);
selectors.get("#screen-shake-mode").value = "reduced";
selectors.get("#screen-shake-mode").dispatch("change");
assert.equal(input.getPreference("screenShake"), "reduced");
selectors.get("#control-hints-mode").value = "on";
selectors.get("#control-hints-mode").dispatch("change");
assert.equal(input.getPreference("showControlHints"), true);
selectors.get("#settings-fullscreen-button").dispatch("click");
assert.equal(fullscreenRequested, true);

input.setTouchAction("guardHigh", true, 1);
ui.open({ inMatch: true, mode: "local", round: 2, player: 1 });
assert.equal(ui.activeSection, "touch", "In-match settings should open the current input method");
assert.equal(selectors.get("#settings-close").textContent, "VOLVER AL COMBATE");
assert.match(deviceLabel.textContent, /TÁCTIL/);
input.releaseTouch(1);

selectors.get("#settings-close").dispatch("click");
assert.equal(closeRequested, true);

console.log("Settings UI test passed: organized sections, contextual input, preferences and full remapping.");

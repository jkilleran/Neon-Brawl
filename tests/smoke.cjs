const assert = require("node:assert/strict");

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, forced) {
    if (forced === true) this.values.add(name);
    else if (forced === false) this.values.delete(name);
    else if (this.values.has(name)) this.values.delete(name);
    else this.values.add(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.style = {};
    this.textContent = "";
    this.innerHTML = "";
    this.offsetWidth = 100;
  }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }

  dispatch(type, event = {}) {
    for (const callback of this.listeners.get(type) || []) callback(event);
  }

  focus() {}

  setAttribute() {}

  async requestFullscreen() {
    document.fullscreenElement = this;
  }
}

const gradient = { addColorStop() {} };
const context = new Proxy({}, {
  get(target, property) {
    if (property === "createLinearGradient" || property === "createRadialGradient") {
      return () => gradient;
    }
    if (!(property in target)) target[property] = () => {};
    return target[property];
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  },
});

const canvas = new FakeElement();
canvas.width = 1280;
canvas.height = 720;
canvas.getContext = () => context;

const selectors = new Map();
const make = (selector) => {
  const element = selector === "#game" ? canvas : new FakeElement();
  selectors.set(selector, element);
  return element;
};

[
  "#game",
  "#game-shell",
  "#menu-screen",
  "#pause-screen",
  "#result-screen",
  "#round-message",
  "#round-kicker",
  "#round-title",
  "#result-kicker",
  "#result-title",
  "#result-copy",
  "#sound-button",
  "#sound-icon",
  "#resume-button",
  "#rematch-button",
  "#fullscreen-button",
  ".brand",
].forEach(make);

const modeButtons = [new FakeElement({ mode: "cpu" }), new FakeElement({ mode: "local" })];
const menuButtons = [new FakeElement(), new FakeElement()];
const windowListeners = new Map();
const animationFrames = [];

global.document = {
  fullscreenElement: null,
  querySelector(selector) {
    assert(selectors.has(selector), `Missing fake element for ${selector}`);
    return selectors.get(selector);
  },
  querySelectorAll(selector) {
    if (selector === "[data-mode]") return modeButtons;
    if (selector === ".menu-button") return menuButtons;
    return [];
  },
  async exitFullscreen() {
    this.fullscreenElement = null;
  },
};

global.window = {
  addEventListener(type, callback) {
    if (!windowListeners.has(type)) windowListeners.set(type, []);
    windowListeners.get(type).push(callback);
  },
};

global.requestAnimationFrame = (callback) => {
  animationFrames.push(callback);
};

require("../game.js");

assert.equal(animationFrames.length, 1, "The game should schedule its animation loop");
assert.equal(modeButtons[0].listeners.has("click"), true, "CPU mode should be interactive");

modeButtons[0].dispatch("click");
assert.equal(selectors.get("#menu-screen").classList.contains("is-hidden"), true);

let time = performance.now();
for (let frame = 0; frame < 260; frame += 1) {
  time += 1000 / 60;
  const callback = animationFrames.shift();
  assert(callback, `Missing animation frame ${frame}`);
  callback(time);

  if (frame === 120) {
    for (const listener of windowListeners.get("keydown") || []) {
      listener({ code: "KeyF", repeat: false, preventDefault() {} });
    }
  }
  if (frame === 121) {
    for (const listener of windowListeners.get("keyup") || []) listener({ code: "KeyF" });
  }
}

for (const listener of windowListeners.get("keydown") || []) {
  listener({ code: "Escape", repeat: false, preventDefault() {} });
}
assert.equal(selectors.get("#pause-screen").classList.contains("is-hidden"), false);
selectors.get("#resume-button").dispatch("click");
assert.equal(selectors.get("#pause-screen").classList.contains("is-hidden"), true);

console.log("Smoke test passed: menu, CPU match loop, input, pause and resume.");

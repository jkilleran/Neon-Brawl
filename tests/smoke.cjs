const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const animationManifest = require("../animation-manifest.js");

const markup = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const gameSource = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
assert.match(markup, /pause-controls-grid/, "Pause menu should expose the complete controls");
assert.match(markup, /WASD \+ UIJK/, "Pause menu should list Player 1 controls");
assert.match(markup, /FLECHAS \+ NM,\./, "Pause menu should list Player 2 controls");
assert.match(markup, /SPACE<\/kbd><span>mantener \+ cualquier golpe/, "Pause menu should explain the body modifier");
assert.match(markup, /animation-manifest\.js[\s\S]*game\.js/, "Animation manifest must load before the game");
assert.match(
  gameSource,
  /context\.translate\(this\.x, guardY\);[\s\S]*context\.scale\(this\.facing, 1\);[\s\S]*context\.arc\(22, 0, 48/,
  "Guard indicator must mirror with the fighter facing",
);
assert.equal(Object.keys(animationManifest.strikes).length, 8, "Catalog should expose eight isolated strikes");
assert.equal(animationManifest.strikes.leftPunchBody.limb, "left-hand");
assert.equal(animationManifest.strikes.leftPunchBody.target, "body");
assert.match(animationManifest.strikes.leftPunchBody.file, /left-punch-body-v5\.png$/);
assert.match(animationManifest.strikes.rightKickHead.file, /right-kick-head-v5\.png$/);
assert.match(animationManifest.strikes.rightKickBody.file, /right-kick-body-v5\.png$/);
for (const id of ["leftPunchBody", "rightKickHead", "rightKickBody"]) {
  assert.deepEqual(animationManifest.strikes[id].grid, {
    columns: 5,
    rows: 2,
    fallbackWidth: 1920,
    fallbackHeight: 682,
  });
}

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
  "#combat-controls",
  "#resume-button",
  "#rematch-button",
  "#fullscreen-button",
  ".brand",
].forEach(make);

const modeButtons = [new FakeElement({ mode: "cpu" }), new FakeElement({ mode: "local" })];
const menuButtons = [new FakeElement(), new FakeElement()];
const windowListeners = new Map();
const animationFrames = [];
const imageSources = [];

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

global.Image = class FakeImage {
  constructor() {
    this.complete = true;
  }

  set src(value) {
    this.source = value;
    imageSources.push(value);
  }

  get naturalWidth() {
    if (this.source?.includes("fighter-mma")) return 1774;
    if (this.source?.includes("-v5.png")) return 1920;
    return this.source?.includes("/animations/strikes/") ? 1536 : 1920;
  }

  get naturalHeight() {
    if (this.source?.includes("fighter-mma")) return 887;
    if (this.source?.includes("-v5.png")) return 682;
    return this.source?.includes("/animations/strikes/") ? 1023 : 1364;
  }
};

global.requestAnimationFrame = (callback) => {
  animationFrames.push(callback);
};

require("../game.js");

assert.equal(animationFrames.length, 1, "The game should schedule its animation loop");
assert.equal(modeButtons[0].listeners.has("click"), true, "CPU mode should be interactive");
assert.equal(imageSources.length, 12, "All modular combat animation sheets should preload");
for (const movement of Object.values(animationManifest.strikes)) {
  assert(imageSources.includes(movement.file), `${movement.id} should preload its own sheet`);
}
assert(imageSources.includes("/assets/animations/support/hit-reactions-v4.png"));
assert(imageSources.includes("/assets/animations/support/footwork-v3.png"));
assert(imageSources.includes("/assets/animations/support/guards-v3.png"));

modeButtons[0].dispatch("click");
assert.equal(selectors.get("#menu-screen").classList.contains("is-hidden"), true);

const sendKey = (type, code) => {
  for (const listener of windowListeners.get(type) || []) {
    listener({ code, repeat: false, preventDefault() {} });
  }
};

const tapFrames = new Map([
  [130, "KeyU"],
  [175, "KeyI"],
  [235, "KeyJ"],
  [305, "KeyK"],
  [390, "KeyU"],
]);

let time = performance.now();
for (let frame = 0; frame < 450; frame += 1) {
  time += 1000 / 60;
  const callback = animationFrames.shift();
  assert(callback, `Missing animation frame ${frame}`);
  callback(time);

  if (frame === 112) sendKey("keydown", "KeyD");
  if (frame === 114) sendKey("keydown", "KeyW");
  if (frame === 120) sendKey("keyup", "KeyW");
  if (frame === 121) sendKey("keydown", "KeyS");
  if (frame === 126) sendKey("keyup", "KeyS");
  if (frame === 126) sendKey("keyup", "KeyD");
  if (frame === 389) sendKey("keydown", "Space");
  if (frame === 391) sendKey("keyup", "Space");
  const tappedKey = tapFrames.get(frame);
  if (tappedKey) sendKey("keydown", tappedKey);
  const releasedKey = tapFrames.get(frame - 1);
  if (releasedKey) sendKey("keyup", releasedKey);
}

sendKey("keydown", "Escape");
assert.equal(selectors.get("#pause-screen").classList.contains("is-hidden"), false);
selectors.get("#resume-button").dispatch("click");
assert.equal(selectors.get("#pause-screen").classList.contains("is-hidden"), true);

console.log("Smoke test passed: expanded sprites, movement, guards, four strikes, body modifier, CPU loop and pause.");

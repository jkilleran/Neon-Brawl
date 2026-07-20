"use strict";

const assert = require("node:assert/strict");
const COMBAT_CONFIG = require("../combat-config.js");
const { OnlineMatchSimulation, FIXED_DELTA } = require("../online-simulation.cjs");

function advance(simulation, frames) {
  for (let frame = 0; frame < frames; frame += 1) simulation.update(FIXED_DELTA);
}

function readySimulation() {
  const simulation = new OnlineMatchSimulation({ random: () => 0.99 });
  simulation.activate();
  advance(simulation, Math.ceil(1.9 / FIXED_DELTA));
  assert.equal(simulation.state, "fighting");
  return simulation;
}

const simulation = readySimulation();
simulation.receiveInput("player1", { move: 1 }, 11);
simulation.receiveInput("player2", { move: -1 }, 17);
advance(simulation, 30);

let snapshot = simulation.snapshot();
assert.equal(snapshot.authority, "server");
assert.deepEqual(snapshot.inputAcknowledgements, { player1: 11, player2: 17 });
assert(snapshot.fighterOne.x > 380, "Server should advance Player 1 from its own input");
assert(snapshot.fighterTwo.x < 900, "Server should advance Player 2 from its own input");
assert(
  Math.abs((snapshot.fighterOne.x + snapshot.fighterTwo.x) - COMBAT_CONFIG.stage.width) < 0.01,
  "Mirrored movement must remain spatially symmetric",
);

simulation.fighterOne.x = 556;
simulation.fighterTwo.x = 724;
simulation.fighterOne.velocityX = 0;
simulation.fighterTwo.velocityX = 0;
simulation.receiveInput("player1", { move: 0, leftPunch: true }, 12);
simulation.receiveInput("player2", { move: 0, leftPunch: true }, 18);
advance(simulation, 24);

snapshot = simulation.snapshot();
assert.equal(snapshot.fighterOne.roundStats.landed, 1);
assert.equal(snapshot.fighterTwo.roundStats.landed, 1);
assert(
  Math.abs(snapshot.fighterOne.headHealth - snapshot.fighterTwo.headHealth) < 0.0001,
  "Simultaneous mirrored strikes must resolve without challenger priority",
);

const hostFirst = readySimulation();
const guestFirst = readySimulation();
hostFirst.receiveInput("player1", { move: 1, guardHigh: true }, 3);
hostFirst.receiveInput("player2", { move: -1, guardHigh: true }, 4);
guestFirst.receiveInput("player2", { move: -1, guardHigh: true }, 4);
guestFirst.receiveInput("player1", { move: 1, guardHigh: true }, 3);
advance(hostFirst, 45);
advance(guestFirst, 45);
assert.deepEqual(
  hostFirst.snapshot(),
  guestFirst.snapshot(),
  "Network arrival order before a fixed server tick must not change the match result",
);

const knockout = readySimulation();
knockout.fighterOne.x = 556;
knockout.fighterTwo.x = 724;
knockout.fighterTwo.headHealth = 1;
knockout.receiveInput("player1", { leftPunch: true }, 1);
advance(knockout, 24);
assert.equal(knockout.state, "roundOver");
assert.equal(knockout.matchWinner, knockout.fighterOne);
assert.equal(knockout.matchMethod, "K.O.");
assert.match(knockout.fighterTwo.finishAnimation.animation, /^headKnockout/);
advance(knockout, Math.ceil(3.3 / FIXED_DELTA));
assert.equal(knockout.state, "matchOver", "The neutral server should own the complete finish lifecycle");

const decision = readySimulation();
for (let round = 1; round <= COMBAT_CONFIG.maxRounds; round += 1) {
  decision.timer = 0;
  decision.update(FIXED_DELTA);
  assert.equal(decision.state, "roundOver");
  advance(decision, Math.ceil(2.5 / FIXED_DELTA));
  if (round < COMBAT_CONFIG.maxRounds) {
    assert.equal(decision.round, round + 1);
    advance(decision, Math.ceil(1.9 / FIXED_DELTA));
    assert.equal(decision.state, "fighting");
  }
}
assert.equal(decision.state, "matchOver");
assert.equal(decision.roundHistory.length, 3, "Server decisions should preserve all scorecard rounds");

console.log("Online simulation test passed: symmetry, simultaneous strikes, knockouts and three-round decisions.");

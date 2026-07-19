"use strict";

const assert = require("node:assert/strict");
const WebSocket = require("ws");
global.WebSocket = WebSocket;
const { createNeonBrawlServer, sanitizeInput, sanitizeName } = require("../server.cjs");
const { NeonBrawlOnlineClient, latencyQuality } = require("../online-client.js");

assert.equal(sanitizeName("  Róök<script>  "), "Róökscript");
assert.equal(sanitizeName(""), "NEON FIGHTER");
assert.equal(latencyQuality(12), "excellent");
assert.equal(latencyQuality(50), "good");
assert.equal(latencyQuality(95), "fair");
assert.equal(latencyQuality(180), "high");
assert.equal(latencyQuality(null), "unknown");
const clientEvents = [];
const protocolMessages = [];
const protocolClient = new NeonBrawlOnlineClient({
  challengeSent: (opponent) => clientEvents.push(["sent", opponent.name]),
  challengeDeclined: (opponent) => clientEvents.push(["declined", opponent.name]),
  remoteReady: () => clientEvents.push(["ready"]),
});
protocolClient.socket = {
  readyState: WebSocket.OPEN,
  send: (raw) => protocolMessages.push(JSON.parse(raw)),
};
protocolClient.receive({ type: "challengeSent", to: { id: "vex", name: "Friend" } });
protocolClient.receive({ type: "challengeDeclined", by: { id: "vex", name: "Friend" } });
protocolClient.receive({
  type: "matchStart",
  role: "guest",
  matchId: "match-1",
  opponent: { id: "rook", name: "Johan" },
});
protocolClient.receive({ type: "remoteReady" });
assert.deepEqual(clientEvents, [["sent", "Friend"], ["declined", "Friend"], ["ready"]]);
assert.deepEqual(protocolMessages, [{ type: "matchReady" }], "A guest should request a fresh initial snapshot");
assert.deepEqual(sanitizeInput({ move: 5, leftPunch: 1, takedown: true }), {
  move: 1,
  guardHigh: false,
  guardLow: false,
  leftPunch: true,
  rightPunch: false,
  leftKick: false,
  rightKick: false,
  bodyModifier: false,
  takedown: false,
  evade: false,
});

function testClient(url) {
  const socket = new WebSocket(url);
  const messages = [];
  const waiters = [];
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    messages.push(message);
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(message)) continue;
      waiters.splice(waiters.indexOf(waiter), 1);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    }
  });
  return {
    socket,
    messages,
    open: () => new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    }),
    send: (payload) => socket.send(JSON.stringify(payload)),
    waitFor(predicate, timeoutMs = 2000) {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve, reject };
        waiter.timeout = setTimeout(() => {
          waiters.splice(waiters.indexOf(waiter), 1);
          reject(new Error(`Timed out waiting for message. Received: ${JSON.stringify(messages)}`));
        }, timeoutMs);
        waiters.push(waiter);
      });
    },
    close: () => new Promise((resolve) => {
      if (socket.readyState === WebSocket.CLOSED) return resolve();
      socket.once("close", resolve);
      socket.close();
    }),
  };
}

(async () => {
  const onlineServer = createNeonBrawlServer({
    port: 0,
    host: "127.0.0.1",
    logger: { log() {}, warn() {} },
  });
  const address = await onlineServer.start();
  const url = `ws://127.0.0.1:${address.port}/ws`;
  const rook = testClient(url);
  const vex = testClient(url);

  try {
    await Promise.all([rook.open(), vex.open()]);
    rook.send({ type: "hello", name: "Johan" });
    vex.send({ type: "hello", name: "Friend" });
    const rookWelcome = await rook.waitFor(({ type }) => type === "welcome");
    const vexWelcome = await vex.waitFor(({ type }) => type === "welcome");
    const lobby = await rook.waitFor((message) => message.type === "lobby" && message.searchingCount === 2);
    assert.deepEqual(lobby.players.map(({ name }) => name).sort(), ["Friend", "Johan"]);

    rook.send({ type: "latencyProbe", id: 42 });
    const latencyPong = await rook.waitFor((message) => message.type === "latencyPong" && message.id === 42);
    assert.equal(latencyPong.id, 42);

    rook.send({ type: "challenge", targetId: vexWelcome.id });
    const challengeSent = await rook.waitFor(({ type }) => type === "challengeSent");
    assert.equal(challengeSent.to.name, "Friend");
    const incoming = await vex.waitFor(({ type }) => type === "challengeIncoming");
    assert.equal(incoming.from.id, rookWelcome.id);
    vex.send({ type: "acceptChallenge", challengerId: rookWelcome.id });
    const hostMatch = await rook.waitFor(({ type }) => type === "matchStart");
    const guestMatch = await vex.waitFor(({ type }) => type === "matchStart");
    assert.equal(hostMatch.role, "host");
    assert.equal(guestMatch.role, "guest");
    assert.equal(hostMatch.matchId, guestMatch.matchId);

    vex.send({ type: "matchReady" });
    await rook.waitFor(({ type }) => type === "remoteReady");

    vex.send({
      type: "input",
      sequence: 7,
      input: { move: -3, rightKick: true, bodyModifier: true, takedown: true },
    });
    const remoteInput = await rook.waitFor((message) => message.type === "remoteInput" && message.sequence === 7);
    assert.equal(remoteInput.input.move, -1);
    assert.equal(remoteInput.input.rightKick, true);
    assert.equal(remoteInput.input.bodyModifier, true);
    assert.equal(remoteInput.input.takedown, false);

    const sampleSnapshot = {
      state: "fighting",
      round: 1,
      timer: 179.5,
      guestInputSequence: 7,
    };
    rook.send({ type: "snapshot", sequence: 11, snapshot: sampleSnapshot });
    const snapshot = await vex.waitFor((message) => message.type === "snapshot" && message.sequence === 11);
    assert.deepEqual(snapshot.snapshot, sampleSnapshot);

    vex.send({ type: "leaveMatch" });
    const opponentLeft = await rook.waitFor(({ type }) => type === "opponentLeft");
    assert.match(opponentLeft.reason, /lobby/i);
    await rook.waitFor((message) => message.type === "lobby" && message.searchingCount === 2);

    console.log("Online server test passed: latency probe, lobby, challenge, roles, input relay, snapshots and lobby return.");
  } finally {
    await Promise.all([rook.close(), vex.close()]);
    await onlineServer.stop();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

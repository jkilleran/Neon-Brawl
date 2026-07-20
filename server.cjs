"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const { WebSocket, WebSocketServer } = require("ws");
const COMBAT_CONFIG = require("./combat-config.js");
const { OnlineMatchSimulation, FIXED_DELTA } = require("./online-simulation.cjs");

const MAX_NAME_LENGTH = 18;
const MAX_MESSAGE_BYTES = 128 * 1024;
const MAX_REALTIME_BUFFER_BYTES = 24 * 1024;
const HEARTBEAT_INTERVAL_MS = 25_000;

function sanitizeName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH) || "NEON FIGHTER";
}

function sanitizeInput(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    move: Math.max(-1, Math.min(1, Number(source.move) || 0)),
    guardHigh: Boolean(source.guardHigh),
    guardLow: Boolean(source.guardLow),
    leftPunch: Boolean(source.leftPunch),
    rightPunch: Boolean(source.rightPunch),
    leftKick: Boolean(source.leftKick),
    rightKick: Boolean(source.rightKick),
    bodyModifier: Boolean(source.bodyModifier),
    takedown: false,
    evade: Boolean(source.evade),
  };
}

function createNeonBrawlServer({
  port = Number(process.env.PORT) || 3000,
  host = "0.0.0.0",
  staticDir = path.join(__dirname, "dist"),
  logger = console,
} = {}) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: MAX_MESSAGE_BYTES,
    perMessageDeflate: false,
  });
  const players = new Map();
  const matches = new Map();

  app.disable("x-powered-by");
  app.get("/healthz", (_request, response) => {
    response.json({
      ok: true,
      authority: "server",
      connectedPlayers: players.size,
      activeMatches: matches.size,
    });
  });
  app.use(express.static(staticDir, {
    index: false,
    etag: true,
    maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
  }));
  app.get(/.*/, (_request, response) => {
    const indexFile = path.join(staticDir, "index.html");
    if (!fs.existsSync(indexFile)) {
      response.status(503).send("Build missing. Run npm run build before starting the online server.");
      return;
    }
    response.sendFile(indexFile);
  });

  function send(player, payload, { dropIfBusy = false } = {}) {
    return sendSerialized(player, JSON.stringify(payload), { dropIfBusy });
  }

  function sendSerialized(player, serializedPayload, { dropIfBusy = false } = {}) {
    if (player?.ws.readyState === WebSocket.OPEN) {
      if (dropIfBusy && player.ws.bufferedAmount > MAX_REALTIME_BUFFER_BYTES) return false;
      player.ws.send(serializedPayload);
      return true;
    }
    return false;
  }

  function searchingPlayers() {
    return [...players.values()]
      .filter((player) => player.ready && player.status === "searching")
      .map(({ id, name }) => ({ id, name }));
  }

  function broadcastLobby() {
    const lobbyPlayers = searchingPlayers();
    const payload = {
      type: "lobby",
      searchingCount: lobbyPlayers.length,
      players: lobbyPlayers,
    };
    for (const player of players.values()) {
      if (player.ready) send(player, payload);
    }
  }

  function removePendingChallenges(playerId) {
    for (const player of players.values()) player.incomingChallenges.delete(playerId);
    const player = players.get(playerId);
    if (player) player.incomingChallenges.clear();
  }

  function returnPlayerToLobby(player, reason = null) {
    if (!player) return;
    const match = player.matchId ? matches.get(player.matchId) : null;
    if (match) {
      const opponentId = match.playerOneId === player.id ? match.playerTwoId : match.playerOneId;
      const opponent = players.get(opponentId);
      matches.delete(match.id);
      if (opponent) {
        opponent.matchId = null;
        opponent.role = null;
        opponent.status = "searching";
        send(opponent, { type: "opponentLeft", reason: reason ?? "Opponent returned to the lobby." });
      }
    }
    player.matchId = null;
    player.role = null;
    player.status = "searching";
    removePendingChallenges(player.id);
    broadcastLobby();
  }

  function startMatch(challenger, challenged) {
    const match = {
      id: crypto.randomUUID(),
      playerOneId: challenger.id,
      playerTwoId: challenged.id,
      createdAt: Date.now(),
      simulation: new OnlineMatchSimulation(),
      readyRoles: new Set(),
      accumulator: 0,
      snapshotAccumulator: 0,
      snapshotSequence: 0,
      completedSnapshotSent: false,
    };
    matches.set(match.id, match);
    challenger.status = "playing";
    challenger.matchId = match.id;
    challenger.role = "player1";
    challenged.status = "playing";
    challenged.matchId = match.id;
    challenged.role = "player2";
    removePendingChallenges(challenger.id);
    removePendingChallenges(challenged.id);

    send(challenger, {
      type: "matchStart",
      matchId: match.id,
      role: "player1",
      playerNumber: 1,
      opponent: { id: challenged.id, name: challenged.name },
    });
    send(challenged, {
      type: "matchStart",
      matchId: match.id,
      role: "player2",
      playerNumber: 2,
      opponent: { id: challenger.id, name: challenger.name },
    });
    broadcastLobby();
  }

  function sendMatchSnapshot(match, force = false) {
    if (!match || match.readyRoles.size < 2) return false;
    const snapshotInterval = 1 / COMBAT_CONFIG.snapshotHz;
    if (!force && match.snapshotAccumulator < snapshotInterval) return false;
    match.snapshotAccumulator = force ? 0 : match.snapshotAccumulator % snapshotInterval;
    match.snapshotSequence += 1;
    const payload = {
      type: "snapshot",
      sequence: match.snapshotSequence,
      snapshot: match.simulation.snapshot(),
    };
    const serializedPayload = JSON.stringify(payload);
    const playerOneSent = sendSerialized(
      players.get(match.playerOneId),
      serializedPayload,
      { dropIfBusy: !force },
    );
    const playerTwoSent = sendSerialized(
      players.get(match.playerTwoId),
      serializedPayload,
      { dropIfBusy: !force },
    );
    return playerOneSent || playerTwoSent;
  }

  wss.on("error", (error) => logger.warn?.("WebSocket server error:", error.message));

  wss.on("connection", (ws, request) => {
    request.socket.setNoDelay(true);
    request.socket.setKeepAlive(true, HEARTBEAT_INTERVAL_MS);
    const player = {
      id: crypto.randomUUID(),
      name: "NEON FIGHTER",
      ws,
      ready: false,
      status: "connecting",
      role: null,
      matchId: null,
      incomingChallenges: new Set(),
    };
    players.set(player.id, player);
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
    ws.on("error", (error) => logger.warn?.("WebSocket error:", error.message));

    ws.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        send(player, { type: "error", code: "INVALID_JSON", message: "Invalid online message." });
        return;
      }
      if (!message || typeof message.type !== "string") return;

      if (message.type === "hello") {
        if (player.ready) return;
        player.name = sanitizeName(message.name);
        player.ready = true;
        player.status = "searching";
        send(player, { type: "welcome", id: player.id, name: player.name });
        broadcastLobby();
        return;
      }
      if (!player.ready) return;

      if (message.type === "latencyProbe") {
        const id = Number(message.id);
        if (Number.isSafeInteger(id) && id >= 0) send(player, { type: "latencyPong", id });
        return;
      }

      if (message.type === "challenge") {
        const target = players.get(String(message.targetId));
        if (!target || target.id === player.id || target.status !== "searching" || player.status !== "searching") {
          send(player, { type: "error", code: "PLAYER_UNAVAILABLE", message: "That fighter is no longer available." });
          return;
        }
        target.incomingChallenges.add(player.id);
        send(target, { type: "challengeIncoming", from: { id: player.id, name: player.name } });
        send(player, { type: "challengeSent", to: { id: target.id, name: target.name } });
        return;
      }

      if (message.type === "acceptChallenge") {
        const challenger = players.get(String(message.challengerId));
        if (!challenger
          || !player.incomingChallenges.has(challenger.id)
          || challenger.status !== "searching"
          || player.status !== "searching") {
          send(player, { type: "error", code: "CHALLENGE_EXPIRED", message: "That challenge has expired." });
          return;
        }
        startMatch(challenger, player);
        return;
      }

      if (message.type === "declineChallenge") {
        const challenger = players.get(String(message.challengerId));
        player.incomingChallenges.delete(String(message.challengerId));
        send(challenger, { type: "challengeDeclined", by: { id: player.id, name: player.name } });
        return;
      }

      if (message.type === "input") {
        if (!player.matchId || !player.role) return;
        const match = matches.get(player.matchId);
        if (!match) return;
        match.simulation.receiveInput(
          player.role,
          sanitizeInput(message.input),
          Number(message.sequence) || 0,
        );
        return;
      }

      if (message.type === "matchReady") {
        if (!player.matchId || !player.role) return;
        const match = matches.get(player.matchId);
        if (!match) return;
        match.readyRoles.add(player.role);
        if (match.readyRoles.size === 2 && !match.simulation.active) {
          match.simulation.activate();
          sendMatchSnapshot(match, true);
        }
        return;
      }

      if (message.type === "snapshot") {
        send(player, {
          type: "error",
          code: "SERVER_AUTHORITY",
          message: "Match snapshots are generated by the server.",
        });
        return;
      }

      if (message.type === "leaveMatch") returnPlayerToLobby(player);
    });

    ws.on("close", () => {
      const matchId = player.matchId;
      players.delete(player.id);
      removePendingChallenges(player.id);
      if (matchId) {
        const match = matches.get(matchId);
        if (match) {
          const opponentId = match.playerOneId === player.id ? match.playerTwoId : match.playerOneId;
          const opponent = players.get(opponentId);
          matches.delete(matchId);
          if (opponent) {
            opponent.matchId = null;
            opponent.role = null;
            opponent.status = "searching";
            send(opponent, { type: "opponentLeft", reason: `${player.name} disconnected.` });
          }
        }
      }
      broadcastLobby();
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref?.();

  let previousSimulationTime = performance.now();
  const simulationTicker = setInterval(() => {
    const now = performance.now();
    const elapsed = Math.min(Math.max(0, (now - previousSimulationTime) / 1000), 0.1);
    previousSimulationTime = now;
    for (const match of matches.values()) {
      if (match.readyRoles.size < 2) continue;
      if (match.completedSnapshotSent) continue;
      match.accumulator += elapsed;
      match.snapshotAccumulator += elapsed;
      let steps = 0;
      while (match.accumulator >= FIXED_DELTA && steps < 6) {
        match.simulation.update(FIXED_DELTA);
        match.accumulator -= FIXED_DELTA;
        steps += 1;
      }
      if (steps >= 6) match.accumulator = 0;
      if (match.simulation.state === "matchOver") {
        sendMatchSnapshot(match, true);
        match.completedSnapshotSent = true;
      } else sendMatchSnapshot(match);
    }
  }, 1000 / COMBAT_CONFIG.simulationHz);
  simulationTicker.unref?.();

  function start() {
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => {
        server.off("error", reject);
        const address = server.address();
        logger.log?.(`Neon Brawl online server listening on http://${host}:${address.port}`);
        resolve(address);
      });
    });
  }

  function stop() {
    clearInterval(heartbeat);
    clearInterval(simulationTicker);
    for (const ws of wss.clients) ws.close(1001, "Server shutting down");
    return new Promise((resolve) => wss.close(() => server.close(resolve)));
  }

  return { app, server, wss, players, matches, start, stop };
}

if (require.main === module) {
  const onlineServer = createNeonBrawlServer();
  onlineServer.start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

  const shutdown = () => onlineServer.stop().finally(() => process.exit(0));
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

module.exports = {
  createNeonBrawlServer,
  sanitizeInput,
  sanitizeName,
};

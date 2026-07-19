(() => {
  "use strict";

  const LATENCY_PROBE_INTERVAL_MS = 1_000;
  const MAX_REALTIME_BUFFER_BYTES = 64 * 1024;

  function latencyQuality(latencyMs) {
    if (!Number.isFinite(latencyMs)) return "unknown";
    if (latencyMs < 35) return "excellent";
    if (latencyMs < 70) return "good";
    if (latencyMs < 120) return "fair";
    return "high";
  }

  function monotonicNow() {
    return globalThis.performance?.now?.() ?? Date.now();
  }

  class NeonBrawlOnlineClient {
    constructor(handlers = {}) {
      this.handlers = handlers;
      this.socket = null;
      this.id = null;
      this.name = "";
      this.role = null;
      this.matchId = null;
      this.opponent = null;
      this.connected = false;
      this.intentionalClose = false;
      this.reconnectAttempts = 0;
      this.reconnectTimer = null;
      this.latencyProbeTimer = null;
      this.latencyProbeSequence = 0;
      this.pendingLatencyProbes = new Map();
      this.latencyMs = null;
      this.jitterMs = null;
      this.lastRawLatencyMs = null;
    }

    get url() {
      const override = new URLSearchParams(globalThis.location?.search ?? "").get("onlineServer");
      if (override) return override;
      const location = globalThis.location;
      if (location?.hostname === "localhost" && location.port === "5173") {
        return "ws://localhost:3000/ws";
      }
      const protocol = location?.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${location?.host ?? "localhost:3000"}/ws`;
    }

    emit(name, payload) {
      this.handlers[name]?.(payload);
    }

    connect(name) {
      this.name = String(name || "NEON FIGHTER").trim().slice(0, 18);
      this.intentionalClose = false;
      clearTimeout(this.reconnectTimer);
      this.stopLatencyProbes();
      this.latencyMs = null;
      this.jitterMs = null;
      this.lastRawLatencyMs = null;
      this.emit("latency", { latencyMs: null, jitterMs: null, quality: "unknown" });
      if (this.socket && this.socket.readyState <= WebSocket.OPEN) this.socket.close();
      this.emit("status", { state: "connecting", message: "CONNECTING TO NEON NETWORK…" });

      const socket = new WebSocket(this.url);
      this.socket = socket;
      socket.addEventListener("open", () => {
        if (socket !== this.socket) return;
        this.connected = true;
        this.reconnectAttempts = 0;
        this.send({ type: "hello", name: this.name });
        this.startLatencyProbes();
        this.emit("status", { state: "online", message: "CONNECTED // SEARCHING FOR FIGHTERS" });
      });
      socket.addEventListener("message", (event) => {
        if (socket !== this.socket) return;
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        this.receive(message);
      });
      socket.addEventListener("error", () => {
        if (socket !== this.socket) return;
        this.emit("status", { state: "error", message: "ONLINE SERVER UNAVAILABLE" });
      });
      socket.addEventListener("close", () => {
        if (socket !== this.socket) return;
        this.connected = false;
        this.stopLatencyProbes();
        this.role = null;
        this.matchId = null;
        this.opponent = null;
        this.emit("disconnected");
        this.emit("latency", { latencyMs: null, jitterMs: null, quality: "unknown" });
        if (!this.intentionalClose) this.scheduleReconnect();
      });
    }

    scheduleReconnect() {
      clearTimeout(this.reconnectTimer);
      const delay = Math.min(12_000, 750 * (2 ** this.reconnectAttempts));
      this.reconnectAttempts += 1;
      this.emit("status", {
        state: "reconnecting",
        message: `CONNECTION LOST // RETRYING IN ${(delay / 1000).toFixed(1)}s`,
      });
      this.reconnectTimer = setTimeout(() => this.connect(this.name), delay);
    }

    receive(message) {
      switch (message.type) {
        case "welcome":
          this.id = message.id;
          this.name = message.name;
          this.emit("welcome", message);
          break;
        case "lobby":
          this.emit("lobby", message);
          break;
        case "challengeIncoming":
          this.emit("challenge", message.from);
          break;
        case "challengeSent":
          this.emit("status", { state: "waiting", message: `CHALLENGE SENT TO ${message.to.name}` });
          break;
        case "challengeDeclined":
          this.emit("status", { state: "online", message: `${message.by.name} DECLINED // SEARCHING` });
          break;
        case "matchStart":
          this.role = message.role;
          this.matchId = message.matchId;
          this.opponent = message.opponent;
          this.emit("match", message);
          break;
        case "remoteInput":
          this.emit("remoteInput", message);
          break;
        case "snapshot":
          this.emit("snapshot", message);
          break;
        case "latencyPong":
          this.receiveLatencyPong(message);
          break;
        case "opponentLeft":
          this.role = null;
          this.matchId = null;
          this.opponent = null;
          this.emit("opponentLeft", message);
          break;
        case "error":
          this.emit("error", message);
          break;
        default:
          break;
      }
    }

    startLatencyProbes() {
      this.stopLatencyProbes();
      this.sendLatencyProbe();
      this.latencyProbeTimer = setInterval(
        () => this.sendLatencyProbe(),
        LATENCY_PROBE_INTERVAL_MS,
      );
      this.latencyProbeTimer.unref?.();
    }

    stopLatencyProbes() {
      clearInterval(this.latencyProbeTimer);
      this.latencyProbeTimer = null;
      this.pendingLatencyProbes.clear();
    }

    sendLatencyProbe() {
      if (!this.connected) return false;
      const now = monotonicNow();
      for (const [id, startedAt] of this.pendingLatencyProbes) {
        if (now - startedAt > 10_000) this.pendingLatencyProbes.delete(id);
      }
      this.latencyProbeSequence += 1;
      const id = this.latencyProbeSequence;
      this.pendingLatencyProbes.set(id, now);
      if (this.send({ type: "latencyProbe", id })) return true;
      this.pendingLatencyProbes.delete(id);
      return false;
    }

    receiveLatencyPong({ id }) {
      const startedAt = this.pendingLatencyProbes.get(id);
      if (startedAt === undefined) return;
      this.pendingLatencyProbes.delete(id);
      const rawLatencyMs = Math.max(0, monotonicNow() - startedAt);
      const previousSmoothed = this.latencyMs;
      const variation = this.lastRawLatencyMs === null
        ? 0
        : Math.abs(rawLatencyMs - this.lastRawLatencyMs);
      this.latencyMs = Math.round(
        previousSmoothed === null ? rawLatencyMs : previousSmoothed * 0.72 + rawLatencyMs * 0.28,
      );
      this.jitterMs = Math.round(
        this.jitterMs === null ? variation : this.jitterMs * 0.75 + variation * 0.25,
      );
      this.lastRawLatencyMs = rawLatencyMs;
      this.emit("latency", {
        latencyMs: this.latencyMs,
        jitterMs: this.jitterMs,
        quality: latencyQuality(this.latencyMs),
      });
    }

    send(payload) {
      if (this.socket?.readyState !== WebSocket.OPEN) return false;
      this.socket.send(JSON.stringify(payload));
      return true;
    }

    challenge(targetId) {
      return this.send({ type: "challenge", targetId });
    }

    acceptChallenge(challengerId) {
      return this.send({ type: "acceptChallenge", challengerId });
    }

    declineChallenge(challengerId) {
      return this.send({ type: "declineChallenge", challengerId });
    }

    sendInput(input, sequence) {
      return this.send({ type: "input", input, sequence });
    }

    sendSnapshot(snapshot, sequence) {
      if ((this.socket?.bufferedAmount ?? 0) > MAX_REALTIME_BUFFER_BYTES) return false;
      return this.send({ type: "snapshot", snapshot, sequence });
    }

    leaveMatch() {
      const sent = this.send({ type: "leaveMatch" });
      this.role = null;
      this.matchId = null;
      this.opponent = null;
      return sent;
    }

    disconnect() {
      this.intentionalClose = true;
      clearTimeout(this.reconnectTimer);
      this.stopLatencyProbes();
      this.socket?.close(1000, "Client closed lobby");
      this.socket = null;
      this.connected = false;
    }
  }

  globalThis.NeonBrawlOnlineClient = NeonBrawlOnlineClient;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { NeonBrawlOnlineClient, latencyQuality };
  }
})();

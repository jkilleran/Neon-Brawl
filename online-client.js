(() => {
  "use strict";

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
      if (this.socket && this.socket.readyState <= WebSocket.OPEN) this.socket.close();
      this.emit("status", { state: "connecting", message: "CONNECTING TO NEON NETWORK…" });

      const socket = new WebSocket(this.url);
      this.socket = socket;
      socket.addEventListener("open", () => {
        if (socket !== this.socket) return;
        this.connected = true;
        this.reconnectAttempts = 0;
        this.send({ type: "hello", name: this.name });
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
        this.role = null;
        this.matchId = null;
        this.opponent = null;
        this.emit("disconnected");
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
      this.socket?.close(1000, "Client closed lobby");
      this.socket = null;
      this.connected = false;
    }
  }

  globalThis.NeonBrawlOnlineClient = NeonBrawlOnlineClient;
  if (typeof module !== "undefined" && module.exports) module.exports = { NeonBrawlOnlineClient };
})();

# Online Mode and Render Deployment

## Scope

Online Arena is a deliberately small first multiplayer implementation for friend testing. It prioritizes a stable shared result over competitive rollback networking.

The system provides:

- real-time lobby presence;
- named searching players;
- direct challenges with accept/decline;
- one active opponent per player;
- Player 1 controls on each participant's own keyboard;
- authoritative damage, random rolls, stamina, knockdowns, round transitions, and scorecards;
- automatic stale-connection detection and browser reconnect attempts.

## Architecture

The deployment uses one Node Web Service:

```text
Browser A ──┐                    ┌─ Vite production files
            ├─ HTTPS/WSS ─ Node ┤
Browser B ──┘                    └─ /ws lobby and match relay
```

`server.cjs` serves `dist/` through Express and upgrades `/ws` connections with `ws`. Render terminates TLS, so browsers connect with `wss://` in production. The application derives the WebSocket URL from the page origin.

The build keeps the complete editable sprite library in Git but removes individual frame directories and archived source revisions from `dist/`. Production therefore deploys only the runtime atlases and small metadata files required by the current fighters.

The player who sends the accepted challenge becomes the authoritative host and controls Rook. The challenged player is the guest and controls Vex. The guest sends input messages to the host. Strike and defense key transitions are sent immediately, while a small periodic input stream keeps held controls synchronized. Online movement uses screen directions: `A` always moves left and `D` always moves right. Therefore Vex advances with `A` when starting on the right side and retreats with `D`. The host simulates the match and sends authoritative snapshots at 45 Hz. This prevents independent `Math.random()` calls or frame timing differences from producing different damage and outcomes.

Version 0.16.2 validates replicated coordinates, facing, attack identifiers, timers, and animation identifiers before drawing them. Invalid state is ignored or replaced with a safe idle frame, so a malformed or partially serialized snapshot cannot make a fighter disappear or stop the Canvas loop.

Version 0.16.3 adds a guest-ready handshake that requests a fresh initial snapshot after the guest has entered the match. It also moves authoritative host simulation to a small worker-driven background clock while the host tab is hidden. This avoids the browser's background `requestAnimationFrame` suspension leaving the guest on `READY` during two-tab testing.

Version 0.17.0 removes the largest host/guest responsiveness difference with guest-side prediction. Vex now applies its own movement, guard changes, and strike animation startup immediately instead of waiting for a round trip through the server and host. Every host snapshot acknowledges the latest guest input sequence that the simulation has processed. The guest only reconciles against a snapshot that includes its latest real control change, preventing an older state from pulling against a new direction. Reconciliation does not rewind strike animation, and invalid predictions are cancelled when the host reports stun, knockdown, or a finished match. Damage, stamina spending, blocks, critical rolls, knockdowns, knockouts, the clock, and scoring remain host-authoritative.

Remote movement is extrapolated from the most recent authoritative velocity using half of the measured RTT plus jitter, with a strict 200 ms ceiling. Corrections use exponential smoothing, while large errors snap to the safe authoritative position. Animation fast-forward is capped at 80 ms so latency compensation cannot skip an entire strike or impact reaction. Snapshot buffers are shed at 24 KiB on both relay hops, prioritizing fresh state over replaying obsolete visual frames after congestion.

The client sends a one-second application-level probe and measures its round-trip time (RTT) to the game server. The lobby and match HUD display a smoothed RTT and grade it as excellent, good, fair, or high. This is server RTT, not a direct peer-to-peer measurement.

On a local machine, RTT should normally be only a few milliseconds. A delay felt in the first online version was primarily its 20 Hz snapshot cadence and authoritative guest path, not Internet latency. Version 0.16.1 raised snapshots to 30 Hz, sent guest control transitions immediately, disabled TCP packet coalescing on accepted sockets, and dropped obsolete snapshots when either outgoing real-time buffer became congested. Version 0.17.0 raises snapshots to 45 Hz and predicts the guest's local presentation. Inputs are never intentionally dropped.

Prediction reduces perceived input delay but cannot remove physical network latency. Under high RTT, the guest sees their control response immediately, while the authoritative result of contact still arrives after network transit. Hosting Render in a region near both players and keeping exactly one instance remain the most effective deployment choices.

## Current test limitations

- Lobby and matches are held in memory; a deployment restart clears them.
- Use exactly one Render instance. Multiple instances would need shared presence/match state through Redis or another broker.
- There is no account, rating, password, private-room code, spectator mode, rollback, or host migration yet.
- If the authoritative host disconnects, the match ends and the guest returns to matchmaking.
- This version is intended for friend testing, not hostile public matchmaking.

## Protocol summary

Client messages:

| Type | Direction | Purpose |
| --- | --- | --- |
| `hello` | Client → server | Register sanitized lobby name |
| `challenge` | Client → server | Challenge one available player |
| `acceptChallenge` | Client → server | Accept a specific incoming challenge |
| `declineChallenge` | Client → server | Decline a challenge |
| `input` | Guest → host | Relay horizontal screen direction and bounded combat input |
| `matchReady` | Guest → host | Confirm the guest can receive the initial authoritative snapshot |
| `snapshot` | Host → guest | Relay authoritative match state and latest guest-input acknowledgement |
| `leaveMatch` | Client → server | End pairing and return to the lobby |
| `latencyProbe` | Client → server | Start an application RTT sample |
| `latencyPong` | Server → client | Complete an RTT sample |

The server caps WebSocket payloads, sanitizes names and inputs, disables network takedown requests, and only relays match traffic from the assigned role to its assigned opponent. Snapshot shedding prevents old visual states from forming a growing queue on a slow client; the next fresh authoritative snapshot replaces any skipped state.

## Test locally

Build and start the online server:

```bash
npm ci
npm run dev:online
```

Open `http://localhost:3000` in two browser tabs. In each tab:

1. Select **ONLINE ARENA**.
2. Enter a different fighter name.
3. Select **CONNECT**.
4. From one tab, select **CHALLENGE** beside the other player.
5. Accept the challenge in the second tab.

You can also test from another device on the same network by opening `http://<computer-lan-ip>:3000`.

## Deploy with `render.yaml`

The repository includes a Render Blueprint:

```yaml
services:
  - type: web
    name: neon-brawl-online
    runtime: node
    plan: free
    buildCommand: npm ci --include=dev && npm run build
    startCommand: npm start
    healthCheckPath: /healthz
    numInstances: 1
```

Deployment steps:

1. Push the updated branch to GitHub.
2. In Render, create a new Blueprint and select the Neon Brawl repository.
3. Choose the branch containing Online Arena.
4. Allow Render to read `render.yaml` and create the Web Service.
5. Wait for `/healthz` to pass.
6. Open the generated `https://<service>.onrender.com` address on two devices.

If configuring the service manually, use:

- Runtime: `Node`
- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Health check: `/healthz`
- Instance count: `1`

Render requires the public server to bind to `0.0.0.0` and the `PORT` environment variable. `server.cjs` does both. Render routes HTTP and WebSocket upgrades through the same public port.

## Health and validation

`GET /healthz` returns:

```json
{
  "ok": true,
  "connectedPlayers": 0,
  "activeMatches": 0
}
```

Run before deployment:

```bash
npm run check
npm test
npm run build
```

The online integration test creates two real WebSocket clients and verifies latency probes, registration, lobby presence, challenge acceptance, host/guest assignment, input relay, snapshot relay, and return to matchmaking.

## References

- [Render WebSocket documentation](https://render.com/docs/websocket)
- [Render Web Services documentation](https://render.com/docs/web-services)
- [Render Blueprint YAML reference](https://render.com/docs/blueprint-spec)
- [`ws` project documentation](https://github.com/websockets/ws)

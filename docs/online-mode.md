# Online Mode and Render Deployment

## Scope

Online Arena is a deliberately small multiplayer implementation for friend testing. It uses a neutral server authority, fixed simulation steps, and symmetric client prediction. It prioritizes an equal, stable shared result over competitive rollback networking.

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
            ├─ HTTPS/WSS ─ Node ┼─ /ws lobby and input transport
Browser B ──┘                    └─ fixed-step match simulation
```

`server.cjs` serves `dist/` through Express, upgrades `/ws` connections with `ws`, and owns every online match simulation. Render terminates TLS, so browsers connect with `wss://` in production. The application derives the WebSocket URL from the page origin.

The build keeps the complete editable sprite library in Git but removes individual frame directories and archived source revisions from `dist/`. Production therefore deploys only the runtime atlases and small metadata files required by the current fighters.

The challenger controls Rook and the challenged player controls Vex, but neither browser is authoritative. Both send bounded input directly to the Node server. Strike and defense key transitions are sent immediately, while a small periodic stream keeps held controls synchronized. The server advances all matches at a fixed 60 Hz and broadcasts the same authoritative frame to both players at 30 Hz. Random damage outcomes, stamina, blocks, criticals, knockdowns, knockouts, the clock, and scorecards are therefore decided once in a neutral location.

Online movement uses screen directions: `A` always moves left and `D` always moves right. Therefore Vex advances with `A` when starting on the right side and retreats with `D`.

Version 0.16.2 validates replicated coordinates, facing, attack identifiers, timers, and animation identifiers before drawing them. Invalid state is ignored or replaced with a safe idle frame, so a malformed or partially serialized snapshot cannot make a fighter disappear or stop the Canvas loop.

Version 0.16.3 added a guest-ready handshake and browser-host background clock. Version 0.18.0 supersedes both with a two-player ready barrier and server clock. A hidden, throttled, or slower browser can no longer pause the other player's match simulation.

Version 0.18.0 gives both roles the same local presentation path. Each browser predicts only its own movement, guard changes, and strike startup. Server snapshots acknowledge the latest processed input sequence independently for Rook and Vex. A browser only corrects position against a snapshot that includes its latest real control change, preventing stale state from pulling against a new direction. Reconciliation does not rewind a confirmed strike animation and cancels invalid predictions after authoritative stun, knockdown, rejection, or match completion.

Version 0.18.1 separates guard presentation from authoritative guard resolution. A delayed snapshot can still confirm whether a strike was blocked, but it cannot rewind a locally held guard, re-raise a released guard, or repeatedly restart the transition. Remote guards use the same continuous client-frame interpolation, so both participants see all ten transition frames instead of 30 Hz frame jumps. Snapshot bursts are coalesced to the newest frame before rendering, and the server serializes the shared snapshot once before sending the identical bytes to both players. These are presentation and transport optimizations; combat authority remains exclusively on the neutral server.

Remote movement is extrapolated from the most recent authoritative velocity using half of the measured RTT plus jitter, with a strict 200 ms ceiling. Corrections use exponential smoothing, while large errors snap to the safe authoritative position. Animation fast-forward is capped at 80 ms so latency compensation cannot skip an entire strike. Server snapshot buffers are shed at 24 KiB, prioritizing fresh state over replaying obsolete visual frames after congestion.

The client sends a one-second application-level probe and measures its round-trip time (RTT) to the game server. The lobby and match HUD display a smoothed RTT and grade it as excellent, good, fair, or high. This is server RTT, not a direct peer-to-peer measurement.

On a local machine, RTT should normally be only a few milliseconds. Earlier versions routed the challenged player's input through the challenger's browser and sent state only in the opposite direction. Version 0.18.0 removes that asymmetric path. Both players now travel client → server for input and server → client for state, and both receive the same 30 Hz frame generated by a 60 Hz simulation. Inputs are never intentionally dropped.

Prediction reduces perceived input delay but cannot remove physical network latency. Under high RTT, the guest sees their control response immediately, while the authoritative result of contact still arrives after network transit. Hosting Render in a region near both players and keeping exactly one instance remain the most effective deployment choices.

## Current test limitations

- Lobby and matches are held in memory; a deployment restart clears them.
- Use exactly one Render instance. Multiple instances would need shared presence/match state through Redis or another broker.
- There is no account, rating, password, private-room code, spectator mode, rollback, or host migration yet.
- If either player disconnects, the match ends and the remaining player returns to matchmaking.
- This version is intended for friend testing, not hostile public matchmaking.

## Protocol summary

Client messages:

| Type | Direction | Purpose |
| --- | --- | --- |
| `hello` | Client → server | Register sanitized lobby name |
| `challenge` | Client → server | Challenge one available player |
| `acceptChallenge` | Client → server | Accept a specific incoming challenge |
| `declineChallenge` | Client → server | Decline a challenge |
| `input` | Either client → server | Submit horizontal screen direction and bounded combat input |
| `matchReady` | Either client → server | Join the two-player ready barrier |
| `snapshot` | Server → both clients | Broadcast one neutral match frame and per-player input acknowledgements |
| `leaveMatch` | Client → server | End pairing and return to the lobby |
| `latencyProbe` | Client → server | Start an application RTT sample |
| `latencyPong` | Server → client | Complete an RTT sample |

The server caps WebSocket payloads, sanitizes names and inputs, disables network takedown requests, and rejects client-generated snapshots. Snapshot shedding prevents old visual states from forming a growing queue on a slow client; the browser also coalesces a burst of already-arrived snapshots so only its newest state reaches the next render frame.

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
  "authority": "server",
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

The online tests verify fixed-step simulation, mirrored movement, simultaneous strikes without challenger priority, per-player acknowledgements, non-rewinding guard presentation, snapshot coalescing, two real WebSocket clients receiving identical snapshots, rejected client authority, latency probes, lobby flow, and return to matchmaking.

## References

- [Render WebSocket documentation](https://render.com/docs/websocket)
- [Render Web Services documentation](https://render.com/docs/web-services)
- [Render Blueprint YAML reference](https://render.com/docs/blueprint-spec)
- [`ws` project documentation](https://github.com/websockets/ws)

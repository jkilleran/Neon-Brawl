# Universal Input and Settings

Neon Brawl 0.25.0 routes keyboard, gamepad, and touch controls through one browser-side input manager. Every device produces the same combat input object, so movement, guards, stamina costs, strike priority, and server authority remain independent of the control method.

## Settings access

Open Settings from the gear button in the application header or from the local pause screen. Settings cannot cover an active online match because online combat cannot pause. The panel can still be opened before joining a match or after returning to the lobby.

Settings are stored in `localStorage` under `neonBrawlInputSettingsV1`. Storage failure is non-fatal: the game falls back to defaults for that browser session.

## Keyboard mapping

Player 1 and Player 2 have independent mappings for:

- screen-left and screen-right movement;
- high and low guard;
- left and right punches;
- left and right kicks;
- the body-strike modifier;
- evade.

Select a binding and press a replacement key. If that key already belongs to another action for the same player, the two actions swap instead of becoming ambiguous. `Escape`, `Tab`, `Enter`, `F5`, `F11`, and `F12` remain reserved for navigation or browser behavior.

Player 1's profile is used for Quick Fight, Practice Lab, the first local fighter, and the user's own fighter in Online Arena. Player 2's profile is used only by the second fighter in Local Sparring.

## Gamepads

Controllers are detected with the standard browser Gamepad API and can be used at the same time as the keyboard. The first connected gamepad contributes to Player 1 and the second contributes to Player 2.

| Action | Xbox-style | PlayStation-style |
| --- | --- | --- |
| Movement | Left stick or D-pad | Left stick or D-pad |
| High guard | `LB` | `L1` |
| Low guard | `LT` | `L2` |
| Left punch | `X` | `Square` |
| Right punch | `Y` | `Triangle` |
| Left kick | `A` | `Cross` |
| Right kick | `B` | `Circle` |
| Body modifier | `RB` | `R1` |
| Evade | `RT` | `R2` |
| Pause local match | `Menu` | `Options` |

The analog deadzone is adjustable from 8% to 45%. Strike buttons use a rising-edge check, so holding a button cannot repeatedly spam a strike.

## Touch overlay

The touch overlay supports `Auto`, `Visible`, and `Hidden` modes. Auto mode appears only when the browser reports touch points or a coarse pointer. It controls Player 1 in Quick Fight, Practice Lab, Local Sparring, and Online Arena.

The left cluster contains movement and both guards. The right cluster contains four distinct strikes, a holdable body modifier, and evade. A small center button pauses local matches. Pointer capture and independent pointer IDs allow a body modifier and strike button to be held together.

Touch controls are regular lightweight HTML buttons layered over the Canvas. They do not increase the Canvas resolution, add draw calls to the arena, change the 60 Hz simulation, or alter online packets. Opacity and scale are presentation-only preferences.

## Online behavior

Online input continues to contain only normalized combat actions. Keyboard and touch transitions are sent immediately. Gamepads are polled once per animation frame and enter the existing 60 Hz input stream. The Node server remains the only combat authority; clients do not send damage, health, stamina, hit results, or match outcomes.

## Maintenance contract

- Add new device support inside `input-manager.js`, not inside fighter simulation code.
- Keep device mappings out of `online-simulation.cjs`; the server accepts normalized actions only.
- Preserve edge-triggered strike inputs and held guard/modifier inputs.
- Update `tests/input-manager.cjs` whenever an input preference or device mapping changes.
- Keep touch UI under `#game-viewport` so it shares the same responsive 16:9 coordinate surface as every other combat overlay.

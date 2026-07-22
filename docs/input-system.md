# Universal Input and Settings

Neon Brawl 0.34.0 routes keyboard, gamepad, and touch controls through one browser-side input manager. Every device produces the same combat input object, so movement, guards, stamina costs, strike priority, and server authority remain independent of the control method.

## Settings access

Settings is a primary category beside Local and Online on the main menu. It can also be opened from the gear button in the application header or from the local pause screen. Settings cannot cover an active online match because online combat cannot pause. The panel can still be opened before joining a match or after returning to the lobby.

The interface is divided into four categories:

- **General** contains sound, screen-shake intensity, optional in-fight control hints, fullscreen, and a live overview of available input methods.
- **Keyboard** contains independent Player 1 and Player 2 key maps.
- **Gamepad** contains independent Player 1 and Player 2 button maps plus the analog deadzone.
- **Touch** contains visibility, opacity, scale, and all ten remappable touch positions.

The input manager records the most recent meaningful keyboard, controller, or touch action for each player. Settings shows that method in its status header. When Settings is opened from a paused local fight, it selects the most recently active player and opens that player's active input category immediately. The fight remains paused and control changes apply as soon as the player returns. The General category stays available from the same panel for important presentation changes.

Settings are stored in `localStorage` under `neonBrawlInputSettingsV1`. Storage failure is non-fatal: the game falls back to defaults for that browser session.

## General presentation preferences

- **Sound** controls the existing synth mute state and stays synchronized with the header sound button.
- **Screen shake** supports Full, Reduced, and Off without changing hit outcomes or timing.
- **Control hints** can show a compact strike reference during a fight and remain hidden by default.
- **Fullscreen** uses the browser Fullscreen API and safely does nothing when an embedded preview blocks that API.

These preferences are presentation-only. They do not change combat balance, simulation speed, network packets, or server authority.

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
| High guard | `LT` | `L2` |
| Low guard | Hold `LT + RT` | Hold `L2 + R2` |
| Left punch | `X` | `Square` |
| Right punch | `Y` | `Triangle` |
| Left kick | `A` | `Cross` |
| Right kick | `B` | `Circle` |
| Body modifier | `RT` | `R2` |
| Evade | Unassigned | Unassigned |
| Pause local match | `Menu` | `Options` |

Every direct D-pad and combat action can be remapped independently for Player 1 and Player 2. Select an action, then press the desired controller button. Conflicts swap assignments; press Delete while listening to leave an action unassigned. `LB / L1` and `RB / R1` have no default action, evade begins unassigned, and `Menu` / `Options` remains reserved for pause. Low guard is derived from the buttons currently assigned to High Guard + Body Modifier, so the chord remains correct after either trigger is remapped. The left analog stick always controls movement so a custom D-pad layout cannot strand a player.

Holding only the Body Modifier and pressing any face-button strike selects that strike's body animation. Holding High Guard and Body Modifier together replaces high guard with low guard and gives that defensive chord priority over controller strike buttons. Controller settings saved before v0.34.0 migrate once to this final trigger layout so old direct low-guard, body, or evade assignments cannot override it.

The analog deadzone is adjustable from 8% to 45%. Strike buttons use a rising-edge check, so holding a button cannot repeatedly spam a strike.

## Touch overlay

The touch overlay supports `Auto`, `Visible`, and `Hidden` modes. Auto mode appears only when the browser reports touch points or a coarse pointer. It controls Player 1 in Quick Fight, Practice Lab, Local Sparring, and Online Arena.

The left cluster contains movement and both guards. The right cluster contains four distinct strikes, a holdable body modifier, and evade. A small center button pauses local matches. Pointer capture and independent pointer IDs allow a body modifier and strike button to be held together.

All ten gameplay actions are remappable. Open **Edit all 10 buttons**, choose a new action for a slot, and any conflicting action swaps into the previous slot. This keeps exactly one reachable button per combat action. The pause button remains fixed outside the remappable layout.

The **Button Position** editor represents the complete gameplay surface. Drag a labeled control to any convenient location, or focus it and use the arrow keys for precise movement. Positions are stored as bounded normalized coordinates, so a layout preserves its proportions across phones and tablets with different resolutions. Reset Positions restores the ergonomic default, including the Body Modifier on the left half of the screen.

Touch controls are regular lightweight HTML buttons layered over the Canvas. They do not increase the Canvas resolution, add draw calls to the arena, change the 60 Hz simulation, or alter online packets. Opacity and scale are presentation-only preferences.

## Online behavior

Online input continues to contain only normalized combat actions. Keyboard and touch transitions are sent immediately. Gamepads are polled once per animation frame and enter the existing 60 Hz input stream. The Node server remains the only combat authority; clients do not send damage, health, stamina, hit results, or match outcomes.

## Maintenance contract

- Add new device support inside `input-manager.js`, not inside fighter simulation code.
- Keep device mappings out of `online-simulation.cjs`; the server accepts normalized actions only.
- Preserve edge-triggered strike inputs and held guard/modifier inputs.
- Update `tests/input-manager.cjs` whenever an input preference or device mapping changes.
- Keep gamepad chord actions derived from normalized direct actions so custom High Guard and Body Modifier mappings remain compatible.
- Keep active-method detection based on meaningful mapped input, not passive controller connection.
- Preserve contextual Settings behavior: menu access opens General; paused local access opens the active device map.
- Keep touch UI under `#game-viewport` so it shares the same responsive 16:9 coordinate surface as every other combat overlay.
- Store touch placement as normalized bounded coordinates rather than device pixels.

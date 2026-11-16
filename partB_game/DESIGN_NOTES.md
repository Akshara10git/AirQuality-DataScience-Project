# Design and implementation notes (Part B)

## Design intent
A learner should *discover* a data-science idea by hitting it, then get a name for it. Each sector is built around one trap (overfitting, rare failures, leakage). The score is computed from real predictions, so the trap costs points before it is explained.

## Visual and interaction design (original to this project)
- **Night-shift control room.** Dark navy plant, cyan for data and controls, amber for decisions and warnings, mint for success, red for failure. Panels have chamfered corners, readouts are monospace. No emoji in the interface.
- **A plant that maps onto the ML workflow.** Training data is a terraced *rack* of cartridges at the back, validation is a *bench* of pods at the front, and the test set is a *ring* of machines around a radar hub. You can see the three splits as places.
- **Machines encode their own data.** Rotor speed follows rpm, the wear column's height and colour follow tool wear, the vent glow follows the process-air temperature gap, the grade stripe follows product type. The ring lamp shows the model's risk.
- **A survey drone** does the work (fetching logs, servicing machines), so the cost of a log and the limit on the crew are visible as flight time.
- **LED-strip dials** for k and the alarm threshold; switch panel for features; a three-tab drawer on phones.
- **Printed shift report** with a confusion matrix, and a **field-manual card with a small diagram** for each concept (train/validation/test, overfitting, underfitting, imbalance, threshold, feature engineering, leakage).
- **Learning aids that avoid spoilers:** the leaky feature (repair ticket) looks like any other switch; the game only reacts when validation looks too good and explains it in the report.

## Code structure (`src/`)
| File | Role |
|---|---|
| `data.js` | 1,239 real rows from the dataset (built by `game_data/build_game_data.py`) |
| `logic.js` | Pure rules, no DOM or 3D: feature definitions, k-NN risk, confusion metrics, shift economics, level config, sampling. Runs in the browser and in Node. |
| `scene.js` | Three.js world: lights, floor, hub, part builders (machine, cartridge, pod), drone, particles, orbit camera |
| `game.js` | State, console and dispatch UI, teaching loop, concept cards, shift report, pointer handling |
| `ui.css`, `index.template.html` | Interface |
| `vendor/three.min.js` | three.js r128 (MIT), inlined so the game works offline |

`python build.py` inlines everything into `MachineWhisperer3D.html` (about 710 KB).

## Testing done
- Difficulty calibrated by simulating 300 random seeds per sector against `logic.js` (see report, Section 7).
- The seeded random generator was restructured once; outputs were checked identical over 160,000 draws.
- Automated playthrough in headless Chrome: all three sectors, k sweeps, repeated shifts, new batches, all concept cards, report, help and end screens: no script errors.
- Layouts checked at 1280x760 (desktop) and 390x800 (phone).
- **Not tested:** a real GPU or a physical phone, and real players. See `PLAYTEST_EVIDENCE.md`.

## Known limitations
- The dataset is synthetic, so the failure rules are clean; real plants are messier.
- Validation sets are small (20-25 machines), so one failure moves the score noticeably. This is deliberate friction, and "keep tweaking" re-rolls the live floor.
- Failures are over-represented (about 20-40% instead of 3.4%) to keep the game playable.

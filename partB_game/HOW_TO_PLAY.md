# Machine Whisperer 3D: how to play

Open `MachineWhisperer3D.html` in any modern browser (Chrome, Edge, Firefox, Safari; phone or laptop). It is one file and works offline. Drag to orbit the camera, pinch or scroll to zoom. Sound can be muted with the speaker icon.

**Your job:** you run the night shift of a plant. Decide which machines on the live floor get serviced before they break. You do this by building a small prediction model from real maintenance records.

## The plant
| Where | What it is |
|---|---|
| **Ring in the middle** | The *live floor*: 20 machines around a radar hub. This is the future you are trying to predict (the **test set**). A glowing ring on each machine shows its predicted risk (mint = safe, amber = watch, red = danger). |
| **Terraced rack at the back** | The *archive*: 40 data cartridges. Each is a past machine whose outcome is hidden until you pull its log (the **training data**). |
| **Row of small pods at the front** | The *test bench*: machines held back for tuning (the **validation set**). Their outcome is only used when you press VALIDATE. |
| **The drone** | Your survey drone. It flies to whatever you ask it to fetch or service. |

## The loop (the DISPATCH panel walks you through it)
1. **Data.** Tap a cartridge on the rack, or press **FETCH 5 RANDOM LOGS**. The drone reads the log: a mint strip means the machine ran fine, a red strip means it failed. Tokens are limited (top bar), so choose carefully. These logs are your **training set**.
2. **Validate.** Press **VALIDATE**. The model predicts the bench pods, which it has never seen, so the score is honest. The TRAIN score is flattering because the model already knows those machines.
3. **Tune** (MODEL panel), then validate again:
   - **Neighbours that vote (k):** 1 copies the closest machine, 15 averages a blurry crowd.
   - **Alarm threshold** (sectors 2-3): flag a machine if its risk is at least this high.
   - **Model looks at** (sector 3): switch features on or off. Amber ones are engineered from the physics.
4. **Deploy.** Press **DEPLOY SHIFT**. The drone services the flagged machines (limited crew), then the real outcomes appear. Score: 0 = doing nothing, 100 = a perfect crew. Rank pips are earned at 45 / 65 / 80.
5. **Review.** The **shift report** compares what validation promised with what the live floor delivered. "Keep tweaking" rolls in a **fresh batch** of live machines, so you cannot memorise the answers.

Tap any machine, pod or cartridge to read its sensors in the READOUT panel. For a live machine or pod, glowing lines show the logged machines the model is copying (red = failed, green = fine).

On a phone the console is a drawer with three tabs (DATA, MODEL, DEPLOY); a small amber marker shows which tab the dispatch wants you to open. Tap the dispatch text to expand or collapse its explanation.

## Sectors
| Sector | Name | Goal |
|---|---|---|
| 1 | Overfit Alley | Find the k that generalises. Watch the train-validation gap. |
| 2 | Cry-Wolf Corner | Rare failures, 5-machine crew. Choose an alarm threshold. Accuracy will fool you. |
| 3 | Signal Hall | Pick features. Engineer from the physics. Spot the feature that cheats. |

## Tips
- Spread your log picks; a random batch is a sampling strategy too.
- The book icon (top right) opens the field manual with a "which idea, when?" table. **COPY SESSION SUMMARY** (in the manual and on the shift report) exports your attempts for the playtest form.
- The real data is the UCI AI4I 2020 milling dataset; failures are over-represented so the game is playable (really only 3.4% of cycles fail).

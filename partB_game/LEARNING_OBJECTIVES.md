# Learning objectives and how the game teaches them

By the end of the game a player can:

| # | Objective | Where | The discovery (not a quiz) |
|---|---|---|---|
| 1 | Explain why data is split into **train, validation and test** sets | All sectors; unlocked on first VALIDATE | The TRAIN bar is always flattering. Only the unseen bench and the live floor show the truth, and the shift report compares "validation promised" vs "live delivered". |
| 2 | Spot **overfitting and underfitting**; describe the bias-variance trade-off | Sector 1 | k = 1 gives ~100% train but clearly lower validation (gap flagged "memorising"); k = 15 collapses both. The best k sits in between. |
| 3 | Explain why **accuracy misleads on rare failures**; choose an alarm threshold using **precision and recall** | Sector 2 | A tick on the validation bar shows the "never alarm" accuracy (~80%). Lowering the alarm threshold barely moves accuracy but lifts recall; too low and the limited crew wastes visits. |
| 4 | Build **features** from domain physics and reject **leaky** ones | Sector 3 | Power, heat gap and wear x torque raise the score. The repair ticket (TKT) gives ~100% validation but 0 on the live floor, because it exists only after a failure. |

Each idea appears as a field-manual card (with a small diagram) only after the player has experienced it, with a plain-language definition and a "use it when" rule. The end screen and the field manual (book icon) list all seven ideas with the situation each answers:
overfitting, underfitting / bias-variance, train-validation-test split, class imbalance, precision vs recall / threshold, feature engineering and selection, data leakage.

## Computation behind the game (no hard-coded answers)
- Every machine is a real row (type, air and process temperature, speed, torque, tool wear, outcome, failure mode) from `data/ai4i2020.csv`, embedded by `game_data/build_game_data.py`.
- The model is a real k-nearest-neighbour classifier on min-max scaled features, recomputed on every dial change (`src/logic.js`).
- Levels sample different failure-mode mixes from the real data; live machines are re-sampled every shift.
- Difficulty was calibrated by simulating 300 random seeds per level (results in the report, Section 7).

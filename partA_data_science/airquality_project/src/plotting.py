"""All figures. One function per figure; each saves a PNG into outputs/figures and returns its path.

Style rules: thin marks, quiet grid, text in ink colours (never in series colours),
a legend whenever there are >= 2 series, categorical colours used in a fixed order.
"""
import matplotlib
matplotlib.use("Agg")                      # no display needed -> works on any machine / server
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap

from . import config as C

# ---- palette (validated default: blue, orange, aqua in this order) ----
BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
INK, INK2, MUTED, GRID, SURFACE = "#0b0b0b", "#52514e", "#6b6a66", "#e6e5e1", "#fcfcfb"
SEQ = LinearSegmentedColormap.from_list("seq_blue", ["#cde2fb", "#3987e5", "#0d366b"])
DIV = LinearSegmentedColormap.from_list("div_blue_orange", [BLUE, "#e9e8e4", ORANGE])

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "axes.edgecolor": GRID, "axes.labelcolor": INK2, "axes.titlecolor": INK,
    "xtick.color": MUTED, "ytick.color": MUTED, "text.color": INK,
    "axes.grid": True, "axes.axisbelow": True, "grid.color": GRID, "grid.linewidth": 0.6,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.titlesize": 11, "axes.titleweight": "bold", "axes.titlelocation": "left",
    "axes.labelsize": 9, "xtick.labelsize": 8, "ytick.labelsize": 8,
    "legend.frameon": False, "legend.fontsize": 8, "font.family": "DejaVu Sans",
    "lines.linewidth": 1.6,
})
CO_LABEL = "CO reference (mg/m³)"


def _save(fig, name):
    C.FIG_DIR.mkdir(parents=True, exist_ok=True)
    path = C.FIG_DIR / name
    fig.savefig(path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    return path


# ============================ EDA figures ============================
def eda_missingness(missing_tbl, df_nan):
    """Left: % missing per column. Right: share of hours missing per month."""
    fig, ax = plt.subplots(1, 2, figsize=(11, 4.2), gridspec_kw={"width_ratios": [1, 1.2]})
    m = missing_tbl["pct_missing"].sort_values()
    ax[0].barh(m.index, m.values, color=BLUE, height=0.55)
    ax[0].set_xlabel("% of hourly rows tagged -200 (missing)")
    ax[0].set_title("Missingness by column (full raw dataset)")
    for y, v in enumerate(m.values):
        ax[0].text(v + 1, y, f"{v:.1f}%", va="center", fontsize=8, color=INK2)
    ax[0].set_xlim(0, 105); ax[0].grid(axis="y", visible=False)

    month = df_nan["datetime"].dt.to_period("M").dt.to_timestamp()
    tgt = df_nan[C.TARGET].isna().groupby(month).mean() * 100
    out = df_nan[C.BASE_FEATURES].isna().any(axis=1).groupby(month).mean() * 100
    ax[1].plot(tgt.index, tgt.values, color=BLUE, marker="o", ms=4, label="Target CO(GT) missing")
    ax[1].plot(out.index, out.values, color=ORANGE, marker="s", ms=4, label="Sensor/weather inputs missing (outage)")
    ax[1].set_ylabel("% of hours in the month"); ax[1].set_title("Missingness over time")
    ax[1].legend(loc="upper right")
    ax[1].set_ylim(0, 55)
    fig.autofmt_xdate()
    return _save(fig, "eda_01_missingness.png")


def eda_target_distribution(dev):
    fig, ax = plt.subplots(1, 2, figsize=(10, 3.8))
    ax[0].hist(dev[C.TARGET], bins=40, color=BLUE, edgecolor=SURFACE, linewidth=1)
    ax[0].axvline(dev[C.TARGET].mean(), color=ORANGE, lw=1.4)
    ax[0].axvline(dev[C.TARGET].median(), color=AQUA, lw=1.4)
    ax[0].set_xlabel(CO_LABEL); ax[0].set_ylabel("hours"); ax[0].set_title("CO is right-skewed")
    ymax = ax[0].get_ylim()[1]
    ax[0].text(dev[C.TARGET].mean() + 0.1, ymax * 0.92, f"mean {dev[C.TARGET].mean():.2f}", color=INK2, fontsize=8)
    ax[0].text(dev[C.TARGET].median() - 0.1, ymax * 0.80, f"median {dev[C.TARGET].median():.2f}", color=INK2, fontsize=8, ha="right")
    ax[1].hist(np.log1p(dev[C.TARGET]), bins=40, color=BLUE, edgecolor=SURFACE, linewidth=1)
    ax[1].set_xlabel("log(1 + CO)"); ax[1].set_title("After the log transform")
    return _save(fig, "eda_02_target_distribution.png")


def eda_hourly_pattern(dev):
    d = dev.copy()
    d["hour"] = d["datetime"].dt.hour
    d["day_type"] = np.where(d["datetime"].dt.dayofweek >= 5, "Weekend", "Weekday")
    fig, ax = plt.subplots(figsize=(7.5, 4))
    for label, colour in (("Weekday", BLUE), ("Weekend", ORANGE)):
        g = d[d["day_type"] == label].groupby("hour")[C.TARGET]
        med, q1, q3 = g.median(), g.quantile(0.25), g.quantile(0.75)
        ax.fill_between(med.index, q1, q3, color=colour, alpha=0.15, lw=0)
        ax.plot(med.index, med.values, color=colour, label=f"{label} (median, band = IQR)")
    ax.set_xlabel("hour of day"); ax.set_ylabel(CO_LABEL); ax.set_xticks(range(0, 24, 3))
    ax.set_title("CO follows the daily traffic rhythm"); ax.legend(loc="upper left")
    return _save(fig, "eda_03_hourly_pattern.png")


def eda_correlation(dev):
    cols = [C.TARGET] + C.BASE_FEATURES
    corr = dev[cols].corr(method="spearman")
    fig, ax = plt.subplots(figsize=(7.2, 6))
    im = ax.imshow(corr.values, cmap=DIV, vmin=-1, vmax=1)
    ax.set_xticks(range(len(cols))); ax.set_xticklabels(cols, rotation=45, ha="right")
    ax.set_yticks(range(len(cols))); ax.set_yticklabels(cols); ax.grid(False)
    for i in range(len(cols)):
        for j in range(len(cols)):
            v = corr.values[i, j]
            ax.text(j, i, f"{v:.2f}", ha="center", va="center", fontsize=7.5,
                    color="white" if abs(v) > 0.7 else INK)
    fig.colorbar(im, ax=ax, shrink=0.8, label="Spearman ρ")
    ax.set_title("Spearman correlation (development data)")
    return _save(fig, "eda_04_correlation.png")


def eda_sensor_vs_target(train, val, simple_fit):
    b0, b1 = simple_fit
    fig, ax = plt.subplots(figsize=(7.2, 4.8))
    ax.scatter(train["PT08.S1(CO)"], train[C.TARGET], s=6, color=BLUE, alpha=0.35, lw=0, label="Train period")
    ax.scatter(val["PT08.S1(CO)"], val[C.TARGET], s=6, color=ORANGE, alpha=0.45, lw=0, label="Validation period")
    xs = np.linspace(train["PT08.S1(CO)"].min(), train["PT08.S1(CO)"].max(), 50)
    ax.plot(xs, b0 + b1 * xs, color=INK, lw=1.4, label=f"Least-squares line (train): CO = {b0:.2f} + {b1:.4f}·S1")
    ax.set_xlabel("PT08.S1(CO) sensor response"); ax.set_ylabel(CO_LABEL)
    ax.set_title("Sensor response vs reference CO"); ax.legend(loc="upper left", markerscale=3)
    return _save(fig, "eda_05_sensor_vs_target.png")


def eda_monthly_trend(df_nan):
    m = df_nan.set_index("datetime")[[C.TARGET, "PT08.S1(CO)"]].resample("MS").mean()
    fig, ax = plt.subplots(2, 1, figsize=(8, 5), sharex=True)
    ax[0].plot(m.index, m[C.TARGET], color=BLUE, marker="o", ms=4)
    ax[0].set_ylabel("mean CO (mg/m³)"); ax[0].set_title("Monthly mean: reference CO (all hours, descriptive only)")
    ax[1].plot(m.index, m["PT08.S1(CO)"], color=ORANGE, marker="o", ms=4)
    ax[1].set_ylabel("mean sensor S1"); ax[1].set_title("Monthly mean: PT08.S1(CO) sensor response (all hours, descriptive only)")
    fig.autofmt_xdate(); fig.tight_layout()
    return _save(fig, "eda_06_monthly_trend.png")


def eda_outliers(dev):
    cols = [C.TARGET] + C.BASE_FEATURES
    z = (dev[cols] - dev[cols].mean()) / dev[cols].std()
    fig, ax = plt.subplots(figsize=(7.5, 4.5))
    bp = ax.boxplot([z[c] for c in cols], vert=False, tick_labels=cols, patch_artist=True,
                    flierprops=dict(marker="o", ms=2.5, mfc=ORANGE, mec="none", alpha=0.5),
                    medianprops=dict(color=INK), whiskerprops=dict(color=MUTED), capprops=dict(color=MUTED))
    for box in bp["boxes"]:
        box.set(facecolor="#cde2fb", edgecolor=BLUE)
    ax.set_xlabel("standardised value (z-score)"); ax.set_title("Boxplots: outliers per variable")
    ax.grid(axis="y", visible=False)
    return _save(fig, "eda_07_outliers.png")


def eda_benzene_validity(s2, benzene, quad):
    xs = np.linspace(s2.min(), s2.max(), 200)
    fig, ax = plt.subplots(figsize=(6.5, 4.4))
    ax.scatter(s2, benzene, s=5, color=BLUE, alpha=0.4, lw=0, label="hourly observations")
    ax.plot(xs, np.polyval(quad["coef"], xs), color=ORANGE, lw=1.4,
            label=f"quadratic fit, R² = {quad['r2']:.4f}")
    ax.set_xlabel("PT08.S2(NMHC) sensor response"); ax.set_ylabel("C6H6(GT) benzene (µg/m³)")
    ax.set_title("Benzene 'reference' is almost a function of one sensor\n(all rows, descriptive check - not used for modelling)", fontsize=10); ax.legend(loc="upper left")
    return _save(fig, "eda_08_benzene_validity.png")


# ============================ result figures ============================
def res_model_comparison(table):
    """table: index = model, columns include RMSE_val and RMSE_test."""
    names = list(table.index)
    y = np.arange(len(names))
    fig, ax = plt.subplots(figsize=(8.5, 4.4))
    ax.barh(y - 0.19, table["RMSE_val"], height=0.34, color=BLUE, label="Validation")
    ax.barh(y + 0.19, table["RMSE_test"], height=0.34, color=ORANGE, label="Test (final, once)")
    ax.set_yticks(y); ax.set_yticklabels(names); ax.invert_yaxis()
    for i, (v, t) in enumerate(zip(table["RMSE_val"], table["RMSE_test"])):
        ax.text(v + 0.01, i - 0.19, f"{v:.3f}", va="center", fontsize=7.5, color=INK2)
        ax.text(t + 0.01, i + 0.19, f"{t:.3f}", va="center", fontsize=7.5, color=INK2)
    ax.set_xlabel("RMSE (mg/m³) - lower is better"); ax.set_title("Model comparison")
    ax.legend(loc="lower right"); ax.grid(axis="y", visible=False)
    return _save(fig, "res_01_model_comparison.png")


def res_pred_vs_actual(test, panels):
    """panels: list of (title, prediction column, colour)."""
    fig, ax = plt.subplots(1, len(panels), figsize=(5 * len(panels), 4.6), sharex=True, sharey=True)
    ax = np.atleast_1d(ax)
    lim = [0, max(test[C.TARGET].max(), *(test[p].max() for _, p, _ in panels)) * 1.03]
    for a, (title, col, colour) in zip(ax, panels):
        a.scatter(test[C.TARGET], test[col], s=6, color=colour, alpha=0.4, lw=0)
        a.plot(lim, lim, color=INK, lw=1, ls="--")
        a.set_xlim(lim); a.set_ylim(lim); a.set_title(title)
        a.set_xlabel("actual " + CO_LABEL)
    ax[0].set_ylabel("predicted CO (mg/m³)")
    return _save(fig, "res_02_pred_vs_actual.png")


def res_residuals_time(test, err_col, label):
    d = test.set_index("datetime")
    daily = d[err_col].resample("D").mean()
    fig, ax = plt.subplots(figsize=(9.5, 4))
    ax.scatter(d.index, d[err_col], s=4, color=MUTED, alpha=0.35, lw=0, label="hourly error")
    ax.plot(daily.index, daily.values, color=BLUE, lw=1.6, label="daily mean error")
    ax.axhline(0, color=INK, lw=1)
    ax.set_ylabel("prediction − actual (mg/m³)"); ax.set_title(f"Test-period errors over time: {label}")
    ax.legend(loc="upper left"); fig.autofmt_xdate()
    return _save(fig, "res_03_residuals_time.png")


def res_error_breakdown(breakdown, label):
    fig, ax = plt.subplots(1, 3, figsize=(11.5, 3.8), sharey=True)
    titles = {"hour_block": "by hour of day", "co_level": "by CO level (quartile)", "rh_level": "by relative humidity"}
    for a, key in zip(ax, ["hour_block", "co_level", "rh_level"]):
        g = breakdown[key]
        a.bar(g[key], g["MAE"], color=BLUE, width=0.55)
        for x, v in zip(g[key], g["MAE"]):
            a.text(x, v + 0.01, f"{v:.2f}", ha="center", fontsize=8, color=INK2)
        a.set_title(titles[key]); a.tick_params(axis="x", labelrotation=20); a.grid(axis="x", visible=False)
    ax[0].set_ylabel("test MAE (mg/m³)")
    fig.suptitle(f"Where the errors are: {label}", x=0.01, ha="left", fontsize=11, fontweight="bold")
    fig.tight_layout()
    return _save(fig, "res_04_error_breakdown.png")


def res_drift_monthly(drift):
    x = pd.to_datetime(drift["month"]).dt.to_period("M").astype(str)
    fig, ax = plt.subplots(1, 2, figsize=(11, 4))
    ax[0].plot(x, drift["MAE_baseline"], color=ORANGE, marker="s", ms=4, label="Baseline (mean)")
    ax[0].plot(x, drift["MAE_model"], color=BLUE, marker="o", ms=4, label="Multiple linear + time features")
    ax[0].set_ylabel("MAE in that month (mg/m³)"); ax[0].set_title("Error by month (expanding training window)")
    ax[0].legend(loc="center right"); ax[0].tick_params(axis="x", labelrotation=45)
    ax[1].plot(x, drift["R2_model"], color=BLUE, marker="o", ms=4)
    ax[1].axhline(0, color=INK, lw=1)
    ax[1].set_ylabel("R² in that month"); ax[1].set_title("R² by month"); ax[1].tick_params(axis="x", labelrotation=45)
    fig.tight_layout()
    return _save(fig, "res_05_drift_monthly.png")


def res_cv_heatmap(grid_df):
    piv = grid_df.pivot(index="degree", columns="alpha", values="cv_rmse")
    fig, ax = plt.subplots(figsize=(6.5, 3.2))
    im = ax.imshow(piv.values, cmap=SEQ, aspect="auto"); ax.grid(False)
    ax.set_xticks(range(piv.shape[1])); ax.set_xticklabels([f"{a:g}" for a in piv.columns])
    ax.set_yticks(range(piv.shape[0])); ax.set_yticklabels([f"degree {d}" for d in piv.index])
    ax.set_xlabel("Ridge alpha (penalty strength)")
    for i in range(piv.shape[0]):
        for j in range(piv.shape[1]):
            v = piv.values[i, j]
            ax.text(j, i, f"{v:.3f}", ha="center", va="center", fontsize=7.5,
                    color="white" if v > np.nanmean(piv.values) else INK)
    fig.colorbar(im, ax=ax, label="CV RMSE (mg/m³)"); ax.set_title("Tuning grid (time-series CV on training data)")
    return _save(fig, "res_06_cv_grid.png")

"""Run the whole project end to end:  python -m src.run_pipeline

Steps: load -> audit -> clean -> chronological split -> EDA figures -> fit/validate models
-> tune with time-series CV -> final test evaluation (once) -> error analysis -> diagnostics
-> save tables, figures and results.json.
"""
import argparse
import json
import platform
import time

import numpy as np
import pandas as pd
import scipy
import sklearn
from sklearn.base import clone
from sklearn.model_selection import cross_val_score

from . import config as C
from . import data, evaluate, features, models, plotting


def _json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    if isinstance(o, (pd.Timestamp, pd.Period)):
        return str(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(f"not serialisable: {type(o)}")


def iqr_outlier_counts(dev, cols):
    rows = []
    for c in cols:
        q1, q3 = dev[c].quantile([0.25, 0.75])
        lo, hi = q1 - 1.5 * (q3 - q1), q3 + 1.5 * (q3 - q1)
        n_out = int(((dev[c] < lo) | (dev[c] > hi)).sum())
        rows.append({"variable": c, "n_outliers_IQR": n_out, "pct": round(100 * n_out / len(dev), 2),
                     "min": float(dev[c].min()), "max": float(dev[c].max())})
    return pd.DataFrame(rows)


def main(make_figures=True):
    t0 = time.time()
    np.random.seed(C.SEED)
    for d in (C.PROCESSED_DIR, C.FIG_DIR, C.TABLE_DIR):
        d.mkdir(parents=True, exist_ok=True)
    R = {"seed": C.SEED}

    # ---------------- 1. load + audit ----------------
    df_coded, load_info = data.load_raw()
    missing_tbl, audit_rep, _ = data.audit(df_coded)
    missing_tbl.to_csv(C.TABLE_DIR / "01_missing_by_column.csv")
    R["load"], R["audit"] = load_info, audit_rep
    R["missing_by_column"] = missing_tbl.reset_index().rename(columns={"index": "column"}).to_dict("records")

    # ---------------- 2. clean + model table ----------------
    table, drop_counts, df_nan = data.build_model_table(df_coded)
    table = features.add_time_features(table)
    table.to_csv(C.PROCESSED_DIR / "model_table.csv", index=False)
    R["cleaning"] = drop_counts

    # validity check of the benzene "ground truth" (why it is NOT used as the target)
    bz = df_nan[["PT08.S2(NMHC)", "C6H6(GT)"]].dropna()
    coef = np.polyfit(bz["PT08.S2(NMHC)"], bz["C6H6(GT)"], 2)
    resid = bz["C6H6(GT)"] - np.polyval(coef, bz["PT08.S2(NMHC)"])
    r2_quad = 1 - (resid ** 2).sum() / ((bz["C6H6(GT)"] - bz["C6H6(GT)"].mean()) ** 2).sum()
    spread = bz.groupby("PT08.S2(NMHC)")["C6H6(GT)"].agg(lambda s: s.max() - s.min()).max()
    lin = np.polyfit(bz["PT08.S2(NMHC)"], bz["C6H6(GT)"], 1)
    r2_lin = 1 - ((bz["C6H6(GT)"] - np.polyval(lin, bz["PT08.S2(NMHC)"])) ** 2).sum() / ((bz["C6H6(GT)"] - bz["C6H6(GT)"].mean()) ** 2).sum()
    R["benzene_check"] = {"n": len(bz), "r2_linear": float(r2_lin), "r2_quadratic": float(r2_quad),
                          "rmse_quadratic": float(np.sqrt((resid ** 2).mean())),
                          "max_benzene_spread_within_one_S2_value": float(spread),
                          "spearman": float(bz.corr(method="spearman").iloc[0, 1])}

    # ---------------- 3. chronological split ----------------
    train, val, test = data.split_chronological(table)
    dev = pd.concat([train, val])
    R["split"] = {name: {"rows": len(part), "start": str(part["datetime"].min()),
                         "end": str(part["datetime"].max())}
                  for name, part in (("train", train), ("validation", val), ("test", test))}

    # ---------------- 4. EDA (development data only) ----------------
    out_tbl = iqr_outlier_counts(dev, [C.TARGET] + C.BASE_FEATURES)
    out_tbl.to_csv(C.TABLE_DIR / "02_outlier_counts_IQR.csv", index=False)
    desc = dev[[C.TARGET] + C.BASE_FEATURES].describe().T
    desc["skew"] = dev[[C.TARGET] + C.BASE_FEATURES].skew()
    desc.round(3).to_csv(C.TABLE_DIR / "03_descriptive_statistics_dev.csv")
    R["target_stats_dev"] = {"mean": float(dev[C.TARGET].mean()), "median": float(dev[C.TARGET].median()),
                             "sd": float(dev[C.TARGET].std()), "skew": float(dev[C.TARGET].skew()),
                             "skew_log1p": float(np.log1p(dev[C.TARGET]).skew())}
    spear = dev[[C.TARGET] + C.BASE_FEATURES].corr(method="spearman")[C.TARGET].drop(C.TARGET)
    R["spearman_with_target_dev"] = spear.round(3).to_dict()
    hourly = dev.assign(h=dev["datetime"].dt.hour, we=dev["datetime"].dt.dayofweek >= 5)
    R["hourly_pattern"] = {"weekday_peak_hour": int(hourly[~hourly.we].groupby("h")[C.TARGET].median().idxmax()),
                           "weekday_peak_median": float(hourly[~hourly.we].groupby("h")[C.TARGET].median().max()),
                           "weekend_mean": float(hourly[hourly.we][C.TARGET].mean()),
                           "weekday_mean": float(hourly[~hourly.we][C.TARGET].mean())}
    hourly_tbl = (hourly.assign(day_type=np.where(hourly.we, "weekend", "weekday"))
                  .pivot_table(index="h", columns="day_type", values=C.TARGET, aggfunc="median"))
    hourly_tbl.round(3).to_csv(C.TABLE_DIR / "11_hourly_median_CO_dev.csv")
    R["hourly_medians"] = hourly_tbl.round(3).reset_index().to_dict("records")
    monthly_means = df_nan.set_index("datetime")[[C.TARGET, "PT08.S1(CO)"]].resample("MS").mean()
    monthly_means.index = monthly_means.index.strftime("%Y-%m")
    monthly_means.round(3).to_csv(C.TABLE_DIR / "12_monthly_means_all_hours.csv")
    R["monthly_means_all_hours"] = monthly_means.round(3).reset_index().rename(columns={"datetime": "month"}).to_dict("records")
    R["pearson_S1_CO_dev"] = float(dev[["PT08.S1(CO)", C.TARGET]].corr().iloc[0, 1])
    b1, b0 = np.polyfit(train["PT08.S1(CO)"], train[C.TARGET], 1)
    if make_figures:
        plotting.eda_missingness(missing_tbl, df_nan)
        plotting.eda_target_distribution(dev)
        plotting.eda_hourly_pattern(dev)
        plotting.eda_correlation(dev)
        plotting.eda_sensor_vs_target(train, val, (b0, b1))
        plotting.eda_monthly_trend(df_nan)
        plotting.eda_outliers(dev)
        plotting.eda_benzene_validity(bz["PT08.S2(NMHC)"], bz["C6H6(GT)"], {"coef": coef, "r2": r2_quad})

    # ---------------- 5. fit on TRAIN, compare on VALIDATION ----------------
    specs = models.build_models()
    unfitted = {k: clone(v[0]) for k, v in specs.items()}
    fitted, rows, val_pred = {}, [], {}
    for name, (est, feats, status) in specs.items():
        est = clone(est)
        if name.startswith("M5"):
            est.fit(train[feats], train[C.TARGET])
            cv_rmse = float(-est.best_score_)
        else:
            scores = cross_val_score(clone(est), train[feats], train[C.TARGET], cv=models.time_cv(),
                                     scoring="neg_root_mean_squared_error")
            cv_rmse = float(-scores.mean())
            est.fit(train[feats], train[C.TARGET])
        fitted[name] = est
        p_tr, p_val = est.predict(train[feats]), est.predict(val[feats])
        val_pred[name] = p_val
        m_tr, m_val = evaluate.regression_metrics(train[C.TARGET], p_tr), evaluate.regression_metrics(val[C.TARGET], p_val)
        rows.append({"model": name, "status": status, "n_features": len(feats), "CV_RMSE_train": cv_rmse,
                     **{f"{k}_train": v for k, v in m_tr.items()}, **{f"{k}_val": v for k, v in m_val.items()}})
    comp = pd.DataFrame(rows).set_index("model")

    # tuned model details
    gs = fitted["M5 Polynomial + Ridge (tuned)"]
    grid_df = pd.DataFrame({"degree": [p["poly__degree"] for p in gs.cv_results_["params"]],
                            "alpha": [p["ridge__alpha"] for p in gs.cv_results_["params"]],
                            "cv_rmse": -gs.cv_results_["mean_test_score"],
                            "cv_rmse_sd": gs.cv_results_["std_test_score"]}).sort_values("cv_rmse")
    grid_df.to_csv(C.TABLE_DIR / "05_tuning_grid.csv", index=False)
    R["tuning"] = {"best_params": gs.best_params_, "best_cv_rmse": float(-gs.best_score_),
                   "n_configurations": len(grid_df), "cv_splits": C.CV_SPLITS, "cv_gap_retained_rows": C.CV_GAP_HOURS}

    # ---------------- 6. FINAL test evaluation (once): refit on train+val ----------------
    test_pred = test[["datetime", C.TARGET] + C.BASE_FEATURES].copy()
    for name, (est, feats, status) in specs.items():
        if name.startswith("M5"):
            final = clone(gs.best_estimator_)          # keep the tuned settings, no re-tuning
        else:
            final = clone(unfitted[name])
        final.fit(dev[feats], dev[C.TARGET])
        pred = final.predict(test[feats])
        test_pred[name] = pred
        for k, v in evaluate.regression_metrics(test[C.TARGET], pred).items():
            comp.loc[name, f"{k}_test"] = v
        fitted[name + "|final"] = final
    comp.round(4).to_csv(C.TABLE_DIR / "04_model_comparison.csv")
    R["model_comparison"] = comp.reset_index().to_dict("records")

    candidates = comp.drop(index="Baseline: training mean")
    best = candidates["RMSE_val"].idxmin()             # chosen on VALIDATION only
    R["best_model_by_validation"] = best

    # coefficients (final models, fitted on train+val)
    m1 = fitted["M1 Simple linear (S1 only)|final"].named_steps["lm"]
    R["simple_regression"] = {"intercept_b0": float(m1.intercept_), "slope_b1": float(m1.coef_[0]),
                              "train_fit_b0": float(b0), "train_fit_b1": float(b1)}
    m3 = fitted["M3 Multiple linear (+time features)|final"].named_steps["lm"]
    coef_tbl = pd.DataFrame({"feature": features.ENGINEERED_FEATURES, "standardised_coef": m3.coef_}) \
        .sort_values("standardised_coef", key=abs, ascending=False)
    coef_tbl.round(4).to_csv(C.TABLE_DIR / "06_M3_standardised_coefficients.csv", index=False)
    R["M3_coefficients"] = coef_tbl.round(4).to_dict("records")

    # ---------------- 7. error analysis on the chosen model (test set) ----------------
    test_pred["pred_best"] = test_pred[best]
    test_pred["err_best"] = test_pred["pred_best"] - test_pred[C.TARGET]
    test_pred["pred_M1"] = test_pred["M1 Simple linear (S1 only)"]
    breakdown = evaluate.error_breakdown(test_pred, C.TARGET, "pred_best")
    for k, v in breakdown.items():
        v.round(4).to_csv(C.TABLE_DIR / f"07_error_by_{k}.csv", index=False)
    R["error_breakdown"] = {k: v.to_dict("records") for k, v in breakdown.items()}
    R["bias_test"] = evaluate.bias_inference(test_pred["err_best"])
    worst = test_pred.assign(abs_err=test_pred["err_best"].abs()).nlargest(10, "abs_err")
    worst = worst[["datetime", C.TARGET, "pred_best", "err_best", "T", "RH", "PT08.S1(CO)"]]
    num_cols = [c for c in worst.columns if c != "datetime"]
    worst[num_cols] = worst[num_cols].round(3)
    worst.to_csv(C.TABLE_DIR / "08_largest_test_errors.csv", index=False)
    R["largest_errors"] = worst.astype({"datetime": str}).to_dict("records")
    # days with the largest average error (are errors spread out or clustered in episodes?)
    daily = test_pred.assign(day=test_pred["datetime"].dt.date).groupby("day").agg(
        hours=("err_best", "size"), mean_error=("err_best", "mean"),
        mean_actual_CO=(C.TARGET, "mean"), mean_pred_CO=("pred_best", "mean"),
        mean_T=("T", "mean"), mean_RH=("RH", "mean"))
    top_days = daily.reindex(daily["mean_error"].abs().sort_values(ascending=False).index).head(6).round(3)
    top_days.to_csv(C.TABLE_DIR / "10_days_with_largest_mean_error.csv")
    R["worst_days"] = top_days.reset_index().astype({"day": str}).to_dict("records")
    abs_daily = daily["mean_error"].abs()
    R["episodes"] = {"n_days": int(len(daily)), "days_abs_mean_error_gt_0.5": int((abs_daily > 0.5).sum()),
                     "share_of_total_squared_error_from_top5_days": float(
                         (test_pred.assign(day=test_pred["datetime"].dt.date, se=test_pred["err_best"] ** 2)
                          .groupby("day")["se"].sum().nlargest(5).sum()) / (test_pred["err_best"] ** 2).sum())}
    wk = test_pred["datetime"].dt.dayofweek >= 5
    R["weekend_vs_weekday_test"] = {
        "weekend": {"hours": int(wk.sum()), "MAE": float(test_pred.loc[wk, "err_best"].abs().mean()),
                    "bias": float(test_pred.loc[wk, "err_best"].mean())},
        "weekday": {"hours": int((~wk).sum()), "MAE": float(test_pred.loc[~wk, "err_best"].abs().mean()),
                    "bias": float(test_pred.loc[~wk, "err_best"].mean())}}
    big = test_pred[C.TARGET] >= dev[C.TARGET].quantile(0.9)     # "high CO" = top decile of development data
    R["high_co_test"] = {"threshold_dev_p90": float(dev[C.TARGET].quantile(0.9)), "n": int(big.sum()),
                         "MAE": float(test_pred.loc[big, "err_best"].abs().mean()),
                         "bias": float(test_pred.loc[big, "err_best"].mean())}
    R["test_target_stats"] = {"mean": float(test[C.TARGET].mean()), "dev_mean": float(dev[C.TARGET].mean()),
                              "sensor_S1_mean_test": float(test["PT08.S1(CO)"].mean()),
                              "sensor_S1_mean_dev": float(dev["PT08.S1(CO)"].mean())}

    # ---------------- 8. diagnostics: drift by month, random vs chronological ----------------
    est_m3 = specs["M3 Multiple linear (+time features)"]
    drift = evaluate.monthly_expanding_window(table, features.ENGINEERED_FEATURES, unfitted["M3 Multiple linear (+time features)"])
    drift.round(4).to_csv(C.TABLE_DIR / "09_monthly_drift_diagnostic.csv", index=False)
    R["drift_monthly"] = drift.round(4).to_dict("records")
    R["random_vs_chronological_M3"] = evaluate.random_vs_chronological(
        table, features.ENGINEERED_FEATURES, unfitted["M3 Multiple linear (+time features)"])

    # ---------------- 9. result figures ----------------
    if make_figures:
        short = {n: n for n in comp.index}
        plotting.res_model_comparison(comp[["RMSE_val", "RMSE_test"]].rename(index=short))
        plotting.res_pred_vs_actual(test_pred, [("M1 Simple linear", "pred_M1", plotting.BLUE),
                                                (best, "pred_best", plotting.BLUE)])
        plotting.res_residuals_time(test_pred, "err_best", best)
        plotting.res_error_breakdown(breakdown, best)
        plotting.res_drift_monthly(drift)
        plotting.res_cv_heatmap(grid_df)

    R["environment"] = {"python": platform.python_version(), "pandas": pd.__version__, "numpy": np.__version__,
                        "scikit-learn": sklearn.__version__, "scipy": scipy.__version__}
    R["runtime_seconds"] = round(time.time() - t0, 1)
    with open(C.RESULTS_JSON, "w") as f:
        json.dump(R, f, indent=2, default=_json_default)

    # ---------------- console summary ----------------
    pd.set_option("display.width", 200)
    print("\n=== MODEL COMPARISON (RMSE, MAE, R2) ===")
    print(comp[["CV_RMSE_train", "RMSE_train", "RMSE_val", "RMSE_test", "MAE_val", "MAE_test", "R2_val", "R2_test"]].round(3))
    print("\nBest on validation:", best, "| tuned:", gs.best_params_)
    print("Run time: %.1f s" % R["runtime_seconds"])
    return R


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--no-figures", action="store_true", help="skip drawing figures (faster)")
    args = ap.parse_args()
    main(make_figures=not args.no_figures)

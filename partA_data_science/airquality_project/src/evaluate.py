"""Metrics, error analysis and the extra diagnostic experiments."""
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.base import clone
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from . import config as C


def regression_metrics(y_true, y_pred):
    mse = mean_squared_error(y_true, y_pred)
    return {"MAE": float(mean_absolute_error(y_true, y_pred)),
            "MSE": float(mse),
            "RMSE": float(np.sqrt(mse)),
            "R2": float(r2_score(y_true, y_pred)),
            "bias": float(np.mean(np.asarray(y_pred) - np.asarray(y_true)))}


def bias_inference(errors):
    """Course-style z-test / 95 % interval for the mean error (prediction - actual).

    H0: mean error = 0 (no systematic over/under-prediction).
    Hourly errors are autocorrelated, so the plain standard error is too optimistic;
    we also report one using the effective sample size n*(1-r)/(1+r), r = lag-1 autocorrelation.
    """
    e = np.asarray(errors, dtype=float)
    n = len(e)
    mean, s = e.mean(), e.std(ddof=1)
    r1 = float(np.corrcoef(e[:-1], e[1:])[0, 1])
    n_eff = n * (1 - r1) / (1 + r1)
    out = {"n": n, "mean_error": float(mean), "sd": float(s), "lag1_autocorr": r1,
           "n_effective": float(n_eff)}
    for label, size in (("naive", n), ("adjusted", n_eff)):
        se = s / np.sqrt(size)
        z = mean / se
        out[label] = {"SE": float(se), "z": float(z),
                      "p_value_two_sided": float(2 * (1 - stats.norm.cdf(abs(z)))),
                      "CI95": [float(mean - 2 * se), float(mean + 2 * se)]}
    return out


def error_breakdown(test_df, y_col, pred_col):
    """MAE (and bias) of one set of predictions grouped three ways."""
    d = test_df.copy()
    d["abs_err"] = (d[pred_col] - d[y_col]).abs()
    d["err"] = d[pred_col] - d[y_col]
    d["hour_block"] = pd.cut(d["datetime"].dt.hour, [-1, 5, 11, 17, 23],
                             labels=["00-05", "06-11", "12-17", "18-23"])
    d["co_level"] = pd.qcut(d[y_col], 4, duplicates="drop")
    d["rh_level"] = pd.qcut(d["RH"], 3, labels=["low RH", "mid RH", "high RH"])
    out = {}
    for key in ("hour_block", "co_level", "rh_level"):
        g = d.groupby(key, observed=True).agg(n=("abs_err", "size"), MAE=("abs_err", "mean"),
                                              bias=("err", "mean"))
        out[key] = g.reset_index()
        out[key][key] = out[key][key].astype(str)
    return out


def monthly_expanding_window(table, features, estimator, target=C.TARGET):
    """Diagnostic for drift: for each month, train on ALL earlier months, test on that month.

    Uses fixed settings (no re-tuning). It is a description of how error behaves over time,
    not a model-selection step.
    """
    t = table.copy()
    t["month"] = t["datetime"].dt.to_period("M")
    rows = []
    for m in sorted(t["month"].unique()):
        train, test = t[t["month"] < m], t[t["month"] == m]
        if len(train) < C.MIN_TRAIN_ROWS_DRIFT or len(test) < C.MIN_TEST_ROWS_DRIFT:
            continue
        model = clone(estimator).fit(train[features], train[target])
        pred = model.predict(test[features])
        base = np.full(len(test), train[target].mean())
        rows.append({"month": str(m), "n_train": len(train), "n_test": len(test),
                     "MAE_model": mean_absolute_error(test[target], pred),
                     "MAE_baseline": mean_absolute_error(test[target], base),
                     "R2_model": r2_score(test[target], pred),
                     "bias_model": float(np.mean(pred - test[target]))})
    return pd.DataFrame(rows)


def random_vs_chronological(table, features, estimator, target=C.TARGET):
    """Same model, same data size: random 80/20 split vs time-ordered 80/20 split."""
    n_test = int(len(table) * (1 - C.TRAIN_FRAC - C.VAL_FRAC))
    rand_tr, rand_te = train_test_split(table, test_size=n_test, random_state=C.SEED, shuffle=True)
    chron_tr, chron_te = table.iloc[:-n_test], table.iloc[-n_test:]
    out = {}
    for name, (tr, te) in {"random_split": (rand_tr, rand_te),
                           "chronological_split": (chron_tr, chron_te)}.items():
        model = clone(estimator).fit(tr[features], tr[target])
        out[name] = regression_metrics(te[target], model.predict(te[features]))
    return out

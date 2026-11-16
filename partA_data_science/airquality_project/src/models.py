"""Model definitions. All preprocessing lives INSIDE the scikit-learn Pipelines,
so scaling is always fitted on training rows only (no leakage)."""
import numpy as np
from sklearn.compose import TransformedTargetRegressor
from sklearn.dummy import DummyRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler

from . import config as C
from .features import ENGINEERED_FEATURES


def time_cv():
    """Cross-validation that respects time: always train on the past, validate on the future."""
    return TimeSeriesSplit(n_splits=C.CV_SPLITS, gap=C.CV_GAP_HOURS)


def _linear(features_scaled=True):
    steps = [("scale", StandardScaler())] if features_scaled else []
    return Pipeline(steps + [("lm", LinearRegression())])


def poly_ridge_grid():
    pipe = Pipeline([("scale", StandardScaler()),
                     ("poly", PolynomialFeatures(include_bias=False)),
                     ("ridge", Ridge())])
    grid = {"poly__degree": C.POLY_DEGREES, "ridge__alpha": C.RIDGE_ALPHAS}
    return GridSearchCV(pipe, grid, cv=time_cv(), scoring="neg_root_mean_squared_error",
                        n_jobs=1, refit=True)


def build_models():
    """Return {name: (estimator, feature_columns, course_status)}."""
    return {
        "Baseline: training mean": (DummyRegressor(strategy="mean"), C.SIMPLE_FEATURE, "course (naive guesser)"),
        "M1 Simple linear (S1 only)": (_linear(False), C.SIMPLE_FEATURE, "course"),
        "M2 Multiple linear (8 inputs)": (_linear(), C.BASE_FEATURES, "extension of course"),
        "M3 Multiple linear (+time features)": (_linear(), ENGINEERED_FEATURES, "extension of course"),
        "M4 M3 on log(1+CO)": (TransformedTargetRegressor(regressor=_linear(), func=np.log1p,
                                                           inverse_func=np.expm1),
                               ENGINEERED_FEATURES, "course (log transform) + extension"),
        "M5 Polynomial + Ridge (tuned)": (poly_ridge_grid(), ENGINEERED_FEATURES, "additional"),
    }

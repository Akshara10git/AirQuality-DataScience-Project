# Air Quality & Data Science Project

A data science project focused on predicting carbon monoxide (CO) concentration using low-cost gas sensor measurements, accompanied by an interactive educational game demonstrating machine learning concepts.

## Project Overview

This repository contains two components developed as part of the Introduction to Data Science for Engineers project.

### Part A: Air Quality – CO Concentration Prediction

**Research Question:** Can the carbon monoxide concentration measured by a reference analyser be predicted using low-cost metal-oxide gas sensor readings and environmental variables?

This project uses the UCI Air Quality dataset, which contains hourly measurements from five gas sensors, temperature, humidity and reference air-quality measurements.

The main objectives are:
- Explore and understand the dataset through Exploratory Data Analysis (EDA).
- Handle missing values, identify outliers and prepare the data for modelling.
- Engineer meaningful time-based features.
- Develop and compare multiple regression models.
- Evaluate model performance using MAE, RMSE and R².
- Analyse prediction errors, seasonal changes and model limitations.
- Ensure reproducibility through a complete Python pipeline and automated tests.

**Models implemented:**
- Baseline (training mean)
- Simple Linear Regression
- Multiple Linear Regression
- Multiple Linear Regression with time features
- Log-transformed Regression
- Polynomial Regression with Ridge regularisation

**Best model:** Polynomial Regression with Ridge regularisation (M5).

**Test performance:**
- RMSE: 0.446 mg/m³
- MAE: 0.307 mg/m³
- R²: 0.882

**Technologies:** Python, NumPy, Pandas, SciPy, Scikit-learn, Matplotlib and Jupyter Notebook.

#### Running Part A

Navigate to:

`partA_data_science/airquality_project/`

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Run the complete analysis pipeline:

```bash
python -m src.run_pipeline
```

Run the automated tests:

```bash
pip install -r requirements-dev.txt
python -m pytest -q
```

The pipeline generates the processed dataset, result tables, visualisations and model evaluation outputs.

**Project documentation:**
- [Part A README](partA_data_science/airquality_project/README.md)
- [Project Report](partA_data_science/Report_AirQuality_CO.docx)
- [Project Presentation](partA_data_science/Presentation_AirQuality_CO.pptx)

---

### Part B: Machine Whisperer 3D – Interactive Machine Learning Game

Machine Whisperer 3D is an interactive browser-based educational game designed to teach fundamental machine learning concepts through a predictive maintenance scenario.

Players take the role of a plant operator and use historical machine data to predict potential machine failures and decide which machines require maintenance.

The game demonstrates:
- Training, validation and test datasets.
- Overfitting and underfitting.
- Bias-variance trade-off.
- Class imbalance.
- Precision, recall and classification thresholds.
- Feature engineering and feature selection.
- Data leakage.

The game uses machine records from the AI4I 2020 Predictive Maintenance Dataset. Its machine-learning calculations are implemented using a k-nearest-neighbour classifier.

**Technologies:** HTML, CSS, JavaScript and Three.js.

#### Running Part B

No installation is required.

1. Navigate to the `partB_game/` folder.
2. Open `MachineWhisperer3D.html` in a modern web browser.
3. Follow the in-game instructions to explore the different learning scenarios.

The game can run locally without an internet connection.

**Additional documentation:**
- [How to Play](partB_game/HOW_TO_PLAY.md)
- [Learning Objectives](partB_game/LEARNING_OBJECTIVES.md)
- [Design Notes](partB_game/DESIGN_NOTES.md)

---

## Repository Structure

```text
AirQuality-DataScience-Project/
│
├── README.md
│
├── partA_data_science/
│   ├── airquality_project/
│   │   ├── data/
│   │   ├── notebooks/
│   │   ├── outputs/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── requirements.txt
│   │   └── README.md
│   │
│   ├── Report_AirQuality_CO.docx
│   └── Presentation_AirQuality_CO.pptx
│
└── partB_game/
    ├── MachineWhisperer3D.html
    ├── src/
    ├── game_data/
    ├── HOW_TO_PLAY.md
    ├── LEARNING_OBJECTIVES.md
    ├── DESIGN_NOTES.md
    └── PLAYTEST_EVIDENCE.md
```

## Datasets and References

**Part A:**
- Vito, S. (2008). Air Quality Dataset. UCI Machine Learning Repository.
- https://doi.org/10.24432/C59K5F

**Part B:**
- AI4I 2020 Predictive Maintenance Dataset.
- UCI Machine Learning Repository.
- https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset

## Reproducibility

The Part A project includes a modular Python implementation, fixed random seed, dependency files, an executed Jupyter Notebook and automated tests to support reproducibility.

The Part B game includes its source code, embedded machine data and instructions for running it locally.

---

**Developed as part of the Introduction to Data Science for Engineers course at IIITDM Kancheepuram.**

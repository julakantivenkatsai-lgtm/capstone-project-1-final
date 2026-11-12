# MaintIQ – AI-Powered Predictive Maintenance

> **Tagline:** Machine Health Intelligence  
> **Type:** Final-Year CSE Capstone Project  
> **Deployment Target:** Google AI Studio Publish Compatible

---

## Overview

**MaintIQ** is a professional Machine Health Intelligence application designed to predict equipment failures and identify unusual machine operating conditions using machine learning and unsupervised anomaly detection.

Dataset parsing, model training, inference, and anomaly detection run in the browser using `@kanaries/ml`. The Express server handles login sessions and stores the active uploaded dataset in MongoDB when configured; otherwise the app stores it in the current browser and displays a warning.

---

## Key Modules Implemented

1. **Professional Dashboard:** Key metrics (Fleet failure rate, model F1 scores, anomaly percentages, physical failure envelopes, machine type breakdown).
2. **Dataset Upload & Validation:** In-browser CSV ingestion, column schema verification, and automatic anti-leakage sanitization.
3. **Exploratory Data Analysis (EDA):** Descriptive statistics tables (mean, std, min, quartiles, max) and Pearson correlation coefficients with failure target.
4. **Machine-Failure Prediction:** Real-time inference using trained ensemble models.
5. **Model Comparison:** Side-by-side benchmark of **Logistic Regression**, **Random Forest**, and **XGBoost** with Precision, Recall, F1, Accuracy, ROC-AUC, PR-AUC, Confusion Matrices, and interactive ROC / PR Curves.
6. **Isolation Forest Anomaly Detection:** Unsupervised outlier scoring and Speed vs. Torque operating envelope scatter plot.
7. **Model Explainability & What-If Analysis:** Relative feature importance rankings and interactive counterfactual simulation sliders.
8. **Single-Machine Predictor:** Form inputs initialized from an uploaded sensor record, physical metrics (Spindle Power, Thermal Gradient $\Delta T$, Overstrain Index), and actionable maintenance directives.
9. **Batch CSV Inference:** In-browser processing of multi-machine CSV files with annotated classification tables.
10. **Prediction History:** Auditable prediction logs persisted in browser `localStorage`.
11. **Downloadable CSV Reports:** Export capabilities for batch classifications and audit history.
12. **About, Methodology & Limitations:** Academic disclosures, synthetic benchmark citations, zero-leakage protocol, and project boundaries.

---

## Dataset & Zero-Leakage Protocol

- **Dataset:** User-uploaded CSV telemetry; the active dataset is stored in MongoDB.
- **Authorized Input Features (6):**
  1. `Type` (machine variant: `L`, `M`, or `H`)
  2. `Air temperature [K]`
  3. `Process temperature [K]`
  4. `Rotational speed [rpm]`
  5. `Torque [Nm]`
  6. `Tool wear [min]`
- **Optional target:** `Machine failure` (binary target: 0 = normal, 1 = failure).
- **Excluded Features (Anti-Leakage):** `Machine failure`, `TWF`, `HDF`, `PWF`, `OSF`, `RNF`, `UDI`, `Product ID`.
- **Validation Protocol:** Stratified 70% Train, 15% Validation, 15% Test split. Preprocessing (`StandardScaler`) is fitted strictly on the training partition. Decision thresholds are tuned on the validation partition to optimize F1-score, and final metrics are computed on the test partition.

## CSV Uploads

- Use **Batch CSV Inference** to predict from one or more sensor-only CSV files, or a ZIP archive containing CSV files. Required columns are `Type`, `Air temperature [K]`, `Process temperature [K]`, `Rotational speed [rpm]`, `Torque [Nm]`, and `Tool wear [min]`. `Machine failure` labels are optional.
- Use **Dataset Upload** to replace the active dataset and update the website. MongoDB is used when configured; otherwise the dataset is stored in the current browser with a warning. `Machine failure` labels are optional; anomaly detection works without them, while supervised prediction and comparison require at least 7 rows from each class.
- Select files and click **Execute Selected Files** to run batch inference. Progress, per-file validation, invalid row details, duplicate-row notices, and predictions appear in the interface. Invalid files do not prevent other files from running.
- CSV/ZIP processing is local in the browser; ZIP archives may contain CSV files and other entries, which are reported as skipped.

---

## Running the Web Application Locally

```bash
cd web
npm install
cp .env.example .env
# Set MAINTIQ_USERNAME, MAINTIQ_PASSWORD, MAINTIQ_SESSION_SECRET, and MONGODB_URI in .env
./run.sh dev
```

To build and run the production server:

```bash
cd web
./run.sh
```

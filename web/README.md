# MaintIQ – AI-Powered Predictive Maintenance
> **Machine Health Intelligence**  
> CSE Final-Year Engineering Project Documentation

---

## 1. Project Overview
**MaintIQ** is an end-to-end Machine Health Intelligence system that predicts imminent industrial equipment failures and identifies anomalous operating regimes before costly unscheduled downtime occurs.

Unlike basic demos, MaintIQ executes actual client-side Machine Learning algorithms with:
- **Zero data leakage**: Preprocessing scalers (Z-score standard deviation and mean) are fitted strictly on the training partition.
- **Stratified splits**: 70% Train, 15% Validation, and 15% Test splits, preserving the 3.4% failure class balance.
- **Imbalanced threshold optimization**: Decision boundaries (&tau;) are tuned on the validation set to maximize F1-score and evaluated strictly on the reserved test set.
- **Dual Supervised & Unsupervised Modeling**:
  1. Supervised Machine Failure Prediction: **Logistic Regression**, **Random Forest**, and **XGBoost-style Gradient Boosted Decision Trees (GBDT)**.
  2. Unsupervised Anomaly Detection: **Isolation Forest** ($s = 2^{-E(h)/c(\psi)}$).

---

## 2. Dataset Specification (UCI AI4I 2020)
MaintIQ utilizes the **UCI AI4I 2020 Predictive Maintenance Dataset** (Matan et al.):
- **Total records**: 10,000 synthetic milling machine records.
- **Legitimate Features**:
  1. `Type` (L: Low 50%, M: Medium 30%, H: High 20%)
  2. `Air temperature [K]`
  3. `Process temperature [K]`
  4. `Rotational speed [rpm]`
  5. `Torque [Nm]`
  6. `Tool wear [min]`
- **Derived Physical Terms**:
  - Thermal Gradient: $\Delta T = T_{proc} - T_{air}$
  - Motor Power: $P = \tau \cdot \omega = \text{Torque} \times (\text{rpm} \cdot 2\pi/60)$ [Watts]
  - Overstrain Index: $\text{Tool Wear} \times \text{Torque}$ [$\text{min}\cdot\text{Nm}$]
- **Target**: `Machine failure` (0: Normal, 1: Failure; ~3.4% imbalance)
- **Excluded Columns (Leakage Prevention)**:
  - `TWF` (Tool Wear Failure)
  - `HDF` (Heat Dissipation Failure)
  - `PWF` (Power Failure)
  - `OSF` (Overstrain Failure)
  - `RNF` (Random Failure)
  - `UDI`, `Product ID` (Identifiers)

---

## 3. Required Project Modules
1. **Executive Dashboard**: Real-time KPIs, fleet risk breakdown, and simulated telemetry stream.
2. **Dataset Upload & Validation**: Built-in AI4I 2020 dataset loader, CSV upload, column schema verification, and range sanity checks.
3. **Exploratory Data Analysis (EDA)**: Interactive histograms, correlation matrix heatmap, failure scatter clusters, and failure mode breakdown.
4. **Machine-Failure Prediction Engine**: Live risk inference and physics telemetry computations.
5. **Model Comparison & Benchmark**: Side-by-side benchmark table (Precision, Recall, F1, Accuracy, ROC-AUC, PR-AUC), visual Confusion Matrices, and ROC/PR curves.
6. **Isolation Forest Anomaly Detection**: Unsupervised anomaly scoring and outlier identification.
7. **Model Explainability & What-If Simulator**: Permutation feature importance and live multi-variable sliders with real-time risk delta computation.
8. **Single-Machine Prediction**: Industrial telemetry form with preset scenarios and prescriptive maintenance guidance.
9. **Batch CSV Processing**: Multi-machine inference, risk tagging, and annotated CSV export.
10. **Prediction History**: Auditable logging stored in client `localStorage`.
11. **Downloadable CSV Reports**: Batch predictions, benchmark metrics, and history export.
12. **Academic Methodology & Disclosures**: Transparent problem statement, dataset citations, and ethical limitations.

## CSV Uploads
- **Batch CSV Inference** accepts multiple CSV files and ZIP archives containing CSV files. It accepts the six sensor columns without a target label, displays execution progress, and shows per-file results and predictions for valid rows.
- **Dataset Upload** updates the active dataset and sensor EDA with or without a target label. Retraining requires a `Machine failure` column containing `0`/`1` labels and at least 7 rows from each class; otherwise failure metrics are unavailable and the existing model is retained.
- Invalid rows are reported with row numbers; duplicate rows are reported and retained. A file with a missing required column is rejected, but does not stop other selected files from running.
- CSV/ZIP parsing runs locally in the browser; sensor-only rows are not treated as normal/failure training labels.

## Running Locally
- Install dependencies with `npm install`.
- Copy `.env.example` to `.env` and set `MAINTIQ_USERNAME`, `MAINTIQ_PASSWORD`, and `MAINTIQ_SESSION_SECRET`.
- Run `./run.sh dev` for development or `./run.sh` to build and serve the production app.
- The server intentionally does not generate default credentials. Keep `.env` private and never commit it.

---

## 4. Mandatory Project Disclosures & Boundaries
1. **Synthetic Data Disclosure**: The UCI AI4I dataset is synthetic and does not represent verified physical real-world industrial testing.
2. **No Remaining Useful Life (RUL)**: MaintIQ performs instantaneous binary failure classification and anomaly scoring; it does not model continuous RUL degradation curves.
3. **No Certified Industrial Safety**: This software is an academic engineering prototype and is not certified for mission-critical industrial safety decisions.
4. **Anomaly $\neq$ Failure**: An anomaly denotes low-density multivariate telemetry space, which does not automatically confirm mechanical failure.
5. **Feature Importance $\neq$ Causation**: Permutation feature importance measures model sensitivity, not physical causation, and is not Shapley (SHAP) values.

# MaintIQ – AI-Powered Predictive Maintenance
> **Machine Health Intelligence**  
> CSE Final-Year Engineering Project Documentation

---

## 1. Project Overview
**MaintIQ** is an end-to-end Machine Health Intelligence system that predicts equipment failures and identifies anomalous operating regimes from a user-uploaded dataset.

Unlike basic demos, MaintIQ executes actual client-side Machine Learning algorithms with:
- **Zero data leakage**: Preprocessing scalers (Z-score standard deviation and mean) are fitted strictly on the training partition.
- **Stratified splits**: 70% Train, 15% Validation, and 15% Test splits, preserving the uploaded target ratio.
- **Imbalanced threshold optimization**: Decision boundaries (&tau;) are tuned on the validation set to maximize F1-score and evaluated strictly on the reserved test set.
- **Dual Supervised & Unsupervised Modeling**:
  1. Supervised Machine Failure Prediction: **Logistic Regression**, **Random Forest**, and **XGBoost-style Gradient Boosted Decision Trees (GBDT)**.
  2. Unsupervised Anomaly Detection: **Isolation Forest** ($s = 2^{-E(h)/c(\psi)}$).

---

## 2. Uploaded Dataset Specification
MaintIQ starts with no dataset. Upload a CSV with these required features:
  1. `Type` (`L`, `M`, or `H`)
  2. `Air temperature [K]`
  3. `Process temperature [K]`
  4. `Rotational speed [rpm]`
  5. `Torque [Nm]`
  6. `Tool wear [min]`
- **Derived Physical Terms**:
  - Thermal Gradient: $\Delta T = T_{proc} - T_{air}$
  - Motor Power: $P = \tau \cdot \omega = \text{Torque} \times (\text{rpm} \cdot 2\pi/60)$ [Watts]
  - Overstrain Index: $\text{Tool Wear} \times \text{Torque}$ [$\text{min}\cdot\text{Nm}$]
- **Optional target**: `Machine failure` (0: Normal, 1: Failure)
- **Excluded Columns (Leakage Prevention)**:
  - `TWF` (Tool Wear Failure)
  - `HDF` (Heat Dissipation Failure)
  - `PWF` (Power Failure)
  - `OSF` (Overstrain Failure)
  - `RNF` (Random Failure)
  - `UDI`, `Product ID` (Identifiers)

---

## 3. Required Project Modules
1. **Executive Dashboard**: KPIs and fleet breakdown derived from the active uploaded dataset.
2. **Dataset Upload & Validation**: CSV upload, column schema verification, range sanity checks, and MongoDB persistence.
3. **Exploratory Data Analysis (EDA)**: Interactive histograms, correlation matrix heatmap, failure scatter clusters, and failure mode breakdown.
4. **Machine-Failure Prediction Engine**: Live risk inference and physics telemetry computations.
5. **Model Comparison & Benchmark**: Side-by-side benchmark table (Precision, Recall, F1, Accuracy, ROC-AUC, PR-AUC), visual Confusion Matrices, and ROC/PR curves.
6. **Isolation Forest Anomaly Detection**: Unsupervised anomaly scoring and outlier identification.
7. **Model Explainability & What-If Simulator**: Feature importance and multi-variable sliders initialized from an uploaded record.
8. **Single-Machine Prediction**: Sensor inputs initialized from an uploaded record, with prescriptive maintenance guidance.
9. **Batch CSV Processing**: Multi-machine inference, risk tagging, and annotated CSV export.
10. **Prediction History**: Auditable logging stored in client `localStorage`.
11. **Downloadable CSV Reports**: Batch predictions, benchmark metrics, and history export.
12. **Academic Methodology & Disclosures**: Transparent problem statement, dataset citations, and ethical limitations.

## CSV Uploads
- **Batch CSV Inference** accepts multiple CSV files and ZIP archives containing CSV files. It accepts the six sensor columns without a target label, displays execution progress, and shows per-file results and predictions for valid rows.
- **Dataset Upload** replaces the active dataset and refreshes the site after saving. MongoDB is used when configured; otherwise the dataset is stored in the current browser with a warning. Anomaly detection works with unlabeled sensor data; supervised prediction and comparison require at least 7 rows from each target class.
- Invalid rows are reported with row numbers; duplicate rows are reported and retained. A file with a missing required column is rejected, but does not stop other selected files from running.
- CSV/ZIP parsing runs locally in the browser; sensor-only rows are not treated as normal/failure training labels. Dataset uploads are limited to 12 MB for MongoDB storage.

## Running Locally
- Install dependencies with `npm install`.
- Copy `.env.example` to `.env` and set `MAINTIQ_USERNAME`, `MAINTIQ_PASSWORD`, and `MAINTIQ_SESSION_SECRET`. `MONGODB_URI` is optional for browser-only local use; without it the app stores the uploaded dataset in that browser and displays a warning. Set it with a least-privilege MongoDB application user for shared persistence; never commit `.env`.
- `MONGODB_DATABASE` defaults to `maintiq`.
- Run `./run.sh dev` for development or `./run.sh` to build and serve the production app.
- The server intentionally does not generate default credentials. Keep `.env` private and never commit it.

## Deploying to Render
- Push this repository to GitHub and create a Blueprint on Render using the repository's root `render.yaml`.
- The Blueprint configures a free Node web service. Set `MAINTIQ_USERNAME`, `MAINTIQ_PASSWORD`, and `MONGODB_URI` as secrets; Render generates `MAINTIQ_SESSION_SECRET`.
- After deployment, Render provides a public `https://<service-name>.onrender.com` URL; it does not require your IP address. Free services spin down after 15 minutes without traffic and can take about a minute to wake up. They also have monthly usage limits, so this is suitable for a demo rather than production.

---

## 4. Mandatory Project Disclosures & Boundaries
1. **Data Provenance**: MaintIQ analyzes uploaded telemetry; it does not verify that data is representative of real industrial equipment.
2. **No Remaining Useful Life (RUL)**: MaintIQ performs instantaneous binary failure classification and anomaly scoring; it does not model continuous RUL degradation curves.
3. **No Certified Industrial Safety**: This software is an academic engineering prototype and is not certified for mission-critical industrial safety decisions.
4. **Anomaly $\neq$ Failure**: An anomaly denotes low-density multivariate telemetry space, which does not automatically confirm mechanical failure.
5. **Feature Importance $\neq$ Causation**: Permutation feature importance measures model sensitivity, not physical causation, and is not Shapley (SHAP) values.

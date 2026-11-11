/**
 * MaintIQ - Machine Health Intelligence
 * Master Application Controller & Visualization Suite
 */

(function () {
    'use strict';

    // Application State
    const AppState = {
        currentView: 'dashboard',
        dataset: [],
        splitData: null,
        preprocessor: null,
        models: {
            lr: null,
            rf: null,
            xgb: null
        },
        isolationForest: null,
        evaluationResults: {},
        featureImportance: [],
        currentModelKey: 'xgb',
        history: [],
        batchResults: [],
        tickerInterval: null,
        simulatedTelemetry: {
            airTemp: 298.2,
            procTemp: 308.5,
            speed: 1540,
            torque: 41.2,
            toolWear: 72,
            type: 'L'
        }
    };

    // Lightweight Chart Rendering Utility (Pure Canvas / SVG - Zero external dependencies)
    const ChartEngine = {
        // High-DPI canvas initialization
        initCanvas: function (canvas) {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            return { ctx, width: rect.width, height: rect.height };
        },

        // Histogram Chart
        renderHistogram: function (canvasId, values, numBins = 12, label = '', color = '#14B8A6') {
            const canvas = document.getElementById(canvasId);
            if (!canvas || !values.length) return;
            const { ctx, width, height } = this.initCanvas(canvas);

            ctx.clearRect(0, 0, width, height);

            let min = Math.min(...values);
            let max = Math.max(...values);
            if (min === max) { min -= 1; max += 1; }
            const binSize = (max - min) / numBins;
            const bins = new Array(numBins).fill(0);

            for (const v of values) {
                const b = Math.min(numBins - 1, Math.floor((v - min) / binSize));
                bins[b]++;
            }
            const maxCount = Math.max(...bins, 1);

            const padLeft = 35;
            const padBottom = 25;
            const padTop = 15;
            const padRight = 10;
            const chartW = width - padLeft - padRight;
            const chartH = height - padTop - padBottom;
            const barW = (chartW / numBins) - 3;

            // Draw Grid Lines
            ctx.strokeStyle = '#203052';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padLeft, padTop);
            ctx.lineTo(padLeft, height - padBottom);
            ctx.lineTo(width - padRight, height - padBottom);
            ctx.stroke();

            // Draw Bars
            for (let i = 0; i < numBins; i++) {
                const barH = (bins[i] / maxCount) * chartH;
                const x = padLeft + (i * (chartW / numBins)) + 1.5;
                const y = height - padBottom - barH;

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
                ctx.fill();

                // Axis ticks every few bins
                if (i % 3 === 0 || i === numBins - 1) {
                    ctx.fillStyle = '#94A3B8';
                    ctx.font = '10px -apple-system, sans-serif';
                    ctx.textAlign = 'center';
                    const binVal = (min + i * binSize).toFixed(1);
                    ctx.fillText(binVal, x + barW / 2, height - padBottom + 14);
                }
            }

            // Title / Label
            ctx.fillStyle = '#CBD5E1';
            ctx.font = '11px -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(label, padLeft + 6, padTop + 10);
        },

        // Correlation Heatmap
        renderCorrelationHeatmap: function (canvasId, matrix, labels) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const { ctx, width, height } = this.initCanvas(canvas);
            ctx.clearRect(0, 0, width, height);

            const n = labels.length;
            const padLeft = 65;
            const padBottom = 45;
            const size = Math.min((width - padLeft - 10) / n, (height - padBottom - 10) / n);

            ctx.font = '9.5px -apple-system, sans-serif';

            for (let i = 0; i < n; i++) {
                // Row labels
                ctx.fillStyle = '#94A3B8';
                ctx.textAlign = 'right';
                ctx.fillText(labels[i], padLeft - 6, padBottom + (i * size) + size / 2 + 3);

                for (let j = 0; j < n; j++) {
                    const val = matrix[i][j];
                    const x = padLeft + j * size;
                    const y = padBottom + i * size;

                    // Color ramp: -1 (rose/red) to 0 (slate) to +1 (teal)
                    let r, g, b;
                    if (val >= 0) {
                        r = Math.round(19 + val * (20 - 19));
                        g = Math.round(30 + val * (184 - 30));
                        b = Math.round(54 + val * (166 - 54));
                    } else {
                        const absVal = Math.abs(val);
                        r = Math.round(19 + absVal * (244 - 19));
                        g = Math.round(30 + absVal * (63 - 30));
                        b = Math.round(54 + absVal * (94 - 54));
                    }

                    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

                    // Text inside cell
                    ctx.fillStyle = Math.abs(val) > 0.45 ? '#FFFFFF' : '#94A3B8';
                    ctx.textAlign = 'center';
                    ctx.fillText(val.toFixed(2), x + size / 2, y + size / 2 + 3);
                }
            }

            // Column labels (rotated)
            ctx.save();
            ctx.textAlign = 'left';
            ctx.fillStyle = '#94A3B8';
            for (let j = 0; j < n; j++) {
                const x = padLeft + j * size + size / 2;
                ctx.save();
                ctx.translate(x, padBottom - 6);
                ctx.rotate(-Math.PI / 4);
                ctx.fillText(labels[j], 0, 0);
                ctx.restore();
            }
            ctx.restore();
        },

        // Scatter Plot (Rotational Speed vs Torque with failure markers)
        renderScatter: function (canvasId, records) {
            const canvas = document.getElementById(canvasId);
            if (!canvas || !records.length) return;
            const { ctx, width, height } = this.initCanvas(canvas);
            ctx.clearRect(0, 0, width, height);

            const padLeft = 45;
            const padBottom = 30;
            const padTop = 15;
            const padRight = 15;
            const chartW = width - padLeft - padRight;
            const chartH = height - padTop - padBottom;

            const minX = 1100, maxX = 2900; // Speed
            const minY = 0, maxY = 80;      // Torque

            // Draw Grid Lines
            ctx.strokeStyle = '#203052';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padLeft, padTop);
            ctx.lineTo(padLeft, height - padBottom);
            ctx.lineTo(width - padRight, height - padBottom);
            ctx.stroke();

            // Axis Labels
            ctx.fillStyle = '#94A3B8';
            ctx.font = '10px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("Rotational speed [rpm]", padLeft + chartW / 2, height - 6);

            ctx.save();
            ctx.translate(14, padTop + chartH / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText("Torque [Nm]", 0, 0);
            ctx.restore();

            // Sample max 400 dots for fast rendering
            const sample = records.slice(0, 400);

            // Draw normal dots first (teal)
            for (const r of sample) {
                if (r.Machine_failure === 1) continue;
                const x = padLeft + ((r.Rotational_speed_rpm - minX) / (maxX - minX)) * chartW;
                const y = height - padBottom - ((r.Torque_Nm - minY) / (maxY - minY)) * chartH;
                ctx.fillStyle = 'rgba(20, 184, 166, 0.45)';
                ctx.beginPath();
                ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw failure dots on top (radiant rose)
            for (const r of sample) {
                if (r.Machine_failure !== 1) continue;
                const x = padLeft + ((r.Rotational_speed_rpm - minX) / (maxX - minX)) * chartW;
                const y = height - padBottom - ((r.Torque_Nm - minY) / (maxY - minY)) * chartH;
                ctx.fillStyle = '#F43F5E';
                ctx.shadowColor = 'rgba(244, 63, 94, 0.7)';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(x, y, 4.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        },

        // ROC and PR Curves
        renderCurve: function (canvasId, points, xProp, yProp, title, xTitle, yTitle, baseline = 'diagonal') {
            const canvas = document.getElementById(canvasId);
            if (!canvas || !points.length) return;
            const { ctx, width, height } = this.initCanvas(canvas);
            ctx.clearRect(0, 0, width, height);

            const padLeft = 40;
            const padBottom = 30;
            const padTop = 20;
            const padRight = 15;
            const chartW = width - padLeft - padRight;
            const chartH = height - padTop - padBottom;

            // Border & Grid
            ctx.strokeStyle = '#203052';
            ctx.lineWidth = 1;
            ctx.strokeRect(padLeft, padTop, chartW, chartH);

            // Baseline
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = '#475569';
            ctx.beginPath();
            if (baseline === 'diagonal') {
                ctx.moveTo(padLeft, height - padBottom);
                ctx.lineTo(padLeft + chartW, padTop);
            } else {
                // Horizontal line for PR baseline
                const baseH = height - padBottom - (0.035 * chartH);
                ctx.moveTo(padLeft, baseH);
                ctx.lineTo(padLeft + chartW, baseH);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw Curve
            ctx.strokeStyle = '#14B8A6';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = 'rgba(20, 184, 166, 0.4)';
            ctx.shadowBlur = 8;
            ctx.beginPath();

            for (let i = 0; i < points.length; i++) {
                const px = padLeft + Math.max(0, Math.min(1, points[i][xProp])) * chartW;
                const py = height - padBottom - Math.max(0, Math.min(1, points[i][yProp])) * chartH;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Axis labels & Title
            ctx.fillStyle = '#CBD5E1';
            ctx.font = '11px -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(title, padLeft + 6, padTop + 14);

            ctx.fillStyle = '#94A3B8';
            ctx.font = '10px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(xTitle, padLeft + chartW / 2, height - 6);

            ctx.save();
            ctx.translate(12, padTop + chartH / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(yTitle, 0, 0);
            ctx.restore();
        },

        // Horizontal Bar Chart for Feature Importance
        renderFeatureImportance: function (canvasId, items) {
            const canvas = document.getElementById(canvasId);
            if (!canvas || !items.length) return;
            const { ctx, width, height } = this.initCanvas(canvas);
            ctx.clearRect(0, 0, width, height);

            const padLeft = 140;
            const padRight = 45;
            const padTop = 15;
            const padBottom = 20;
            const chartW = width - padLeft - padRight;
            const rowH = (height - padTop - padBottom) / items.length;

            ctx.font = '11px -apple-system, sans-serif';

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const y = padTop + (i * rowH);
                const barH = Math.max(8, rowH - 8);
                const barW = (item.relativePercentage / 100) * chartW;

                // Label
                ctx.fillStyle = '#E2E8F0';
                ctx.textAlign = 'right';
                ctx.fillText(item.name, padLeft - 10, y + barH / 2 + 4);

                // Bar
                ctx.fillStyle = i === 0 ? '#14B8A6' : (i < 3 ? '#2DD4BF' : '#0D9488');
                ctx.beginPath();
                ctx.roundRect(padLeft, y, Math.max(3, barW), barH, [0, 4, 4, 0]);
                ctx.fill();

                // Percentage text
                ctx.fillStyle = '#94A3B8';
                ctx.textAlign = 'left';
                ctx.fillText(`${item.relativePercentage}%`, padLeft + barW + 6, y + barH / 2 + 4);
            }
        }
    };

    // Gauge Update
    function updateRiskGauge(percentage, riskCategory) {
        const needle = document.getElementById('gaugeNeedle');
        const text = document.getElementById('gaugeValueText');
        const badge = document.getElementById('gaugeRiskBadge');
        if (!text) return;

        text.textContent = `${Math.round(percentage)}%`;

        // Angle from -90 deg (0%) to +90 deg (100%)
        const angle = -90 + (percentage / 100) * 180;
        if (needle) {
            needle.setAttribute('transform', `rotate(${angle} 110 100)`);
        }

        if (badge) {
            badge.className = `status-pill ${riskCategory.toLowerCase()}`;
            badge.textContent = riskCategory;
        }
    }

    // App Initialization
    function init() {
        setupNavigation();
        loadInitialDataset();
        setupTelemetryTicker();
        setupEventListeners();
        loadHistory();
    }

    // Setup Sidebar Navigation
    function setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', function (e) {
                e.preventDefault();
                const targetView = this.getAttribute('data-view');
                if (!targetView) return;

                navItems.forEach(n => n.classList.remove('active'));
                this.classList.add('active');

                switchView(targetView);

                // Close mobile sidebar if open
                document.getElementById('sidebar')?.classList.remove('open');
            });
        });

        // Mobile Menu Button
        document.getElementById('mobileMenuBtn')?.addEventListener('click', function () {
            document.getElementById('sidebar')?.classList.toggle('open');
        });

        // Global Back handler bridge for Android
        window.maintiqGoBack = function () {
            if (AppState.currentView !== 'dashboard') {
                const dashboardNav = document.querySelector('[data-view="dashboard"]');
                if (dashboardNav) dashboardNav.click();
            }
        };
    }

    function switchView(viewName) {
        AppState.currentView = viewName;
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        const activeSection = document.getElementById(`view-${viewName}`);
        if (activeSection) {
            activeSection.classList.add('active');
        }

        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            const titles = {
                dashboard: 'Executive Dashboard & Telemetry',
                dataset: 'Dataset Validation & Exploratory Data Analysis',
                models: 'Model Training, Comparison & ROC Benchmark',
                anomaly: 'Isolation Forest Anomaly Detection',
                predict: 'Single-Machine Failure Prediction',
                batch: 'Batch CSV Machine Processing',
                explain: 'Model Explainability & What-If Scenario Analysis',
                history: 'Prediction History & Audit Log',
                about: 'Project Architecture, Methodology & Limitations'
            };
            pageTitle.textContent = titles[viewName] || 'MaintIQ';
        }

        // Trigger view-specific re-renders
        setTimeout(() => {
            if (viewName === 'dataset') renderEDACharts();
            if (viewName === 'models') renderModelBenchmarkVisuals();
            if (viewName === 'anomaly') renderAnomalyVisuals();
            if (viewName === 'explain') renderExplainabilityVisuals();
        }, 50);
    }

    // Load Initial UCI AI4I 2020 Dataset
    function loadInitialDataset() {
        try {
            AppState.dataset = window.MaintIQDataset.getDataset();
            document.getElementById('kpiTotalRecords').textContent = AppState.dataset.length.toLocaleString();

            const failures = AppState.dataset.filter(r => r.Machine_failure === 1).length;
            const failureRate = ((failures / AppState.dataset.length) * 100).toFixed(2);
            document.getElementById('kpiFailureRate').textContent = `${failureRate}%`;

            // Run Stratified Split and Model Training
            trainAllModels();
            updateDashboardKPIs();
        } catch (err) {
            console.error("Failed to load dataset:", err);
        }
    }

    // Train ML Pipeline (Stratified Split -> Preprocessor -> LR, RF, XGB, iForest)
    function trainAllModels() {
        const engine = window.MaintIQMLEngine;

        // 1. Stratified Split 70 / 15 / 15
        AppState.splitData = engine.stratifiedSplit(AppState.dataset, 0.70, 0.15);

        // 2. Preprocessor fitted STRICTLY on Training Set (Zero Data Leakage!)
        AppState.preprocessor = new engine.DataPreprocessor();
        AppState.preprocessor.fit(AppState.splitData.train);

        const trainTransformed = AppState.preprocessor.transform(AppState.splitData.train);
        const valTransformed = AppState.preprocessor.transform(AppState.splitData.val);
        const testTransformed = AppState.preprocessor.transform(AppState.splitData.test);

        // 3. Train Models
        console.log("Training Logistic Regression...");
        AppState.models.lr = new engine.LogisticRegressionModel(0.08, 260, 0.015);
        AppState.models.lr.train(trainTransformed);

        console.log("Training Random Forest...");
        AppState.models.rf = new engine.RandomForestModel(20, 6);
        AppState.models.rf.train(trainTransformed);

        console.log("Training XGBoost GBDT...");
        AppState.models.xgb = new engine.XGBoostModel(24, 0.12, 3);
        AppState.models.xgb.train(trainTransformed);

        // 4. Threshold Optimization on Validation Data
        for (const key of ['lr', 'rf', 'xgb']) {
            const opt = engine.findOptimalThreshold(AppState.models[key], valTransformed);
            AppState.models[key].optimalThreshold = opt.optimalThreshold;
        }

        // 5. Final Honest Evaluation on Test Data
        AppState.evaluationResults.lr = engine.evaluateModel(AppState.models.lr, testTransformed, AppState.models.lr.optimalThreshold);
        AppState.evaluationResults.rf = engine.evaluateModel(AppState.models.rf, testTransformed, AppState.models.rf.optimalThreshold);
        AppState.evaluationResults.xgb = engine.evaluateModel(AppState.models.xgb, testTransformed, AppState.models.xgb.optimalThreshold);

        // 6. Isolation Forest for Anomaly Detection
        console.log("Fitting Isolation Forest...");
        AppState.isolationForest = new engine.IsolationForest(50, 128);
        const allFeatureVectors = AppState.dataset.map(r => AppState.preprocessor.extractRawFeatures(r));
        AppState.isolationForest.fit(allFeatureVectors);

        // 7. Feature Importance on Validation Set
        AppState.featureImportance = engine.computeFeatureImportance(AppState.models.xgb, valTransformed, AppState.preprocessor);

        // Update UI benchmark tables & status
        updateModelBenchmarkTable();
        document.getElementById('modelStatusText').textContent = 'Models Trained';
        document.getElementById('activeModelBadge').textContent = 'XGBoost Active';
    }

    // Dashboard Telemetry Simulation Ticker
    function setupTelemetryTicker() {
        const ticker = document.getElementById('telemetryTicker');
        if (!ticker) return;

        AppState.tickerInterval = setInterval(() => {
            // Small continuous drift to mimic live telemetry
            const drift = (Math.random() - 0.49) * 0.4;
            AppState.simulatedTelemetry.airTemp = parseFloat((AppState.simulatedTelemetry.airTemp + drift * 0.1).toFixed(1));
            AppState.simulatedTelemetry.procTemp = parseFloat((AppState.simulatedTelemetry.procTemp + drift * 0.15).toFixed(1));
            AppState.simulatedTelemetry.speed = Math.round(AppState.simulatedTelemetry.speed + (Math.random() - 0.5) * 8);
            AppState.simulatedTelemetry.torque = parseFloat((AppState.simulatedTelemetry.torque + (Math.random() - 0.5) * 0.3).toFixed(1));

            ticker.innerHTML = `
                <div class="telemetry-item"><span class="status-indicator"></span> <strong>FLEET TELEMETRY:</strong></div>
                <div class="telemetry-item">Air Temp: <span class="val">${AppState.simulatedTelemetry.airTemp} K</span></div>
                <div class="telemetry-item">Proc Temp: <span class="val">${AppState.simulatedTelemetry.procTemp} K</span></div>
                <div class="telemetry-item">Rot. Speed: <span class="val">${AppState.simulatedTelemetry.speed} rpm</span></div>
                <div class="telemetry-item">Torque: <span class="val">${AppState.simulatedTelemetry.torque} Nm</span></div>
                <div class="telemetry-item">Tool Wear: <span class="val">${AppState.simulatedTelemetry.toolWear} min</span></div>
                <div class="telemetry-item">Power: <span class="val">${Math.round(AppState.simulatedTelemetry.torque * AppState.simulatedTelemetry.speed * (2 * Math.PI / 60))} W</span></div>
            `;
        }, 3000);
    }

    // Update Dashboard Top KPIs
    function updateDashboardKPIs() {
        const xgbRes = AppState.evaluationResults.xgb;
        if (xgbRes) {
            document.getElementById('kpiModelF1').textContent = xgbRes.f1.toFixed(3);
            document.getElementById('kpiModelRoc').textContent = xgbRes.rocAuc.toFixed(3);
        }

        // Anomaly count in fleet
        if (AppState.isolationForest) {
            const rawVectors = AppState.dataset.map(r => AppState.preprocessor.extractRawFeatures(r));
            const anomalies = rawVectors.filter(v => AppState.isolationForest.isAnomaly(v)).length;
            const anomalyRate = ((anomalies / AppState.dataset.length) * 100).toFixed(1);
            document.getElementById('kpiAnomalyCount').textContent = `${anomalies} (${anomalyRate}%)`;
        }
    }

    // Render EDA Visualizations
    function renderEDACharts() {
        if (!AppState.dataset.length) return;

        // Histograms
        const speeds = AppState.dataset.map(r => r.Rotational_speed_rpm);
        const torques = AppState.dataset.map(r => r.Torque_Nm);
        const wears = AppState.dataset.map(r => r.Tool_wear_min);
        const deltas = AppState.dataset.map(r => r.Process_temperature_K - r.Air_temperature_K);

        ChartEngine.renderHistogram('histSpeed', speeds, 14, 'Rotational Speed [rpm]', '#14B8A6');
        ChartEngine.renderHistogram('histTorque', torques, 14, 'Torque [Nm]', '#06B6D4');
        ChartEngine.renderHistogram('histWear', wears, 14, 'Tool Wear [min]', '#F59E0B');
        ChartEngine.renderHistogram('histDeltaT', deltas, 14, 'Temp Difference (Proc - Air) [K]', '#10B981');

        // Scatter plot
        ChartEngine.renderScatter('scatterSpeedTorque', AppState.dataset);

        // Correlation Matrix
        const corrFeatures = [
            { name: "Air Temp", vals: AppState.dataset.map(r => r.Air_temperature_K) },
            { name: "Proc Temp", vals: AppState.dataset.map(r => r.Process_temperature_K) },
            { name: "Speed", vals: AppState.dataset.map(r => r.Rotational_speed_rpm) },
            { name: "Torque", vals: AppState.dataset.map(r => r.Torque_Nm) },
            { name: "Tool Wear", vals: AppState.dataset.map(r => r.Tool_wear_min) },
            { name: "Failure", vals: AppState.dataset.map(r => r.Machine_failure) }
        ];

        const matrix = [];
        for (let i = 0; i < corrFeatures.length; i++) {
            matrix[i] = [];
            for (let j = 0; j < corrFeatures.length; j++) {
                matrix[i][j] = computePearson(corrFeatures[i].vals, corrFeatures[j].vals);
            }
        }
        ChartEngine.renderCorrelationHeatmap('corrHeatmap', matrix, corrFeatures.map(c => c.name));

        // Failure Mode counts breakdown
        const twfCount = AppState.dataset.filter(r => r.TWF === 1).length;
        const hdfCount = AppState.dataset.filter(r => r.HDF === 1).length;
        const pwfCount = AppState.dataset.filter(r => r.PWF === 1).length;
        const osfCount = AppState.dataset.filter(r => r.OSF === 1).length;
        const rnfCount = AppState.dataset.filter(r => r.RNF === 1).length;

        document.getElementById('edaTWFCount').textContent = twfCount;
        document.getElementById('edaHDFCount').textContent = hdfCount;
        document.getElementById('edaPWFCount').textContent = pwfCount;
        document.getElementById('edaOSFCount').textContent = osfCount;
        document.getElementById('edaRNFCount').textContent = rnfCount;
    }

    function computePearson(x, y) {
        const n = x.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        for (let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumX2 += x[i] * x[i];
            sumY2 += y[i] * y[i];
        }
        const num = (n * sumXY) - (sumX * sumY);
        const den = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
        return den === 0 ? 0 : (num / den);
    }

    // Update Model Comparison Table
    function updateModelBenchmarkTable() {
        const models = [
            { key: 'lr', name: 'Logistic Regression', res: AppState.evaluationResults.lr },
            { key: 'rf', name: 'Random Forest', res: AppState.evaluationResults.rf },
            { key: 'xgb', name: 'XGBoost (GBDT)', res: AppState.evaluationResults.xgb }
        ];

        const tbody = document.getElementById('benchmarkTableBody');
        if (!tbody) return;

        tbody.innerHTML = models.map(m => {
            const r = m.res;
            const isBest = m.key === 'xgb';
            return `
                <tr class="${isBest ? 'table-highlight' : ''}">
                    <td><strong>${m.name}</strong> ${isBest ? '<span class="status-pill normal" style="font-size:9px;margin-left:4px;">Recommended</span>' : ''}</td>
                    <td><code>${r.precision.toFixed(3)}</code></td>
                    <td><code>${r.recall.toFixed(3)}</code></td>
                    <td><code>${r.f1.toFixed(3)}</code></td>
                    <td><code>${(r.accuracy * 100).toFixed(1)}%</code></td>
                    <td><code>${r.rocAuc.toFixed(3)}</code></td>
                    <td><code>${r.prAuc.toFixed(3)}</code></td>
                    <td><code>${r.threshold.toFixed(2)}</code></td>
                </tr>
            `;
        }).join('');
    }

    // Render Model Benchmark Curves & Confusion Matrix
    function renderModelBenchmarkVisuals() {
        const modelKey = AppState.currentModelKey || 'xgb';
        const res = AppState.evaluationResults[modelKey];
        if (!res) return;

        // Confusion Matrix Values
        document.getElementById('cmTP').textContent = res.tp;
        document.getElementById('cmFP').textContent = res.fp;
        document.getElementById('cmFN').textContent = res.fn;
        document.getElementById('cmTN').textContent = res.tn;

        // Curves
        ChartEngine.renderCurve('rocCanvas', res.rocCurve, 'fpr', 'tpr', `ROC Curve (${modelKey.toUpperCase()}) - AUC: ${res.rocAuc.toFixed(3)}`, 'False Positive Rate (FPR)', 'True Positive Rate (TPR)', 'diagonal');
        ChartEngine.renderCurve('prCanvas', res.prCurve, 'recall', 'precision', `Precision-Recall Curve - PR-AUC: ${res.prAuc.toFixed(3)}`, 'Recall', 'Precision', 'horizontal');
    }

    // Render Anomaly Detection Visuals
    function renderAnomalyVisuals() {
        if (!AppState.isolationForest) return;
        const rawVectors = AppState.dataset.map(r => AppState.preprocessor.extractRawFeatures(r));
        const scores = rawVectors.map(v => AppState.isolationForest.score(v));

        ChartEngine.renderHistogram('anomalyScoreHist', scores, 16, 'Isolation Forest Anomaly Score Distribution', '#8B5CF6');

        // Populate Anomaly Records Table (Top outliers)
        const scoredRecords = AppState.dataset.map((r, idx) => ({
            record: r,
            score: scores[idx]
        })).sort((a, b) => b.score - a.score);

        const outlierTbody = document.getElementById('anomalyOutliersTableBody');
        if (outlierTbody) {
            const outliers = scoredRecords.slice(0, 15);
            outlierTbody.innerHTML = outliers.map(o => {
                const r = o.record;
                const isFail = r.Machine_failure === 1;
                return `
                    <tr>
                        <td><code>#${r.UDI}</code></td>
                        <td><span class="status-pill ${isFail ? 'danger' : 'normal'}">${isFail ? 'Failure' : 'Normal'}</span></td>
                        <td><code>${o.score.toFixed(3)}</code></td>
                        <td>${r.Type}</td>
                        <td>${r.Rotational_speed_rpm} rpm</td>
                        <td>${r.Torque_Nm} Nm</td>
                        <td>${r.Tool_wear_min} min</td>
                        <td>${(r.Process_temperature_K - r.Air_temperature_K).toFixed(1)} K</td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Render Explainability & What-If Visuals
    function renderExplainabilityVisuals() {
        if (!AppState.featureImportance.length) return;
        ChartEngine.renderFeatureImportance('featureImportanceCanvas', AppState.featureImportance);
    }

    // Single Prediction Runner
    function runSinglePrediction(inputs, saveHistory = false) {
        if (!AppState.models.xgb || !AppState.preprocessor) return null;

        const transformed = AppState.preprocessor.transformSingle(inputs);
        const prob = AppState.models.xgb.predictProbability(transformed.scaledFeatures);
        const rawVec = AppState.preprocessor.extractRawFeatures(inputs);
        const anomalyScore = AppState.isolationForest.score(rawVec);
        const isAnomaly = AppState.isolationForest.isAnomaly(rawVec);

        let riskCategory = 'Normal';
        if (prob > 0.65) riskCategory = 'Critical';
        else if (prob > 0.35) riskCategory = 'Warning';

        // Physics indicators
        const deltaT = inputs.Process_temperature_K - inputs.Air_temperature_K;
        const power = Math.round(inputs.Torque_Nm * inputs.Rotational_speed_rpm * (2 * Math.PI / 60));
        const strain = Math.round(inputs.Tool_wear_min * inputs.Torque_Nm);

        // Actionable Maintenance Advice
        let recommendation = "Machine operating within standard physical bounds. Regular periodic maintenance recommended.";
        if (strain > 11000) {
            recommendation = "HIGH OVERSTRAIN DETECTED: Tool wear × torque exceeds safety threshold. Replace milling insert immediately to prevent tool rupture.";
        } else if (inputs.Tool_wear_min > 200) {
            recommendation = "TOOL WEAR LIMIT REACHED: Cutting edge degraded beyond 200 min. Schedule replacement before catastrophic fracture occurs.";
        } else if (deltaT < 8.6 && inputs.Rotational_speed_rpm < 1380) {
            recommendation = "HEAT DISSIPATION HAZARD: Temperature gradient (Proc - Air) < 8.6 K under low speed. Inspect coolant supply lines and ventilation manifold.";
        } else if (power > 9000 || power < 3500) {
            recommendation = "POWER CONSUMPTION OUTLIER: Motor power is outside optimal range (3.5 - 9 kW). Inspect spindle motor bearings and power feed.";
        } else if (isAnomaly) {
            recommendation = "ANOMALOUS OPERATING REGIME: Sensor telemetry deviates from baseline distribution. Note: Anomaly does not confirm mechanical failure; inspect sensors.";
        }

        const result = {
            timestamp: new Date().toLocaleTimeString(),
            inputs,
            probability: prob,
            riskPercentage: prob * 100,
            riskCategory,
            anomalyScore,
            isAnomaly,
            deltaT,
            power,
            strain,
            recommendation
        };

        if (saveHistory) {
            AppState.history.unshift({
                id: Date.now(),
                ...result
            });
            saveHistoryToStorage();
            updateHistoryTable();
        }

        return result;
    }

    // Local Storage Prediction History
    function saveHistoryToStorage() {
        try {
            localStorage.setItem('maintiq_prediction_history', JSON.stringify(AppState.history.slice(0, 100)));
        } catch (e) {
            console.warn("Storage save error", e);
        }
    }

    function loadHistory() {
        try {
            const raw = localStorage.getItem('maintiq_prediction_history');
            if (raw) {
                AppState.history = JSON.parse(raw);
                updateHistoryTable();
            }
        } catch (e) {
            console.warn("History load error", e);
        }
    }

    function updateHistoryTable() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;

        if (AppState.history.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#64748B;padding:20px;">No predictions logged yet. Run a prediction to record history.</td></tr>`;
            return;
        }

        tbody.innerHTML = AppState.history.map(item => `
            <tr>
                <td><code>${item.timestamp}</code></td>
                <td><span class="status-pill ${item.riskCategory.toLowerCase()}">${item.riskCategory}</span></td>
                <td><code>${item.riskPercentage.toFixed(1)}%</code></td>
                <td><code>${item.anomalyScore.toFixed(3)}</code></td>
                <td>${item.inputs.Type}</td>
                <td>${item.inputs.Rotational_speed_rpm} rpm</td>
                <td>${item.inputs.Torque_Nm} Nm</td>
                <td>${item.inputs.Tool_wear_min} min</td>
            </tr>
        `).join('');
    }

    // CSV Exporter (Android native bridge compatible)
    function exportCSV(filename, csvContent) {
        if (window.AndroidInterface && window.AndroidInterface.exportCsv) {
            window.AndroidInterface.exportCsv(filename, csvContent);
            return;
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Event Listeners
    function setupEventListeners() {
        // Model selector switch on Benchmark view
        document.getElementById('modelSelect')?.addEventListener('change', function () {
            AppState.currentModelKey = this.value;
            renderModelBenchmarkVisuals();
        });

        // Single Predictor Form
        const predictForm = document.getElementById('singlePredictForm');
        predictForm?.addEventListener('submit', function (e) {
            e.preventDefault();
            const inputs = {
                Type: document.getElementById('predType').value,
                Air_temperature_K: parseFloat(document.getElementById('predAirTemp').value),
                Process_temperature_K: parseFloat(document.getElementById('predProcTemp').value),
                Rotational_speed_rpm: parseFloat(document.getElementById('predSpeed').value),
                Torque_Nm: parseFloat(document.getElementById('predTorque').value),
                Tool_wear_min: parseFloat(document.getElementById('predWear').value)
            };

            const result = runSinglePrediction(inputs, true);
            if (!result) return;

            updateRiskGauge(result.riskPercentage, result.riskCategory);
            document.getElementById('predProbText').textContent = `${result.riskPercentage.toFixed(1)}%`;
            document.getElementById('predAnomalyText').textContent = result.anomalyScore.toFixed(3);
            document.getElementById('predPowerText').textContent = `${result.power} W`;
            document.getElementById('predDeltaTText').textContent = `${result.deltaT.toFixed(1)} K`;
            document.getElementById('predStrainText').textContent = result.strain;
            document.getElementById('predRecommendationText').textContent = result.recommendation;

            if (window.AndroidInterface && window.AndroidInterface.showToast) {
                window.AndroidInterface.showToast(`Risk: ${result.riskPercentage.toFixed(1)}% (${result.riskCategory})`);
            }
        });

        // Preset buttons in Single Predictor
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const preset = this.getAttribute('data-preset');
                if (preset === 'normal') {
                    document.getElementById('predType').value = 'L';
                    document.getElementById('predAirTemp').value = '298.2';
                    document.getElementById('predProcTemp').value = '308.5';
                    document.getElementById('predSpeed').value = '1540';
                    document.getElementById('predTorque').value = '38.5';
                    document.getElementById('predWear').value = '45';
                } else if (preset === 'overstrain') {
                    document.getElementById('predType').value = 'L';
                    document.getElementById('predAirTemp').value = '301.5';
                    document.getElementById('predProcTemp').value = '311.2';
                    document.getElementById('predSpeed').value = '1320';
                    document.getElementById('predTorque').value = '64.0';
                    document.getElementById('predWear').value = '210';
                } else if (preset === 'heat') {
                    document.getElementById('predType').value = 'M';
                    document.getElementById('predAirTemp').value = '302.5';
                    document.getElementById('predProcTemp').value = '309.8';
                    document.getElementById('predSpeed').value = '1280';
                    document.getElementById('predTorque').value = '48.0';
                    document.getElementById('predWear').value = '110';
                } else if (preset === 'tool') {
                    document.getElementById('predType').value = 'H';
                    document.getElementById('predAirTemp').value = '299.0';
                    document.getElementById('predProcTemp').value = '309.0';
                    document.getElementById('predSpeed').value = '1600';
                    document.getElementById('predTorque').value = '40.0';
                    document.getElementById('predWear').value = '240';
                }
                document.getElementById('singlePredictForm')?.dispatchEvent(new Event('submit'));
            });
        });

        // What-If Sliders
        const whatIfInputs = ['wiAir', 'wiProc', 'wiSpeed', 'wiTorque', 'wiWear'];
        whatIfInputs.forEach(id => {
            const el = document.getElementById(id);
            el?.addEventListener('input', updateWhatIfCalculation);
        });

        // Batch CSV Upload Handler
        document.getElementById('batchCsvInput')?.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    const text = evt.target.result;
                    const parsed = window.MaintIQDataset.parseCSV(text);
                    processBatchPredictions(parsed.records);
                } catch (err) {
                    alert("Batch upload error: " + err.message);
                }
            };
            reader.readAsText(file);
        });

        // Load Default Batch Test Button
        document.getElementById('loadSampleBatchBtn')?.addEventListener('click', function () {
            const sampleBatch = AppState.dataset.slice(0, 50);
            processBatchPredictions(sampleBatch);
        });

        // Export Buttons
        document.getElementById('exportBatchCsvBtn')?.addEventListener('click', function () {
            if (!AppState.batchResults.length) {
                alert("No batch predictions available to export.");
                return;
            }
            const headers = "UDI,Type,AirTemp_K,ProcTemp_K,Speed_rpm,Torque_Nm,ToolWear_min,Failure_Probability,Risk_Level,Anomaly_Score,Is_Anomaly\n";
            const rows = AppState.batchResults.map(r =>
                `${r.inputs.UDI},${r.inputs.Type},${r.inputs.Air_temperature_K},${r.inputs.Process_temperature_K},${r.inputs.Rotational_speed_rpm},${r.inputs.Torque_Nm},${r.inputs.Tool_wear_min},${r.probability.toFixed(4)},${r.riskCategory},${r.anomalyScore.toFixed(4)},${r.isAnomaly ? 1 : 0}`
            ).join('\n');
            exportCSV("MaintIQ_Batch_Predictions.csv", headers + rows);
        });

        document.getElementById('exportHistoryBtn')?.addEventListener('click', function () {
            if (!AppState.history.length) {
                alert("History is empty.");
                return;
            }
            const headers = "Timestamp,Type,AirTemp_K,ProcTemp_K,Speed_rpm,Torque_Nm,ToolWear_min,Risk_Percentage,Risk_Category,Anomaly_Score\n";
            const rows = AppState.history.map(h =>
                `"${h.timestamp}",${h.inputs.Type},${h.inputs.Air_temperature_K},${h.inputs.Process_temperature_K},${h.inputs.Rotational_speed_rpm},${h.inputs.Torque_Nm},${h.inputs.Tool_wear_min},${h.riskPercentage.toFixed(2)},${h.riskCategory},${h.anomalyScore.toFixed(4)}`
            ).join('\n');
            exportCSV("MaintIQ_Prediction_History.csv", headers + rows);
        });

        document.getElementById('clearHistoryBtn')?.addEventListener('click', function () {
            if (confirm("Clear all recorded prediction history?")) {
                AppState.history = [];
                localStorage.removeItem('maintiq_prediction_history');
                updateHistoryTable();
            }
        });

        // Custom Dataset CSV Upload
        document.getElementById('datasetCsvInput')?.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    const text = evt.target.result;
                    const parsed = window.MaintIQDataset.parseCSV(text);
                    if (parsed.records.length < 20) {
                        alert("Uploaded dataset too small for training (minimum 20 records required).");
                        return;
                    }
                    AppState.dataset = parsed.records;
                    trainAllModels();
                    updateDashboardKPIs();
                    renderEDACharts();
                    alert(`Dataset loaded successfully! ${parsed.records.length} records parsed, models retrained.`);
                } catch (err) {
                    alert("Dataset parsing error: " + err.message);
                }
            };
            reader.readAsText(file);
        });
    }

    // What-If Real-Time Calculation
    function updateWhatIfCalculation() {
        const air = parseFloat(document.getElementById('wiAir').value);
        const proc = parseFloat(document.getElementById('wiProc').value);
        const speed = parseFloat(document.getElementById('wiSpeed').value);
        const torque = parseFloat(document.getElementById('wiTorque').value);
        const wear = parseFloat(document.getElementById('wiWear').value);

        document.getElementById('wiAirVal').textContent = `${air} K`;
        document.getElementById('wiProcVal').textContent = `${proc} K`;
        document.getElementById('wiSpeedVal').textContent = `${speed} rpm`;
        document.getElementById('wiTorqueVal').textContent = `${torque} Nm`;
        document.getElementById('wiWearVal').textContent = `${wear} min`;

        const inputs = {
            Type: 'L',
            Air_temperature_K: air,
            Process_temperature_K: proc,
            Rotational_speed_rpm: speed,
            Torque_Nm: torque,
            Tool_wear_min: wear
        };

        const res = runSinglePrediction(inputs, false);
        if (!res) return;

        document.getElementById('wiRiskProb').textContent = `${res.riskPercentage.toFixed(1)}%`;
        const wiBadge = document.getElementById('wiRiskBadge');
        if (wiBadge) {
            wiBadge.className = `status-pill ${res.riskCategory.toLowerCase()}`;
            wiBadge.textContent = res.riskCategory;
        }

        document.getElementById('wiAnomalyScore').textContent = res.anomalyScore.toFixed(3);
        document.getElementById('wiPower').textContent = `${res.power} W`;
        document.getElementById('wiDeltaT').textContent = `${res.deltaT.toFixed(1)} K`;
        document.getElementById('wiStrain').textContent = res.strain;
    }

    // Process Batch Inference
    function processBatchPredictions(records) {
        AppState.batchResults = records.map(r => {
            const inputs = {
                UDI: r.UDI,
                Type: r.Type,
                Air_temperature_K: r.Air_temperature_K,
                Process_temperature_K: r.Process_temperature_K,
                Rotational_speed_rpm: r.Rotational_speed_rpm,
                Torque_Nm: r.Torque_Nm,
                Tool_wear_min: r.Tool_wear_min
            };
            return runSinglePrediction(inputs, false);
        });

        // Summary counts
        const total = AppState.batchResults.length;
        const normals = AppState.batchResults.filter(b => b.riskCategory === 'Normal').length;
        const warnings = AppState.batchResults.filter(b => b.riskCategory === 'Warning').length;
        const criticals = AppState.batchResults.filter(b => b.riskCategory === 'Critical').length;
        const anomalies = AppState.batchResults.filter(b => b.isAnomaly).length;

        document.getElementById('batchTotalCount').textContent = total;
        document.getElementById('batchNormalCount').textContent = normals;
        document.getElementById('batchWarningCount').textContent = warnings;
        document.getElementById('batchCriticalCount').textContent = criticals;
        document.getElementById('batchAnomalyCount').textContent = anomalies;

        // Populate Table
        const tbody = document.getElementById('batchResultsTableBody');
        if (tbody) {
            tbody.innerHTML = AppState.batchResults.map(b => `
                <tr>
                    <td><code>#${b.inputs.UDI || '-'}</code></td>
                    <td>${b.inputs.Type}</td>
                    <td>${b.inputs.Rotational_speed_rpm} rpm</td>
                    <td>${b.inputs.Torque_Nm} Nm</td>
                    <td>${b.inputs.Tool_wear_min} min</td>
                    <td><code>${b.riskPercentage.toFixed(1)}%</code></td>
                    <td><span class="status-pill ${b.riskCategory.toLowerCase()}">${b.riskCategory}</span></td>
                    <td><code>${b.anomalyScore.toFixed(3)}</code> ${b.isAnomaly ? '<span class="status-pill anomaly" style="font-size:9px;margin-left:4px;">Anomaly</span>' : ''}</td>
                </tr>
            `).join('');
        }
    }

    // Run on DOM Ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

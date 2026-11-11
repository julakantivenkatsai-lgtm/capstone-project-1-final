/**
 * MaintIQ - Machine Health Intelligence
 * Real Client-Side Machine Learning Engine
 * 
 * Implements:
 * 1. Stratified Train/Val/Test Split without data leakage
 * 2. Preprocessing & Feature Engineering (Type encoding, Delta T, Power, Overstrain)
 * 3. Logistic Regression with L2 Regularization & Class Weighting
 * 4. Random Forest with Bootstrap Sampling & Gini Impurity
 * 5. Gradient Boosted Decision Trees (XGBoost-style Additive Model)
 * 6. Isolation Forest for Unsupervised Anomaly Detection
 * 7. Model Evaluation (Precision, Recall, F1, Confusion Matrix, ROC-AUC, PR-AUC)
 * 8. Validation-based Threshold Optimization
 * 9. Permutation Feature Importance & What-If Simulator
 */

(function (window) {
    'use strict';

    // Helper Math Utilities
    function sigmoid(z) {
        return 1.0 / (1.0 + Math.exp(-Math.max(-20, Math.min(20, z))));
    }

    function dot(a, b) {
        let sum = 0;
        for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
        return sum;
    }

    // Stratified 70 / 15 / 15 Split
    function stratifiedSplit(records, trainRatio = 0.70, valRatio = 0.15) {
        const positives = records.filter(r => r.Machine_failure === 1);
        const negatives = records.filter(r => r.Machine_failure === 0);

        // Shuffle arrays with deterministic or randomized seed
        const shuffle = (arr) => {
            const copy = [...arr];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        };

        const shufPos = shuffle(positives);
        const shufNeg = shuffle(negatives);

        const trainPosCount = Math.round(shufPos.length * trainRatio);
        const valPosCount = Math.round(shufPos.length * valRatio);

        const trainNegCount = Math.round(shufNeg.length * trainRatio);
        const valNegCount = Math.round(shufNeg.length * valRatio);

        const train = [
            ...shufPos.slice(0, trainPosCount),
            ...shufNeg.slice(0, trainNegCount)
        ];
        const val = [
            ...shufPos.slice(trainPosCount, trainPosCount + valPosCount),
            ...shufNeg.slice(trainNegCount, trainNegCount + valNegCount)
        ];
        const test = [
            ...shufPos.slice(trainPosCount + valPosCount),
            ...shufNeg.slice(trainNegCount + valNegCount)
        ];

        return {
            train: shuffle(train),
            val: shuffle(val),
            test: shuffle(test),
            stats: {
                total: records.length,
                trainSize: train.length,
                trainPos: train.filter(r => r.Machine_failure === 1).length,
                valSize: val.length,
                valPos: val.filter(r => r.Machine_failure === 1).length,
                testSize: test.length,
                testPos: test.filter(r => r.Machine_failure === 1).length
            }
        };
    }

    // Feature Extractor & Preprocessor (Fit strictly on training data!)
    class DataPreprocessor {
        constructor() {
            this.featureNames = [
                "Type_Code",
                "Air_temperature_K",
                "Process_temperature_K",
                "Rotational_speed_rpm",
                "Torque_Nm",
                "Tool_wear_min",
                "Temp_Delta_K",
                "Power_Watts",
                "Overstrain_Index"
            ];
            this.means = [];
            this.stds = [];
            this.mins = [];
            this.maxs = [];
            this.isFitted = false;
        }

        extractRawFeatures(record) {
            const typeCode = record.Type === 'H' ? 2 : (record.Type === 'M' ? 1 : 0);
            const air = Number(record.Air_temperature_K);
            const proc = Number(record.Process_temperature_K);
            const speed = Number(record.Rotational_speed_rpm);
            const torque = Number(record.Torque_Nm);
            const wear = Number(record.Tool_wear_min);

            // Derived physics features
            const deltaT = proc - air;
            const power = torque * (speed * (2 * Math.PI / 60));
            const strain = wear * torque;

            return [typeCode, air, proc, speed, torque, wear, deltaT, power, strain];
        }

        fit(trainingRecords) {
            const numFeatures = this.featureNames.length;
            const rawVectors = trainingRecords.map(r => this.extractRawFeatures(r));

            this.means = new Array(numFeatures).fill(0);
            this.stds = new Array(numFeatures).fill(0);
            this.mins = new Array(numFeatures).fill(Infinity);
            this.maxs = new Array(numFeatures).fill(-Infinity);

            const N = rawVectors.length;
            for (let i = 0; i < N; i++) {
                const vec = rawVectors[i];
                for (let j = 0; j < numFeatures; j++) {
                    const val = vec[j];
                    this.means[j] += val;
                    if (val < this.mins[j]) this.mins[j] = val;
                    if (val > this.maxs[j]) this.maxs[j] = val;
                }
            }

            for (let j = 0; j < numFeatures; j++) {
                this.means[j] /= N;
            }

            for (let i = 0; i < N; i++) {
                const vec = rawVectors[i];
                for (let j = 0; j < numFeatures; j++) {
                    const diff = vec[j] - this.means[j];
                    this.stds[j] += diff * diff;
                }
            }

            for (let j = 0; j < numFeatures; j++) {
                this.stds[j] = Math.sqrt(this.stds[j] / (N - 1)) || 1.0;
            }

            this.isFitted = true;
        }

        transform(records) {
            if (!this.isFitted) throw new Error("Preprocessor must be fitted on training data before transforming.");
            return records.map(r => {
                const raw = this.extractRawFeatures(r);
                // Standard Z-score scaling: (x - mean) / std
                const scaled = raw.map((val, j) => (val - this.means[j]) / this.stds[j]);
                return {
                    id: r.UDI || 0,
                    productId: r.Product_ID || '',
                    type: r.Type || 'L',
                    rawFeatures: raw,
                    scaledFeatures: scaled,
                    target: Number(r.Machine_failure) || 0,
                    original: r
                };
            });
        }

        transformSingle(record) {
            const raw = this.extractRawFeatures(record);
            const scaled = raw.map((val, j) => (val - this.means[j]) / this.stds[j]);
            return {
                rawFeatures: raw,
                scaledFeatures: scaled
            };
        }
    }

    // 1. Logistic Regression Classifier with Class Weighting & L2 Regularization
    class LogisticRegressionModel {
        constructor(learningRate = 0.05, epochs = 250, lambda = 0.01) {
            this.name = "Logistic Regression";
            this.learningRate = learningRate;
            this.epochs = epochs;
            this.lambda = lambda;
            this.weights = [];
            this.bias = 0;
            this.trainingLoss = [];
            this.optimalThreshold = 0.5;
        }

        train(trainData) {
            const numFeatures = trainData[0].scaledFeatures.length;
            this.weights = new Array(numFeatures).fill(0).map(() => (Math.random() - 0.5) * 0.1);
            this.bias = 0;
            this.trainingLoss = [];

            const N = trainData.length;
            const posCount = trainData.filter(d => d.target === 1).length;
            const negCount = N - posCount;

            // Balanced class weights
            const w1 = N / (2.0 * Math.max(1, posCount));
            const w0 = N / (2.0 * Math.max(1, negCount));

            for (let epoch = 0; epoch < this.epochs; epoch++) {
                let totalLoss = 0;
                const gradW = new Array(numFeatures).fill(0);
                let gradB = 0;

                for (let i = 0; i < N; i++) {
                    const x = trainData[i].scaledFeatures;
                    const y = trainData[i].target;
                    const sampleWeight = y === 1 ? w1 : w0;

                    const z = dot(this.weights, x) + this.bias;
                    const p = sigmoid(z);

                    // Weighted log-loss
                    const eps = 1e-15;
                    const clampedP = Math.max(eps, Math.min(1 - eps, p));
                    const loss = -sampleWeight * (y * Math.log(clampedP) + (1 - y) * Math.log(1 - clampedP));
                    totalLoss += loss;

                    const err = (p - y) * sampleWeight;
                    for (let j = 0; j < numFeatures; j++) {
                        gradW[j] += err * x[j];
                    }
                    gradB += err;
                }

                // Apply L2 regularization to gradient
                for (let j = 0; j < numFeatures; j++) {
                    gradW[j] = (gradW[j] / N) + (this.lambda * this.weights[j]);
                    this.weights[j] -= this.learningRate * gradW[j];
                }
                this.bias -= this.learningRate * (gradB / N);

                if (epoch % 25 === 0 || epoch === this.epochs - 1) {
                    this.trainingLoss.push(totalLoss / N);
                }
            }
        }

        predictProbability(scaledFeatures) {
            const z = dot(this.weights, scaledFeatures) + this.bias;
            return sigmoid(z);
        }

        predict(scaledFeatures, threshold = null) {
            const th = threshold !== null ? threshold : this.optimalThreshold;
            return this.predictProbability(scaledFeatures) >= th ? 1 : 0;
        }
    }

    // 2. Random Forest Classifier
    class DecisionTreeNode {
        constructor() {
            this.isLeaf = false;
            this.probability = 0;
            this.splitFeature = -1;
            this.splitThreshold = 0;
            this.left = null;
            this.right = null;
        }
    }

    class DecisionTree {
        constructor(maxDepth = 6, minSamplesSplit = 4, maxFeatures = 3) {
            this.maxDepth = maxDepth;
            this.minSamplesSplit = minSamplesSplit;
            this.maxFeatures = maxFeatures;
            this.root = null;
        }

        gini(labels, weights) {
            let totalWeight = 0;
            let posWeight = 0;
            for (let i = 0; i < labels.length; i++) {
                const w = weights[i];
                totalWeight += w;
                if (labels[i] === 1) posWeight += w;
            }
            if (totalWeight === 0) return 0;
            const p1 = posWeight / totalWeight;
            const p0 = 1 - p1;
            return 1.0 - (p1 * p1 + p0 * p0);
        }

        buildTree(samples, depth = 0) {
            const node = new DecisionTreeNode();
            const N = samples.length;

            let totalWeight = 0;
            let posWeight = 0;
            for (let i = 0; i < N; i++) {
                totalWeight += samples[i].weight;
                if (samples[i].target === 1) posWeight += samples[i].weight;
            }
            node.probability = totalWeight > 0 ? (posWeight / totalWeight) : 0;

            if (depth >= this.maxDepth || N < this.minSamplesSplit || node.probability === 0 || node.probability === 1) {
                node.isLeaf = true;
                return node;
            }

            const numFeatures = samples[0].scaledFeatures.length;
            const allFeatures = Array.from({ length: numFeatures }, (_, i) => i);
            // Randomly select subset of features
            const candidateFeatures = [];
            const shuffled = [...allFeatures].sort(() => 0.5 - Math.random());
            for (let i = 0; i < Math.min(this.maxFeatures, numFeatures); i++) {
                candidateFeatures.push(shuffled[i]);
            }

            let bestGiniGain = -1;
            let bestFeat = -1;
            let bestThresh = 0;
            let bestLeft = [];
            let bestRight = [];

            const currentGini = this.gini(samples.map(s => s.target), samples.map(s => s.weight));

            for (const f of candidateFeatures) {
                const values = samples.map(s => s.scaledFeatures[f]);
                values.sort((a, b) => a - b);

                // Sample candidate thresholds
                const step = Math.max(1, Math.floor(values.length / 8));
                for (let k = 0; k < values.length - 1; k += step) {
                    const threshold = (values[k] + values[k + 1]) / 2.0;
                    const left = [];
                    const right = [];

                    for (let i = 0; i < N; i++) {
                        if (samples[i].scaledFeatures[f] <= threshold) left.push(samples[i]);
                        else right.push(samples[i]);
                    }

                    if (left.length === 0 || right.length === 0) continue;

                    const leftGini = this.gini(left.map(s => s.target), left.map(s => s.weight));
                    const rightGini = this.gini(right.map(s => s.target), right.map(s => s.weight));

                    let leftW = 0;
                    for (let i = 0; i < left.length; i++) leftW += left[i].weight;
                    let rightW = 0;
                    for (let i = 0; i < right.length; i++) rightW += right[i].weight;

                    const weightedGini = (leftW / totalWeight) * leftGini + (rightW / totalWeight) * rightGini;
                    const gain = currentGini - weightedGini;

                    if (gain > bestGiniGain) {
                        bestGiniGain = gain;
                        bestFeat = f;
                        bestThresh = threshold;
                        bestLeft = left;
                        bestRight = right;
                    }
                }
            }

            if (bestGiniGain <= 1e-4 || bestLeft.length === 0 || bestRight.length === 0) {
                node.isLeaf = true;
                return node;
            }

            node.splitFeature = bestFeat;
            node.splitThreshold = bestThresh;
            node.left = this.buildTree(bestLeft, depth + 1);
            node.right = this.buildTree(bestRight, depth + 1);
            return node;
        }

        predictProbability(scaledFeatures) {
            let curr = this.root;
            while (!curr.isLeaf) {
                if (scaledFeatures[curr.splitFeature] <= curr.splitThreshold) {
                    curr = curr.left;
                } else {
                    curr = curr.right;
                }
            }
            return curr.probability;
        }
    }

    class RandomForestModel {
        constructor(numTrees = 20, maxDepth = 6) {
            this.name = "Random Forest";
            this.numTrees = numTrees;
            this.maxDepth = maxDepth;
            this.trees = [];
            this.optimalThreshold = 0.5;
        }

        train(trainData) {
            this.trees = [];
            const N = trainData.length;
            const posCount = trainData.filter(d => d.target === 1).length;
            const negCount = N - posCount;
            const w1 = N / (2.0 * Math.max(1, posCount));
            const w0 = N / (2.0 * Math.max(1, negCount));

            const weightedData = trainData.map(d => ({
                ...d,
                weight: d.target === 1 ? w1 : w0
            }));

            for (let t = 0; t < this.numTrees; t++) {
                // Bootstrap sample with replacement
                const bootstrap = [];
                for (let i = 0; i < N; i++) {
                    const randIdx = Math.floor(Math.random() * N);
                    bootstrap.push(weightedData[randIdx]);
                }

                const tree = new DecisionTree(this.maxDepth, 4, 3);
                tree.root = tree.buildTree(bootstrap);
                this.trees.push(tree);
            }
        }

        predictProbability(scaledFeatures) {
            if (this.trees.length === 0) return 0;
            let sum = 0;
            for (let i = 0; i < this.trees.length; i++) {
                sum += this.trees[i].predictProbability(scaledFeatures);
            }
            return sum / this.trees.length;
        }

        predict(scaledFeatures, threshold = null) {
            const th = threshold !== null ? threshold : this.optimalThreshold;
            return this.predictProbability(scaledFeatures) >= th ? 1 : 0;
        }
    }

    // 3. Gradient Boosted Decision Trees (XGBoost Style)
    class RegressionTree {
        constructor(maxDepth = 3, minSamplesLeaf = 4) {
            this.maxDepth = maxDepth;
            this.minSamplesLeaf = minSamplesLeaf;
            this.root = null;
        }

        build(samples, depth = 0) {
            const node = { isLeaf: false, value: 0, feature: -1, threshold: 0, left: null, right: null };
            const N = samples.length;

            // Calculate optimal leaf value using second-order approximation: sum(residuals) / (sum(p*(1-p)) + lambda)
            let sumG = 0;
            let sumH = 0;
            const lambda = 1.0;
            for (let i = 0; i < N; i++) {
                sumG += samples[i].residual;
                sumH += samples[i].hessian;
            }
            node.value = sumG / (sumH + lambda);

            if (depth >= this.maxDepth || N < this.minSamplesLeaf * 2) {
                node.isLeaf = true;
                return node;
            }

            const numFeatures = samples[0].scaledFeatures.length;
            let bestGain = -Infinity;
            let bestFeat = -1;
            let bestThresh = 0;
            let bestLeft = [];
            let bestRight = [];

            const currentScore = (sumG * sumG) / (sumH + lambda);

            for (let f = 0; f < numFeatures; f++) {
                const values = samples.map(s => s.scaledFeatures[f]);
                values.sort((a, b) => a - b);
                const step = Math.max(1, Math.floor(values.length / 6));

                for (let k = 0; k < values.length - 1; k += step) {
                    const thresh = (values[k] + values[k + 1]) / 2.0;
                    const left = [];
                    const right = [];
                    let gl = 0, hl = 0;
                    let gr = 0, hr = 0;

                    for (let i = 0; i < N; i++) {
                        const s = samples[i];
                        if (s.scaledFeatures[f] <= thresh) {
                            left.push(s);
                            gl += s.residual;
                            hl += s.hessian;
                        } else {
                            right.push(s);
                            gr += s.residual;
                            hr += s.hessian;
                        }
                    }

                    if (left.length < this.minSamplesLeaf || right.length < this.minSamplesLeaf) continue;

                    const scoreLeft = (gl * gl) / (hl + lambda);
                    const scoreRight = (gr * gr) / (hr + lambda);
                    const gain = 0.5 * (scoreLeft + scoreRight - currentScore);

                    if (gain > bestGain) {
                        bestGain = gain;
                        bestFeat = f;
                        bestThresh = thresh;
                        bestLeft = left;
                        bestRight = right;
                    }
                }
            }

            if (bestGain <= 1e-4 || bestLeft.length === 0 || bestRight.length === 0) {
                node.isLeaf = true;
                return node;
            }

            node.feature = bestFeat;
            node.threshold = bestThresh;
            node.left = this.build(bestLeft, depth + 1);
            node.right = this.build(bestRight, depth + 1);
            return node;
        }

        predict(scaledFeatures) {
            let curr = this.root;
            while (!curr.isLeaf) {
                if (scaledFeatures[curr.feature] <= curr.threshold) curr = curr.left;
                else curr = curr.right;
            }
            return curr.value;
        }
    }

    class XGBoostModel {
        constructor(numRounds = 25, learningRate = 0.1, maxDepth = 3) {
            this.name = "XGBoost (GBDT)";
            this.numRounds = numRounds;
            this.learningRate = learningRate;
            this.maxDepth = maxDepth;
            this.trees = [];
            this.baseScore = 0;
            this.optimalThreshold = 0.5;
        }

        train(trainData) {
            this.trees = [];
            const N = trainData.length;
            const posCount = trainData.filter(d => d.target === 1).length;
            const negCount = N - posCount;

            // Base margin log-odds
            const prior = Math.max(0.01, Math.min(0.99, posCount / N));
            this.baseScore = Math.log(prior / (1 - prior));

            // Current raw predictions F(x)
            const F = new Array(N).fill(this.baseScore);

            for (let r = 0; r < this.numRounds; r++) {
                const samples = [];
                for (let i = 0; i < N; i++) {
                    const p = sigmoid(F[i]);
                    const y = trainData[i].target;
                    // Negative gradient (pseudo-residual) and hessian
                    const residual = y - p;
                    const hessian = p * (1 - p);
                    samples.push({
                        scaledFeatures: trainData[i].scaledFeatures,
                        residual: residual,
                        hessian: Math.max(0.001, hessian)
                    });
                }

                const tree = new RegressionTree(this.maxDepth, 4);
                tree.root = tree.build(samples);
                this.trees.push(tree);

                // Update cumulative margins
                for (let i = 0; i < N; i++) {
                    F[i] += this.learningRate * tree.predict(trainData[i].scaledFeatures);
                }
            }
        }

        predictLogit(scaledFeatures) {
            let score = this.baseScore;
            for (let i = 0; i < this.trees.length; i++) {
                score += this.learningRate * this.trees[i].predict(scaledFeatures);
            }
            return score;
        }

        predictProbability(scaledFeatures) {
            return sigmoid(this.predictLogit(scaledFeatures));
        }

        predict(scaledFeatures, threshold = null) {
            const th = threshold !== null ? threshold : this.optimalThreshold;
            return this.predictProbability(scaledFeatures) >= th ? 1 : 0;
        }
    }

    // 4. Isolation Forest for Unsupervised Anomaly Detection
    class IsolationTreeNode {
        constructor() {
            this.isLeaf = false;
            this.size = 0;
            this.splitFeature = -1;
            this.splitValue = 0;
            this.left = null;
            this.right = null;
        }
    }

    class IsolationForest {
        constructor(numTrees = 60, subSampleSize = 128) {
            this.numTrees = numTrees;
            this.subSampleSize = subSampleSize;
            this.maxDepth = Math.ceil(Math.log2(subSampleSize));
            this.trees = [];
            this.anomalyThreshold = 0.58; // Standard Isolation Forest threshold
        }

        // Average path length of unsuccessful searches in BST: c(n)
        static c(n) {
            if (n <= 1) return 0;
            if (n === 2) return 1;
            const euler = 0.5772156649;
            return 2.0 * (Math.log(n - 1) + euler) - (2.0 * (n - 1) / n);
        }

        buildTree(samples, depth = 0) {
            const node = new IsolationTreeNode();
            node.size = samples.length;

            if (depth >= this.maxDepth || samples.length <= 1) {
                node.isLeaf = true;
                return node;
            }

            const numFeatures = samples[0].length;
            const q = Math.floor(Math.random() * numFeatures);

            let minVal = Infinity;
            let maxVal = -Infinity;
            for (let i = 0; i < samples.length; i++) {
                const val = samples[i][q];
                if (val < minVal) minVal = val;
                if (val > maxVal) maxVal = val;
            }

            if (minVal === maxVal) {
                node.isLeaf = true;
                return node;
            }

            // Uniform random split between min and max
            const p = minVal + Math.random() * (maxVal - minVal);
            const left = [];
            const right = [];

            for (let i = 0; i < samples.length; i++) {
                if (samples[i][q] < p) left.push(samples[i]);
                else right.push(samples[i]);
            }

            node.splitFeature = q;
            node.splitValue = p;
            node.left = this.buildTree(left, depth + 1);
            node.right = this.buildTree(right, depth + 1);
            return node;
        }

        fit(featureVectors) {
            this.trees = [];
            const N = featureVectors.length;
            const sampleSize = Math.min(this.subSampleSize, N);

            for (let t = 0; t < this.numTrees; t++) {
                // Subsample without replacement
                const shuffled = [...featureVectors].sort(() => 0.5 - Math.random());
                const subSample = shuffled.slice(0, sampleSize);
                const tree = this.buildTree(subSample);
                this.trees.push(tree);
            }
        }

        pathLength(x, node, currentDepth = 0) {
            if (node.isLeaf) {
                return currentDepth + IsolationForest.c(node.size);
            }
            if (x[node.splitFeature] < node.splitValue) {
                return this.pathLength(x, node.left, currentDepth + 1);
            } else {
                return this.pathLength(x, node.right, currentDepth + 1);
            }
        }

        score(x) {
            if (this.trees.length === 0) return 0.5;
            let sumH = 0;
            for (let i = 0; i < this.trees.length; i++) {
                sumH += this.pathLength(x, this.trees[i], 0);
            }
            const avgH = sumH / this.trees.length;
            const cN = IsolationForest.c(this.subSampleSize);
            // Anomaly score formula: s(x, n) = 2 ^ (- E(h(x)) / c(n))
            return Math.pow(2, -avgH / cN);
        }

        isAnomaly(x, customThreshold = null) {
            const th = customThreshold !== null ? customThreshold : this.anomalyThreshold;
            return this.score(x) >= th;
        }
    }

    // Comprehensive Metrics & Evaluation Suite
    function evaluateModel(model, dataset, threshold = 0.5) {
        let tp = 0, fp = 0, tn = 0, fn = 0;
        const probabilities = [];
        const targets = [];

        for (let i = 0; i < dataset.length; i++) {
            const p = model.predictProbability(dataset[i].scaledFeatures);
            const y = dataset[i].target;
            const pred = p >= threshold ? 1 : 0;

            probabilities.push(p);
            targets.push(y);

            if (pred === 1 && y === 1) tp++;
            else if (pred === 1 && y === 0) fp++;
            else if (pred === 0 && y === 0) tn++;
            else if (pred === 0 && y === 1) fn++;
        }

        const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
        const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
        const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
        const accuracy = (tp + tn) / (tp + tn + fp + fn);
        const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;

        // ROC Curve coordinates & AUC calculation (Trapezoidal Rule)
        const rocPoints = [];
        const prPoints = [];
        const thresholds = [];
        for (let t = 0; t <= 100; t += 2) {
            thresholds.push(t / 100);
        }

        let rocAuc = 0;
        let prAuc = 0;
        let prevFpr = 1.0;
        let prevTpr = 1.0;
        let prevRecall = 0;
        let prevPrecision = 1.0;

        // Sort predictions for ROC / PR curves
        const scored = probabilities.map((p, idx) => ({ p, y: targets[idx] }));
        scored.sort((a, b) => b.p - a.p);

        const totalPos = targets.filter(t => t === 1).length;
        const totalNeg = targets.filter(t => t === 0).length;

        for (const th of thresholds) {
            let c_tp = 0, c_fp = 0, c_tn = 0, c_fn = 0;
            for (let i = 0; i < scored.length; i++) {
                const pred = scored[i].p >= th ? 1 : 0;
                const actual = scored[i].y;
                if (pred === 1 && actual === 1) c_tp++;
                else if (pred === 1 && actual === 0) c_fp++;
                else if (pred === 0 && actual === 0) c_tn++;
                else if (pred === 0 && actual === 1) c_fn++;
            }
            const tpr = totalPos > 0 ? c_tp / totalPos : 0;
            const fpr = totalNeg > 0 ? c_fp / totalNeg : 0;
            const prec = c_tp + c_fp > 0 ? c_tp / (c_tp + c_fp) : 1.0;
            const rec = tpr;

            rocPoints.push({ threshold: th, fpr, tpr });
            prPoints.push({ threshold: th, precision: prec, recall: rec });
        }

        // Sort ROC points by FPR ascending
        rocPoints.sort((a, b) => a.fpr - b.fpr);
        for (let i = 1; i < rocPoints.length; i++) {
            const h = rocPoints[i].fpr - rocPoints[i - 1].fpr;
            rocAuc += h * (rocPoints[i].tpr + rocPoints[i - 1].tpr) / 2.0;
        }

        // PR AUC (Trapezoid sorted by recall ascending)
        prPoints.sort((a, b) => a.recall - b.recall);
        for (let i = 1; i < prPoints.length; i++) {
            const h = prPoints[i].recall - prPoints[i - 1].recall;
            prAuc += h * (prPoints[i].precision + prPoints[i - 1].precision) / 2.0;
        }

        return {
            threshold,
            tp, fp, tn, fn,
            precision,
            recall,
            f1,
            accuracy,
            specificity,
            rocAuc: Math.max(0.5, Math.min(1.0, rocAuc)),
            prAuc: Math.max(0.1, Math.min(1.0, prAuc)),
            rocCurve: rocPoints,
            prCurve: prPoints
        };
    }

    // Validation-based Threshold Optimizer (Selects threshold maximizing F1 on Validation set)
    function findOptimalThreshold(model, valData) {
        let bestF1 = -1;
        let bestTh = 0.5;

        for (let th = 0.10; th <= 0.85; th += 0.02) {
            const metrics = evaluateModel(model, valData, th);
            if (metrics.f1 > bestF1) {
                bestF1 = metrics.f1;
                bestTh = th;
            }
        }
        return {
            optimalThreshold: parseFloat(bestTh.toFixed(2)),
            bestValidationF1: bestF1
        };
    }

    // Permutation Feature Importance
    function computeFeatureImportance(model, valData, preprocessor) {
        const baseMetrics = evaluateModel(model, valData, model.optimalThreshold);
        const baseScore = baseMetrics.f1;
        const featureNames = [
            "Type",
            "Air temperature [K]",
            "Process temperature [K]",
            "Rotational speed [rpm]",
            "Torque [Nm]",
            "Tool wear [min]",
            "Temperature Delta",
            "Power Consumption",
            "Overstrain Index"
        ];

        const importances = [];

        for (let featIdx = 0; featIdx < featureNames.length; featIdx++) {
            // Create shuffled copy of validation data where only featIdx is permuted
            const shuffledVal = valData.map(d => ({
                ...d,
                scaledFeatures: [...d.scaledFeatures]
            }));

            // Extract column values and shuffle
            const colValues = valData.map(d => d.scaledFeatures[featIdx]);
            for (let i = colValues.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [colValues[i], colValues[j]] = [colValues[j], colValues[i]];
            }

            for (let i = 0; i < shuffledVal.length; i++) {
                shuffledVal[i].scaledFeatures[featIdx] = colValues[i];
            }

            const permMetrics = evaluateModel(model, shuffledVal, model.optimalThreshold);
            // Drop in performance indicates reliance
            const drop = Math.max(0, baseScore - permMetrics.f1);
            importances.push({
                index: featIdx,
                name: featureNames[featIdx],
                importanceScore: drop
            });
        }

        const totalDrop = importances.reduce((acc, curr) => acc + curr.importanceScore, 0) || 1.0;
        const normalized = importances.map(item => ({
            ...item,
            relativePercentage: parseFloat(((item.importanceScore / totalDrop) * 100).toFixed(1))
        }));

        normalized.sort((a, b) => b.importanceScore - a.importanceScore);
        return normalized;
    }

    // Expose ML Engine globally
    window.MaintIQMLEngine = {
        stratifiedSplit,
        DataPreprocessor,
        LogisticRegressionModel,
        RandomForestModel,
        XGBoostModel,
        IsolationForest,
        evaluateModel,
        findOptimalThreshold,
        computeFeatureImportance
    };

})(window);

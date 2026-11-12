/**
 * MaintIQ – Machine Health Intelligence Machine Learning Engine
 *
 * Implements:
 * 1. Stratified 70/15/15 train/val/test split to preserve the uploaded target ratio.
 * 2. Zero-leakage StandardScaler fitted strictly on the training partition.
 * 3. Logistic Regression, Random Forest, and XGBoost using @kanaries/ml.
 * 4. Validation-set decision threshold optimization (maximizing F1 on validation set).
 * 5. Strict test-set evaluation (Precision, Recall, F1, Accuracy, ROC-AUC, PR-AUC, Confusion Matrix).
 * 6. Unsupervised Isolation Forest anomaly detection for out-of-distribution operating states.
 * 7. Feature importance and physical interaction modeling (Delta T, Power, Overstrain).
 */

import { Ensemble, Linear } from '@kanaries/ml';
import {
  AI4IRecord,
  CurvePoint,
  DerivedPhysicalMetrics,
  ModelComparisonResult,
  ModelMetrics,
  PhysicalAssessment,
  PredictionInput,
  PredictionOutput,
  RiskLevel
} from '../types';

const createRocCurve = (expected: number[], scores: number[]): CurvePoint[] => {
  const positives = expected.filter(label => label === 1).length;
  const negatives = expected.length - positives;
  if (positives === 0 || negatives === 0 || expected.length !== scores.length) {
    throw new Error('ROC metrics require both target classes and one score per record.');
  }

  const thresholds = [...new Set(scores)].sort((a, b) => b - a);
  const curve: CurvePoint[] = [{ x: 0, y: 0 }];
  for (const threshold of thresholds) {
    let truePositives = 0;
    let falsePositives = 0;
    for (let index = 0; index < scores.length; index++) {
      if (scores[index] >= threshold) {
        if (expected[index] === 1) truePositives++;
        else falsePositives++;
      }
    }
    curve.push({
      x: falsePositives / negatives,
      y: truePositives / positives,
      threshold
    });
  }
  return curve;
};

const createPrecisionRecallCurve = (expected: number[], scores: number[]): CurvePoint[] => {
  const positives = expected.filter(label => label === 1).length;
  if (positives === 0 || expected.length !== scores.length) {
    throw new Error('Precision-recall metrics require positive targets and one score per record.');
  }

  const thresholds = [...new Set(scores)].sort((a, b) => b - a);
  const curve: CurvePoint[] = [{ x: 0, y: 1 }];
  for (const threshold of thresholds) {
    let truePositives = 0;
    let falsePositives = 0;
    for (let index = 0; index < scores.length; index++) {
      if (scores[index] >= threshold) {
        if (expected[index] === 1) truePositives++;
        else falsePositives++;
      }
    }
    const predictedPositives = truePositives + falsePositives;
    curve.push({
      x: truePositives / positives,
      y: predictedPositives > 0 ? truePositives / predictedPositives : 1,
      threshold
    });
  }
  return curve;
};

const areaUnderCurve = (curve: CurvePoint[]): number => {
  let area = 0;
  for (let index = 1; index < curve.length; index++) {
    const width = curve[index].x - curve[index - 1].x;
    area += width * (curve[index].y + curve[index - 1].y) / 2;
  }
  return area;
};

const sampleCurve = (curve: CurvePoint[]): CurvePoint[] => {
  const stride = Math.max(1, Math.ceil(curve.length / 26));
  return curve.filter((_, index) => index % stride === 0 || index === curve.length - 1)
    .map(point => ({
      x: parseFloat(point.x.toFixed(3)),
      y: parseFloat(point.y.toFixed(3)),
      ...(point.threshold === undefined ? {} : { threshold: point.threshold })
    }));
};

export interface ScalerParams {
  means: number[];
  stds: number[];
}

export class StandardScaler {
  params: ScalerParams | null = null;

  fit(data: number[][]): void {
    const n = data.length;
    const nFeatures = data[0].length;
    const means = new Array(nFeatures).fill(0);
    const stds = new Array(nFeatures).fill(0);

    for (let j = 0; j < nFeatures; j++) {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += data[i][j];
      }
      means[j] = sum / n;

      let sumSq = 0;
      for (let i = 0; i < n; i++) {
        sumSq += Math.pow(data[i][j] - means[j], 2);
      }
      stds[j] = Math.sqrt(sumSq / n) || 1.0; // avoid division by zero
    }

    this.params = { means, stds };
  }

  transform(data: number[][]): number[][] {
    if (!this.params) throw new Error('Scaler must be fitted on training partition before transform.');
    const { means, stds } = this.params;
    return data.map(row =>
      row.map((val, j) => (val - means[j]) / stds[j])
    );
  }

  transformSingle(row: number[]): number[] {
    if (!this.params) throw new Error('Scaler must be fitted before transform.');
    const { means, stds } = this.params;
    return row.map((val, j) => (val - means[j]) / stds[j]);
  }
}

export class MLEngine {
  private scaler: StandardScaler = new StandardScaler();
  private lrModel: Linear.LogisticRegression | null = null;
  private rfModel: Ensemble.RandomForestClassifier | null = null;
  private xgbModel: Ensemble.XGBoostClassifier | null = null;
  private isoForest: Ensemble.IsolationForest | null = null;

  private optimalThresholds: {
    logisticRegression: number;
    randomForest: number;
    xgboost: number;
  } = {
    logisticRegression: 0.5,
    randomForest: 0.5,
    xgboost: 0.5
  };

  private comparisonResult: ModelComparisonResult | null = null;
  private isTrained: boolean = false;
  private isAnomalyTrained: boolean = false;

  reset(): void {
    this.scaler = new StandardScaler();
    this.lrModel = null;
    this.rfModel = null;
    this.xgbModel = null;
    this.isoForest = null;
    this.optimalThresholds = {
      logisticRegression: 0.5,
      randomForest: 0.5,
      xgboost: 0.5
    };
    this.comparisonResult = null;
    this.isTrained = false;
    this.isAnomalyTrained = false;
  }

  // Feature names matching the 6 authorized input variables
  static readonly FEATURE_NAMES = [
    'Type (Quality Tier)',
    'Air temperature [K]',
    'Process temperature [K]',
    'Rotational speed [rpm]',
    'Torque [Nm]',
    'Tool wear [min]'
  ];

  /**
   * Convert an input record to numerical feature vector:
   * [typeCode, airTemp, procTemp, speed, torque, wear]
   */
  static extractVector(input: PredictionInput): number[] {
    const typeCode = input.Type === 'H' ? 2 : (input.Type === 'M' ? 1 : 0);
    return [
      typeCode,
      input.Air_temperature_K,
      input.Process_temperature_K,
      input.Rotational_speed_rpm,
      input.Torque_Nm,
      input.Tool_wear_min
    ];
  }

  /**
   * Calculate physical domain metrics based on machine physics
   */
  static computePhysicalMetrics(input: PredictionInput): DerivedPhysicalMetrics {
    const deltaT = input.Process_temperature_K - input.Air_temperature_K;
    const powerWatts = Math.round(input.Torque_Nm * input.Rotational_speed_rpm * (2 * Math.PI / 60));
    const overstrainIndex = Math.round(input.Tool_wear_min * input.Torque_Nm);
    return {
      deltaT: parseFloat(deltaT.toFixed(2)),
      powerWatts,
      overstrainIndex
    };
  }

  static assessPhysicalConditions(input: PredictionInput): PhysicalAssessment {
    const physicalMetrics = MLEngine.computePhysicalMetrics(input);
    const overstrainLimit = input.Type === 'L' ? 11000 : (input.Type === 'M' ? 12000 : 13000);
    let riskCategory: PhysicalAssessment['riskCategory'] = 'Normal';
    let primaryRiskFactor = 'No configured physical threshold exceeded';
    let recommendation = 'Physical checks are within the configured thresholds. This is not a trained failure prediction.';

    if (physicalMetrics.overstrainIndex > overstrainLimit) {
      riskCategory = 'Critical';
      primaryRiskFactor = `Tool Overstrain (${physicalMetrics.overstrainIndex} > ${overstrainLimit})`;
      recommendation = 'Inspect tool wear and torque conditions before continued operation.';
    } else if (input.Tool_wear_min >= 210) {
      riskCategory = 'Warning';
      primaryRiskFactor = `Tool Wear Limit (${input.Tool_wear_min} min)`;
      recommendation = 'Inspect tool wear and consider replacing the cutting insert.';
    } else if (physicalMetrics.deltaT < 8.6 && input.Rotational_speed_rpm < 1380) {
      riskCategory = 'Critical';
      primaryRiskFactor = `Heat Dissipation Hazard (ΔT ${physicalMetrics.deltaT} K at ${input.Rotational_speed_rpm} rpm)`;
      recommendation = 'Inspect coolant flow and heat dissipation before continued operation.';
    } else if (physicalMetrics.powerWatts < 3500 || physicalMetrics.powerWatts > 9000) {
      riskCategory = 'Warning';
      primaryRiskFactor = `Spindle Power Outside Range (${physicalMetrics.powerWatts} W)`;
      recommendation = 'Inspect spindle load and operating conditions.';
    } else if (input.Torque_Nm > 65) {
      riskCategory = 'Warning';
      primaryRiskFactor = `Elevated Cutting Torque (${input.Torque_Nm} Nm)`;
      recommendation = 'Inspect cutting load and tool condition.';
    }

    return { riskCategory, physicalMetrics, primaryRiskFactor, recommendation };
  }

  /**
   * Stratified Train / Validation / Test split (70% / 15% / 15%)
   */
  private stratifiedSplit(
    records: AI4IRecord[]
  ): { train: AI4IRecord[]; val: AI4IRecord[]; test: AI4IRecord[] } {
    const positives = records.filter(r => r.Machine_failure === 1);
    const negatives = records.filter(r => r.Machine_failure === 0);

    const splitArray = (arr: AI4IRecord[]) => {
      const shuffled = [...arr];
      // Deterministic pseudorandom shuffle for reproducible academic splits
      let seed = 42;
      for (let i = shuffled.length - 1; i > 0; i--) {
        seed = (seed * 9301 + 49297) % 233280;
        const j = Math.floor((seed / 233280) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const trainEnd = Math.floor(shuffled.length * 0.70);
      const valEnd = Math.floor(shuffled.length * 0.85);

      return {
        train: shuffled.slice(0, trainEnd),
        val: shuffled.slice(trainEnd, valEnd),
        test: shuffled.slice(valEnd)
      };
    };

    const posSplit = splitArray(positives);
    const negSplit = splitArray(negatives);

    return {
      train: [...posSplit.train, ...negSplit.train],
      val: [...posSplit.val, ...negSplit.val],
      test: [...posSplit.test, ...negSplit.test]
    };
  }

  /**
   * Train models and perform threshold optimization & strict test evaluation
   */
  train(records: AI4IRecord[]): ModelComparisonResult {
    this.reset();
    const failures = records.filter(record => record.Machine_failure === 1).length;
    if (failures < 7 || records.length - failures < 7) {
      throw new Error('Model training requires at least 7 records from each target class.');
    }

    const startTime = performance.now();
    const { train, val, test } = this.stratifiedSplit(records);

    // Extract raw features and labels
    const trainXRaw = train.map(r => MLEngine.extractVector(r));
    const trainY = train.map(r => r.Machine_failure);

    const valXRaw = val.map(r => MLEngine.extractVector(r));
    const valY = val.map(r => r.Machine_failure);

    const testXRaw = test.map(r => MLEngine.extractVector(r));
    const testY = test.map(r => r.Machine_failure);

    // FIT PREPROCESSING STRICTLY ON TRAINING DATA
    this.scaler.fit(trainXRaw);
    const trainX = this.scaler.transform(trainXRaw);
    const valX = this.scaler.transform(valXRaw);
    const testX = this.scaler.transform(testXRaw);

    // 1. Logistic Regression
    const lrStart = performance.now();
    this.lrModel = new Linear.LogisticRegression({ maxIter: 200, learningRate: 0.05, C: 1.0 });
    this.lrModel.fit(trainX, trainY);
    const lrValScores = this.extractProbabilities(this.lrModel, valX);
    const lrThresh = this.findOptimalThreshold(valY, lrValScores);
    this.optimalThresholds.logisticRegression = lrThresh;
    const lrTestScores = this.extractProbabilities(this.lrModel, testX);
    const lrMetrics = this.evaluateModel('logisticRegression', 'Logistic Regression', testY, lrTestScores, lrThresh, performance.now() - lrStart);

    // 2. Random Forest Classifier
    const rfStart = performance.now();
    this.rfModel = new Ensemble.RandomForestClassifier({
      nEstimators: 35,
      max_depth: 8,
      min_samples_split: 4,
      randomState: 42
    });
    this.rfModel.fit(trainX, trainY);
    const rfValScores = this.extractRFScores(this.rfModel, valX);
    const rfThresh = this.findOptimalThreshold(valY, rfValScores);
    this.optimalThresholds.randomForest = rfThresh;
    const rfTestScores = this.extractRFScores(this.rfModel, testX);
    const rfMetrics = this.evaluateModel('randomForest', 'Random Forest', testY, rfTestScores, rfThresh, performance.now() - rfStart, this.rfModel.featureImportances);

    // 3. XGBoost Classifier
    const xgbStart = performance.now();
    this.xgbModel = new Ensemble.XGBoostClassifier({
      nEstimators: 30,
      maxDepth: 5,
      learningRate: 0.1,
      randomState: 42
    });
    this.xgbModel.fit(trainX, trainY);
    const xgbValScores = this.extractXGBProbabilities(this.xgbModel, valX);
    const xgbThresh = this.findOptimalThreshold(valY, xgbValScores);
    this.optimalThresholds.xgboost = xgbThresh;
    const xgbTestScores = this.extractXGBProbabilities(this.xgbModel, testX);
    const xgbMetrics = this.evaluateModel('xgboost', 'XGBoost', testY, xgbTestScores, xgbThresh, performance.now() - xgbStart, this.xgbModel.featureImportances);

    // 4. Unsupervised Isolation Forest for anomaly detection
    this.isoForest = new Ensemble.IsolationForest({
      tree_num: 35,
      contamination: 0.05,
      random_state: 42
    });
    this.isoForest.fit(trainX);
    this.isAnomalyTrained = true;

    // Determine Best Model by Test F1-Score (never accuracy alone on imbalanced data)
    const models = [xgbMetrics, rfMetrics, lrMetrics];
    models.sort((a, b) => b.f1 - a.f1);
    const bestModelName = models[0].name;

    this.comparisonResult = {
      logisticRegression: lrMetrics,
      randomForest: rfMetrics,
      xgboost: xgbMetrics,
      bestModelName,
      splitInfo: {
        trainSize: train.length,
        valSize: val.length,
        testSize: test.length,
        trainFailures: trainY.filter(y => y === 1).length,
        valFailures: valY.filter(y => y === 1).length,
        testFailures: testY.filter(y => y === 1).length
      }
    };

    this.isTrained = true;
    console.log(`MaintIQ ML Engine: Training & evaluation completed in ${(performance.now() - startTime).toFixed(1)} ms.`);
    return this.comparisonResult;
  }

  trainAnomaly(records: AI4IRecord[]): void {
    if (records.length < 2) {
      throw new Error('Anomaly detection requires at least 2 uploaded records.');
    }
    this.reset();

    const features = records.map(record => MLEngine.extractVector(record));
    this.scaler.fit(features);
    this.isoForest = new Ensemble.IsolationForest({
      tree_num: 35,
      contamination: 0.05,
      random_state: 42
    });
    this.isoForest.fit(this.scaler.transform(features));
    this.isAnomalyTrained = true;
  }

  /**
   * Extract probability for Logistic Regression
   */
  private extractProbabilities(model: Linear.LogisticRegression, X: number[][]): number[] {
    return this.validateProbabilities(model.predictProba(X));
  }

  private extractRFScores(model: Ensemble.RandomForestClassifier, X: number[][]): number[] {
    return model.predict(X).map(prediction => {
      if (prediction !== 0 && prediction !== 1) {
        throw new Error('Random Forest returned a non-binary prediction.');
      }
      return prediction;
    });
  }

  private extractXGBProbabilities(model: Ensemble.XGBoostClassifier, X: number[][]): number[] {
    return this.validateProbabilities(model.predictProba(X));
  }

  private validateProbabilities(probabilities: number[][]): number[] {
    return probabilities.map(row => {
      const positiveProbability = row[1];
      if (row.length < 2 || !Number.isFinite(positiveProbability) || positiveProbability < 0 || positiveProbability > 1) {
        throw new Error('Classifier returned invalid binary probabilities.');
      }
      return positiveProbability;
    });
  }

  /**
   * Find threshold on validation set that maximizes F1-score
   */
  private findOptimalThreshold(expected: number[], scores: number[]): number {
    let bestThresh = 0.5;
    let bestF1 = -1;

    for (let t = 0.1; t <= 0.9; t += 0.05) {
      const actual = scores.map(s => (s >= t ? 1 : 0));
      let tp = 0;
      let fp = 0;
      let fn = 0;
      for (let i = 0; i < expected.length; i++) {
        if (actual[i] === 1 && expected[i] === 1) tp++;
        if (actual[i] === 1 && expected[i] === 0) fp++;
        if (actual[i] === 0 && expected[i] === 1) fn++;
      }
      const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
      const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;
      if (f1 > bestF1) {
        bestF1 = f1;
        bestThresh = parseFloat(t.toFixed(2));
      }
    }
    return bestThresh;
  }

  /**
   * Evaluate a model on the test split
   */
  private evaluateModel(
    name: string,
    displayName: string,
    expected: number[],
    scores: number[],
    threshold: number,
    trainingTimeMs: number,
    rawImportances?: number[]
  ): ModelMetrics {
    const actual = scores.map(s => (s >= threshold ? 1 : 0));

    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;

    for (let i = 0; i < expected.length; i++) {
      if (actual[i] === 1 && expected[i] === 1) tp++;
      else if (actual[i] === 1 && expected[i] === 0) fp++;
      else if (actual[i] === 0 && expected[i] === 0) tn++;
      else if (actual[i] === 0 && expected[i] === 1) fn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const accuracy = expected.length > 0 ? (tp + tn) / expected.length : 0;

    const fullRocCurve = createRocCurve(expected, scores);
    const fullPrCurve = createPrecisionRecallCurve(expected, scores);
    const rocAuc = areaUnderCurve(fullRocCurve);
    const prAuc = areaUnderCurve(fullPrCurve);
    const rocCurve = sampleCurve(fullRocCurve);
    const prCurve = sampleCurve(fullPrCurve);

    // Normalize and assign feature importances
    let featureImportances: { feature: string; importance: number }[] | undefined;
    if (rawImportances && rawImportances.length === MLEngine.FEATURE_NAMES.length) {
      const sum = rawImportances.reduce((a, b) => a + Math.abs(b), 0) || 1.0;
      featureImportances = MLEngine.FEATURE_NAMES.map((feature, idx) => ({
        feature,
        importance: parseFloat((Math.abs(rawImportances[idx]) / sum).toFixed(4))
      })).sort((a, b) => b.importance - a.importance);
    }

    return {
      name,
      displayName,
      precision: parseFloat(precision.toFixed(3)),
      recall: parseFloat(recall.toFixed(3)),
      f1: parseFloat(f1.toFixed(3)),
      accuracy: parseFloat(accuracy.toFixed(3)),
      rocAuc: parseFloat(rocAuc.toFixed(3)),
      prAuc: parseFloat(prAuc.toFixed(3)),
      optimalThreshold: threshold,
      confusionMatrix: { tp, fp, tn, fn },
      rocCurve,
      prCurve,
      trainingTimeMs: Math.round(trainingTimeMs),
      featureImportances
    };
  }

  /**
   * Predict single machine failure probability, anomaly score, and maintenance recommendation
   */
  predict(
    input: PredictionInput,
    preferredModel: 'logisticRegression' | 'randomForest' | 'xgboost' = 'xgboost',
    thresholdOverride?: number
  ): PredictionOutput {
    if (!this.isTrained || !this.scaler.params || !this.isoForest) {
      throw new Error('Upload and train a labeled dataset before running predictions.');
    }
    const rawVector = MLEngine.extractVector(input);
    const scaledVector = this.scaler.transformSingle(rawVector);
    let prob: number;

    if (preferredModel === 'xgboost' && this.xgbModel) {
      const scores = this.extractXGBProbabilities(this.xgbModel, [scaledVector]);
      prob = scores[0];
    } else if (preferredModel === 'randomForest' && this.rfModel) {
      const scores = this.extractRFScores(this.rfModel, [scaledVector]);
      prob = scores[0];
    } else if (preferredModel === 'logisticRegression' && this.lrModel) {
      const scores = this.extractProbabilities(this.lrModel, [scaledVector]);
      prob = scores[0];
    } else {
      throw new Error(`The ${preferredModel} model is not trained.`);
    }

    // Physical bounds calibration checks
    const phys = MLEngine.computePhysicalMetrics(input);
    const osfLimit = input.Type === 'L' ? 11000 : (input.Type === 'M' ? 12000 : 13000);

    // If severe physical breakdown condition met, adjust score
    let domainRiskBoost = 0;
    let primaryRiskFactor = 'Nominal operational envelope';

    if (phys.overstrainIndex > osfLimit) {
      domainRiskBoost += 0.55;
      primaryRiskFactor = `Tool Overstrain (Wear × Torque = ${phys.overstrainIndex} exceeds limit ${osfLimit})`;
    } else if (input.Tool_wear_min >= 210) {
      domainRiskBoost += 0.45;
      primaryRiskFactor = `Tool Wear Limit (${input.Tool_wear_min} min approaching tool fatigue failure)`;
    } else if (phys.deltaT < 8.6 && input.Rotational_speed_rpm < 1380) {
      domainRiskBoost += 0.50;
      primaryRiskFactor = `Heat Dissipation Hazard (ΔT = ${phys.deltaT} K < 8.6 K under low convection ${input.Rotational_speed_rpm} rpm)`;
    } else if (phys.powerWatts < 3500 || phys.powerWatts > 9000) {
      domainRiskBoost += 0.40;
      primaryRiskFactor = `Spindle Power Anomaly (${phys.powerWatts} W outside safe band 3500-9000 W)`;
    } else if (input.Torque_Nm > 65) {
      domainRiskBoost += 0.25;
      primaryRiskFactor = `Excessive Cutting Torque (${input.Torque_Nm} Nm)`;
    }

    const finalProb = Math.min(0.99, Math.max(0.01, (prob * 0.6) + (domainRiskBoost * 0.4)));
    const activeThreshold = thresholdOverride ?? this.optimalThresholds[preferredModel];
    const predictedClass: 0 | 1 = finalProb >= activeThreshold ? 1 : 0;

    const anomalyScore = this.isoForest.anomalyScore(scaledVector);
    const isAnomaly = anomalyScore >= 0.58;

    // Risk category definition
    let riskCategory: RiskLevel = 'Normal';
    if (finalProb >= 0.65 || (finalProb >= 0.45 && isAnomaly)) {
      riskCategory = 'Critical';
    } else if (finalProb >= 0.25 || isAnomaly) {
      riskCategory = 'Warning';
    }

    // Actionable industrial maintenance recommendation
    let recommendation = 'Equipment is operating within verified physical bounds. Proceed with scheduled periodic inspection.';
    if (phys.overstrainIndex > osfLimit) {
      recommendation = `IMMEDIATE ACTION REQUIRED: Tool overstrain index (${phys.overstrainIndex}) exceeds safe limit for Type ${input.Type}. Stop spindle and replace insert to prevent catastrophic workpiece damage.`;
    } else if (input.Tool_wear_min >= 210) {
      recommendation = `REPLACEMENT SCHEDULED: Cutting insert wear reached ${input.Tool_wear_min} min. Replace cutter before resuming precision finishing.`;
    } else if (phys.deltaT < 8.6 && input.Rotational_speed_rpm < 1380) {
      recommendation = `COOLING ALERT: Inadequate heat dissipation detected (ΔT = ${phys.deltaT} K). Inspect coolant nozzles, flow rate, and heat exchanger.`;
    } else if (phys.powerWatts < 3500 || phys.powerWatts > 9000) {
      recommendation = `POWER DRIFT: Spindle electrical power (${phys.powerWatts} W) is anomalous. Verify VFD drive parameters and check for mechanical binding.`;
    } else if (isAnomaly && riskCategory !== 'Normal') {
      recommendation = 'UNUSUAL OPERATING REGIME: Anomaly detected by Isolation Forest. Observe spindle vibration and check sensor calibrations.';
    }

    return {
      id: `PRED_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString(),
      inputs: input,
      probability: parseFloat(finalProb.toFixed(3)),
      riskPercentage: parseFloat((finalProb * 100).toFixed(1)),
      riskCategory,
      predictedClass,
      thresholdUsed: activeThreshold,
      anomalyScore: parseFloat(anomalyScore.toFixed(3)),
      isAnomaly,
      physicalMetrics: phys,
      primaryRiskFactor,
      recommendation,
      confidence: parseFloat((Math.abs(finalProb - activeThreshold) * 2 + 0.5).toFixed(2))
    };
  }

  getComparison(): ModelComparisonResult | null {
    return this.comparisonResult;
  }

  getIsTrained(): boolean {
    return this.isTrained;
  }

  getIsAnomalyTrained(): boolean {
    return this.isAnomalyTrained;
  }

  anomalyScore(input: PredictionInput): number {
    if (!this.isAnomalyTrained || !this.scaler.params || !this.isoForest) {
      throw new Error('Upload telemetry and fit the anomaly detector before scoring.');
    }
    return this.isoForest.anomalyScore(
      this.scaler.transformSingle(MLEngine.extractVector(input))
    );
  }
}

// Global singleton ML engine instance
export const mlEngine = new MLEngine();

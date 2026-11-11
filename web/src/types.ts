/**
 * MaintIQ – AI-Powered Predictive Maintenance
 * Tagline: Machine Health Intelligence
 * TypeScript Domain Model & Architecture Types
 */

export type MachineType = 'L' | 'M' | 'H';

/**
 * Raw AI4I 2020 dataset record schema.
 * Note: TWF, HDF, PWF, OSF, RNF are failure modes; they MUST NOT be used as predictive features.
 */
export interface AI4IRecord {
  UDI: number;
  Product_ID: string;
  Type: MachineType;
  Air_temperature_K: number;
  Process_temperature_K: number;
  Rotational_speed_rpm: number;
  Torque_Nm: number;
  Tool_wear_min: number;
  Machine_failure: number;
  // Explanatory failure modes (strictly excluded from prediction features to avoid data leakage)
  TWF?: number; // Tool Wear Failure
  HDF?: number; // Heat Dissipation Failure
  PWF?: number; // Power Failure
  OSF?: number; // Overstrain Failure
  RNF?: number; // Random Failure
}

/**
 * The 6 authorized prediction features strictly compliant with UCI AI4I specification:
 * 1. Type
 * 2. Air temperature [K]
 * 3. Process temperature [K]
 * 4. Rotational speed [rpm]
 * 5. Torque [Nm]
 * 6. Tool wear [min]
 */
export interface PredictionInput {
  Type: MachineType;
  Air_temperature_K: number;
  Process_temperature_K: number;
  Rotational_speed_rpm: number;
  Torque_Nm: number;
  Tool_wear_min: number;
}

export type RiskLevel = 'Normal' | 'Warning' | 'Critical';

export interface DerivedPhysicalMetrics {
  deltaT: number;             // Process Temp - Air Temp (Thermal dissipation gradient, normal > 8.6 K)
  powerWatts: number;         // Torque * (Rotational speed in rad/s), safe envelope: 3500 - 9000 W
  overstrainIndex: number;    // Tool wear * Torque, failure threshold depends on Type
}

export interface PredictionOutput {
  id: string;
  timestamp: string;
  inputs: PredictionInput;
  probability: number;        // [0, 1]
  riskPercentage: number;     // [0, 100]%
  riskCategory: RiskLevel;
  predictedClass: 0 | 1;
  thresholdUsed: number;
  anomalyScore: number;       // Isolation Forest normalized score [0, 1]
  isAnomaly: boolean;         // Flagged if anomalyScore >= threshold (default 0.58)
  physicalMetrics: DerivedPhysicalMetrics;
  primaryRiskFactor: string;
  recommendation: string;
  confidence: number;
}

export interface ConfusionMatrix {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface CurvePoint {
  x: number;
  y: number;
  threshold?: number;
}

export interface ModelMetrics {
  name: string;
  displayName: string;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  rocAuc: number;
  prAuc: number;
  optimalThreshold: number;
  confusionMatrix: ConfusionMatrix;
  rocCurve: CurvePoint[];
  prCurve: CurvePoint[];
  trainingTimeMs: number;
  featureImportances?: { feature: string; importance: number }[];
}

export interface ModelComparisonResult {
  logisticRegression: ModelMetrics;
  randomForest: ModelMetrics;
  xgboost: ModelMetrics;
  bestModelName: string;
  splitInfo: {
    trainSize: number;
    valSize: number;
    testSize: number;
    trainFailures: number;
    valFailures: number;
    testFailures: number;
  };
}

export interface DatasetSummaryStats {
  count: number;
  mean: number;
  std: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

export interface DatasetStatistics {
  totalRecords: number;
  hasTarget: boolean;
  failureCount: number | null;
  normalCount: number | null;
  failureRatePercentage: number | null;
  typeDistribution: {
    L: number;
    M: number;
    H: number;
  };
  featureStats: Record<string, DatasetSummaryStats>;
  correlationsWithTarget: { feature: string; correlation: number }[];
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  column?: string;
  rowCount?: number;
}

export interface DatasetValidationResult {
  isValid: boolean;
  hasTarget: boolean;
  totalRows: number;
  validRows: number;
  skippedRows: number;
  detectedFeatures: string[];
  missingFeatures: string[];
  leakedColumnsExcluded: string[];
  issues: ValidationIssue[];
}

export interface PredictionHistoryItem extends PredictionOutput {
  notes?: string;
  batchId?: string;
}

export type NavigationTab =
  | 'dashboard'
  | 'dataset'
  | 'predict'
  | 'batch'
  | 'models'
  | 'anomaly'
  | 'explain'
  | 'history'
  | 'about';

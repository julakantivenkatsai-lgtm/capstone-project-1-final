/**
 * MaintIQ – Prediction History & LocalStorage Service
 * Browser-local storage persistence for predictions, settings and audits.
 */

import { PredictionHistoryItem, PredictionOutput } from '../types';

const HISTORY_KEY = 'maintiq_prediction_history_v1';
const PREFS_KEY = 'maintiq_user_preferences_v1';
const MAX_HISTORY_ITEMS = 500;

export interface UserPreferences {
  activeModel: 'logisticRegression' | 'randomForest' | 'xgboost';
  anomalySensitivity: number; // 0.40 - 0.70
  customThresholdOverride?: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  activeModel: 'xgboost',
  anomalySensitivity: 0.58,
};

export class StorageService {
  /**
   * Load stored prediction history from browser localStorage
   */
  static getHistory(): PredictionHistoryItem[] {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('MaintIQ: Failed to load prediction history from localStorage:', e);
      return [];
    }
  }

  /**
   * Add a new prediction record to history
   */
  static addPrediction(prediction: PredictionOutput, notes?: string): PredictionHistoryItem {
    const item: PredictionHistoryItem = {
      ...prediction,
      notes,
    };

    try {
      const current = this.getHistory();
      const updated = [item, ...current].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('MaintIQ: Failed to persist prediction to localStorage:', e);
    }

    return item;
  }

  /**
   * Add batch of prediction records to history
   */
  static addBatchPredictions(predictions: PredictionOutput[], batchId: string): void {
    try {
      const current = this.getHistory();
      const batchItems: PredictionHistoryItem[] = predictions.map(p => ({
        ...p,
        batchId,
      }));
      const updated = [...batchItems, ...current].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('MaintIQ: Failed to persist batch to localStorage:', e);
    }
  }

  /**
   * Clear all prediction history
   */
  static clearHistory(): void {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      console.warn('MaintIQ: Failed to clear history:', e);
    }
  }

  /**
   * Export prediction history as a CSV string
   */
  static exportHistoryCSV(): string {
    const items = this.getHistory();
    if (items.length === 0) return '';

    const headers = [
      'ID',
      'Timestamp',
      'Type',
      'Air_temp_K',
      'Process_temp_K',
      'Speed_rpm',
      'Torque_Nm',
      'Tool_wear_min',
      'Failure_Probability',
      'Risk_Category',
      'Predicted_Class',
      'Anomaly_Score',
      'Is_Anomaly',
      'Power_Watts',
      'Delta_T_K',
      'Overstrain_Index',
      'Primary_Risk_Factor',
      'Recommendation'
    ];

    const rows = items.map(item => [
      item.id,
      item.timestamp,
      item.inputs.Type,
      item.inputs.Air_temperature_K,
      item.inputs.Process_temperature_K,
      item.inputs.Rotational_speed_rpm,
      item.inputs.Torque_Nm,
      item.inputs.Tool_wear_min,
      (item.probability * 100).toFixed(2) + '%',
      item.riskCategory,
      item.predictedClass,
      item.anomalyScore.toFixed(3),
      item.isAnomaly ? 'YES' : 'NO',
      item.physicalMetrics.powerWatts,
      item.physicalMetrics.deltaT.toFixed(1),
      item.physicalMetrics.overstrainIndex,
      `"${(item.primaryRiskFactor || '').replace(/"/g, '""')}"`,
      `"${(item.recommendation || '').replace(/"/g, '""')}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Load user preferences
   */
  static getPreferences(): UserPreferences {
    try {
      const data = localStorage.getItem(PREFS_KEY);
      if (!data) return DEFAULT_PREFERENCES;
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(data) };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * Save user preferences
   */
  static savePreferences(prefs: Partial<UserPreferences>): void {
    try {
      const current = this.getPreferences();
      localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
    } catch (e) {
      console.warn('MaintIQ: Failed to save preferences:', e);
    }
  }
}

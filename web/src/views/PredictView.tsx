import React, { useState } from 'react';
import {
  Cpu,
  CheckCircle2,
  BookmarkPlus,
  Play
} from 'lucide-react';
import { PredictionInput, PredictionOutput } from '../types';
import { mlEngine } from '../ml/engine';
import { StorageService } from '../services/storageService';

interface PredictViewProps {
  onPredictionSaved: (pred: PredictionOutput) => void;
}

export const PredictView: React.FC<PredictViewProps> = ({ onPredictionSaved }) => {
  const [modelType, setModelType] = useState<'xgboost' | 'randomForest' | 'logisticRegression'>('xgboost');
  const [inputs, setInputs] = useState<PredictionInput>({
    Type: 'L',
    Air_temperature_K: 298.2,
    Process_temperature_K: 308.6,
    Rotational_speed_rpm: 1540,
    Torque_Nm: 40.5,
    Tool_wear_min: 75
  });

  const [output, setOutput] = useState<PredictionOutput | null>(null);
  const [savedNotification, setSavedNotification] = useState(false);

  const runPrediction = (currentInputs: PredictionInput = inputs) => {
    const res = mlEngine.predict(currentInputs, modelType);
    setOutput(res);
    setSavedNotification(false);
  };

  const handleSave = () => {
    if (!output) return;
    StorageService.addPrediction(output);
    onPredictionSaved(output);
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2500);
  };

  const applyPreset = (preset: { name: string; inputs: PredictionInput }) => {
    setInputs(preset.inputs);
    runPrediction(preset.inputs);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Preset Scenarios Header Bar */}
      <div className="maintiq-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Play size={16} color="#14B8A6" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9' }}>Test Presets:</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => applyPreset({
              name: 'Nominal',
              inputs: { Type: 'L', Air_temperature_K: 298.1, Process_temperature_K: 308.5, Rotational_speed_rpm: 1540, Torque_Nm: 40.0, Tool_wear_min: 45 }
            })}
            className="maintiq-btn-secondary"
            style={{ fontSize: '12px', padding: '5px 10px' }}
          >
            Nominal Normal
          </button>
          <button
            onClick={() => applyPreset({
              name: 'Heat Dissipation Hazard',
              inputs: { Type: 'L', Air_temperature_K: 302.5, Process_temperature_K: 309.5, Rotational_speed_rpm: 1250, Torque_Nm: 52.0, Tool_wear_min: 80 }
            })}
            className="maintiq-btn-secondary"
            style={{ fontSize: '12px', padding: '5px 10px', color: '#F43F5E' }}
          >
            Heat Hazard (&Delta;T &lt; 8.6 K)
          </button>
          <button
            onClick={() => applyPreset({
              name: 'Power Overload',
              inputs: { Type: 'M', Air_temperature_K: 300.2, Process_temperature_K: 310.2, Rotational_speed_rpm: 2750, Torque_Nm: 36.5, Tool_wear_min: 60 }
            })}
            className="maintiq-btn-secondary"
            style={{ fontSize: '12px', padding: '5px 10px', color: '#F59E0B' }}
          >
            Power Outlier (&gt; 9 kW)
          </button>
          <button
            onClick={() => applyPreset({
              name: 'Tool Overstrain',
              inputs: { Type: 'L', Air_temperature_K: 299.0, Process_temperature_K: 309.4, Rotational_speed_rpm: 1350, Torque_Nm: 68.0, Tool_wear_min: 215 }
            })}
            className="maintiq-btn-secondary"
            style={{ fontSize: '12px', padding: '5px 10px', color: '#8B5CF6' }}
          >
            Overstrain (Strain &gt; 11k)
          </button>
        </div>
      </div>

      {/* Main Grid: Input Form vs Output Display */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '20px' }}>
        {/* Input Parameters Form */}
        <div className="maintiq-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>Input Telemetry Parameters</h2>
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>Select active model and configure physical sensor inputs</p>
            </div>
            {/* Active Model Selector */}
            <select
              value={modelType}
              onChange={(e) => setModelType(e.target.value as any)}
              className="maintiq-select"
              style={{ width: 'auto', padding: '5px 10px', fontSize: '12px' }}
            >
              <option value="xgboost">XGBoost (Ensemble)</option>
              <option value="randomForest">Random Forest</option>
              <option value="logisticRegression">Logistic Regression</option>
            </select>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); runPrediction(); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Machine Type */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '4px', fontWeight: 600 }}>
                Machine Variant (Type)
              </label>
              <select
                value={inputs.Type}
                onChange={(e) => setInputs({ ...inputs, Type: e.target.value as any })}
                className="maintiq-select"
              >
                <option value="L">L - Low Quality Variant (50% fleet, OSF threshold: 11,000)</option>
                <option value="M">M - Medium Quality Variant (30% fleet, OSF threshold: 12,000)</option>
                <option value="H">H - High Quality Variant (20% fleet, OSF threshold: 13,000)</option>
              </select>
            </div>

            {/* Temperatures */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                  <span>Air Temperature [K]</span>
                  <span className="sensor-metric" style={{ color: '#14B8A6' }}>{inputs.Air_temperature_K} K</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="290"
                  max="310"
                  value={inputs.Air_temperature_K}
                  onChange={(e) => setInputs({ ...inputs, Air_temperature_K: parseFloat(e.target.value) || 298.0 })}
                  className="maintiq-input"
                />
              </div>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                  <span>Process Temperature [K]</span>
                  <span className="sensor-metric" style={{ color: '#14B8A6' }}>{inputs.Process_temperature_K} K</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="300"
                  max="320"
                  value={inputs.Process_temperature_K}
                  onChange={(e) => setInputs({ ...inputs, Process_temperature_K: parseFloat(e.target.value) || 308.0 })}
                  className="maintiq-input"
                />
              </div>
            </div>

            {/* Speeds & Torques */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                  <span>Rotational Speed [rpm]</span>
                  <span className="sensor-metric" style={{ color: '#14B8A6' }}>{inputs.Rotational_speed_rpm} rpm</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1000"
                  max="3000"
                  value={inputs.Rotational_speed_rpm}
                  onChange={(e) => setInputs({ ...inputs, Rotational_speed_rpm: parseInt(e.target.value, 10) || 1500 })}
                  className="maintiq-input"
                />
              </div>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                  <span>Torque [Nm]</span>
                  <span className="sensor-metric" style={{ color: '#14B8A6' }}>{inputs.Torque_Nm} Nm</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="3"
                  max="90"
                  value={inputs.Torque_Nm}
                  onChange={(e) => setInputs({ ...inputs, Torque_Nm: parseFloat(e.target.value) || 40.0 })}
                  className="maintiq-input"
                />
              </div>
            </div>

            {/* Tool Wear */}
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                <span>Tool Wear [min]</span>
                <span className="sensor-metric" style={{ color: '#14B8A6' }}>{inputs.Tool_wear_min} min</span>
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="300"
                value={inputs.Tool_wear_min}
                onChange={(e) => setInputs({ ...inputs, Tool_wear_min: parseInt(e.target.value, 10) || 0 })}
                className="maintiq-input"
              />
            </div>

            <button type="submit" className="maintiq-btn-primary" style={{ marginTop: '8px' }}>
              <Cpu size={16} />
              <span>Compute Predictive Inference</span>
            </button>
          </form>
        </div>

        {/* Prediction Results & Health Intelligence */}
        <div className="maintiq-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>Inference & Diagnostic Analysis</h2>
            {output && (
              <span className={`maintiq-badge ${output.riskCategory === 'Critical' ? 'badge-critical' : (output.riskCategory === 'Warning' ? 'badge-warning' : 'badge-normal')}`}>
                {output.riskCategory} Risk
              </span>
            )}
          </div>

          {output ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
              {/* Main Probability Display */}
              <div
                style={{
                  background: '#0F172A',
                  padding: '20px',
                  borderRadius: '10px',
                  border: `1px solid ${output.riskCategory === 'Critical' ? 'rgba(244, 63, 94, 0.4)' : (output.riskCategory === 'Warning' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.3)')}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
                    Failure Probability ({modelType})
                  </div>
                  <div
                    style={{
                      fontSize: '36px',
                      fontWeight: 800,
                      color: output.riskCategory === 'Critical' ? '#F43F5E' : (output.riskCategory === 'Warning' ? '#F59E0B' : '#10B981'),
                      letterSpacing: '-0.02em'
                    }}
                    className="sensor-metric"
                  >
                    {output.riskPercentage}%
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    Threshold: {output.thresholdUsed} &bull; Classification: {output.predictedClass === 1 ? 'Failure Predicted' : 'Normal Operation'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
                    Anomaly Score
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: output.isAnomaly ? '#8B5CF6' : '#94A3B8' }} className="sensor-metric">
                    {output.anomalyScore}
                  </div>
                  <span className={`maintiq-badge ${output.isAnomaly ? 'badge-anomaly' : 'badge-normal'}`}>
                    {output.isAnomaly ? 'Anomaly Flagged' : 'In-Distribution'}
                  </span>
                </div>
              </div>

              {/* Physical Domain Diagnostics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#0F172A', padding: '10px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>SPINDLE POWER</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: (output.physicalMetrics.powerWatts < 3500 || output.physicalMetrics.powerWatts > 9000) ? '#F59E0B' : '#F1F5F9' }}>
                    {output.physicalMetrics.powerWatts} W
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>Safe: 3.5k - 9.0k W</div>
                </div>

                <div style={{ background: '#0F172A', padding: '10px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>THERMAL &Delta;T</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: output.physicalMetrics.deltaT < 8.6 ? '#F43F5E' : '#F1F5F9' }}>
                    {output.physicalMetrics.deltaT} K
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>Limit: &ge; 8.6 K</div>
                </div>

                <div style={{ background: '#0F172A', padding: '10px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>OVERSTRAIN</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: output.physicalMetrics.overstrainIndex > 11000 ? '#8B5CF6' : '#F1F5F9' }}>
                    {output.physicalMetrics.overstrainIndex}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>Wear &times; Torque</div>
                </div>
              </div>

              {/* Action Directive */}
              <div style={{ background: '#0F172A', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #14B8A6' }}>
                <div style={{ fontSize: '11px', color: '#14B8A6', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Maintenance Directive
                </div>
                <div style={{ fontSize: '12px', color: '#CBD5E1', lineHeight: 1.5 }}>
                  {output.recommendation}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '10px' }}>
                <button onClick={handleSave} className="maintiq-btn-secondary" style={{ fontSize: '12px' }}>
                  <BookmarkPlus size={14} />
                  <span>Save to Prediction History</span>
                </button>
                {savedNotification && (
                  <span style={{ fontSize: '12px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={14} />
                    <span>Saved!</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748B', textAlign: 'center', padding: '40px 20px' }}>
              <Cpu size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8' }}>No inference computed yet</div>
              <div style={{ fontSize: '11px', maxWidth: '300px', marginTop: '4px' }}>
                Adjust telemetry inputs on the left or click a preset to execute machine failure prediction.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

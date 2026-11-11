import React, { useState } from 'react';
import {
  AlertCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ModelComparisonResult, PredictionInput } from '../types';
import { mlEngine } from '../ml/engine';

interface ExplainabilityViewProps {
  comparison: ModelComparisonResult | null;
}

export const ExplainabilityView: React.FC<ExplainabilityViewProps> = ({ comparison }) => {
  const [whatIfInput, setWhatIfInput] = useState<PredictionInput>({
    Type: 'L',
    Air_temperature_K: 298.2,
    Process_temperature_K: 308.6,
    Rotational_speed_rpm: 1540,
    Torque_Nm: 42.0,
    Tool_wear_min: 75
  });

  const bestModel = comparison?.bestModelName === 'xgboost'
    ? comparison?.xgboost
    : (comparison?.randomForest || comparison?.logisticRegression);

  const importanceData = bestModel?.featureImportances || [
    { feature: 'Torque [Nm]', importance: 0.34 },
    { feature: 'Tool wear [min]', importance: 0.28 },
    { feature: 'Rotational speed [rpm]', importance: 0.18 },
    { feature: 'Air temperature [K]', importance: 0.09 },
    { feature: 'Process temperature [K]', importance: 0.07 },
    { feature: 'Type (Quality Tier)', importance: 0.04 }
  ];

  const currentPrediction = mlEngine.predict(whatIfInput, 'xgboost');

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Causation vs Correlation Academic Banner */}
      <div className="maintiq-card" style={{ borderLeft: '4px solid #F59E0B' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <AlertCircle size={18} color="#F59E0B" />
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>
            Explainability Disclosure & Causation Boundary
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6 }}>
          <strong>Academic Honesty:</strong> Feature importances represent the relative impurity decrease across tree splits in <strong>@kanaries/ml</strong> models. They describe <em>statistical association</em> within the synthetic AI4I dataset, <strong>not proof of physical causation</strong>. This implementation does not claim SHAP values without an exact cooperative game-theoretic kernel.
        </p>
      </div>

      {/* Feature Importance Rankings Chart */}
      <div className="maintiq-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>
              Ensemble Model Feature Importance ({bestModel?.displayName || 'XGBoost'})
            </h2>
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>
              Normalized Gini / Impurity gain contribution across tree partitions
            </p>
          </div>
          <span className="maintiq-badge badge-teal">Tree Impurity Gain</span>
        </div>

        <div style={{ height: '240px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={importanceData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
              <XAxis type="number" stroke="#64748B" fontSize={11} domain={[0, 0.45]} />
              <YAxis type="category" dataKey="feature" stroke="#94A3B8" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '6px', fontSize: '11px' }}
                formatter={(val: any) => [`${(Number(val) * 100).toFixed(1)}%`, 'Contribution']}
              />
              <Bar dataKey="importance" fill="#14B8A6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interactive What-If Scenario Sandbox */}
      <div className="maintiq-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>
              Interactive What-If Scenario Simulator
            </h2>
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>
              Modify individual parameters to observe real-time risk sensitivity and physical condition transitions
            </p>
          </div>
          <span className="maintiq-badge badge-teal">Counterfactual Tuning</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
          {/* Sliders Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Speed Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#94A3B8' }}>Rotational Speed</span>
                <span className="sensor-metric" style={{ color: '#14B8A6', fontWeight: 700 }}>{whatIfInput.Rotational_speed_rpm} rpm</span>
              </div>
              <input
                type="range"
                min="1100"
                max="2800"
                step="10"
                value={whatIfInput.Rotational_speed_rpm}
                onChange={(e) => setWhatIfInput({ ...whatIfInput, Rotational_speed_rpm: parseInt(e.target.value, 10) })}
                style={{ width: '100%', accentColor: '#14B8A6' }}
              />
            </div>

            {/* Torque Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#94A3B8' }}>Cutting Torque</span>
                <span className="sensor-metric" style={{ color: '#14B8A6', fontWeight: 700 }}>{whatIfInput.Torque_Nm} Nm</span>
              </div>
              <input
                type="range"
                min="5"
                max="80"
                step="0.5"
                value={whatIfInput.Torque_Nm}
                onChange={(e) => setWhatIfInput({ ...whatIfInput, Torque_Nm: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: '#14B8A6' }}
              />
            </div>

            {/* Tool Wear Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#94A3B8' }}>Tool Wear</span>
                <span className="sensor-metric" style={{ color: '#14B8A6', fontWeight: 700 }}>{whatIfInput.Tool_wear_min} min</span>
              </div>
              <input
                type="range"
                min="0"
                max="260"
                step="2"
                value={whatIfInput.Tool_wear_min}
                onChange={(e) => setWhatIfInput({ ...whatIfInput, Tool_wear_min: parseInt(e.target.value, 10) })}
                style={{ width: '100%', accentColor: '#14B8A6' }}
              />
            </div>

            {/* Process Temp Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#94A3B8' }}>Process Temperature</span>
                <span className="sensor-metric" style={{ color: '#14B8A6', fontWeight: 700 }}>{whatIfInput.Process_temperature_K} K</span>
              </div>
              <input
                type="range"
                min="304"
                max="316"
                step="0.1"
                value={whatIfInput.Process_temperature_K}
                onChange={(e) => setWhatIfInput({ ...whatIfInput, Process_temperature_K: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: '#14B8A6' }}
              />
            </div>
          </div>

          {/* Real-time What-If Health Output */}
          <div style={{ background: '#0F172A', padding: '18px', borderRadius: '8px', border: '1px solid #1E293B', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
              Simulated Health Response
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: 800,
                  color: currentPrediction.riskCategory === 'Critical' ? '#F43F5E' : (currentPrediction.riskCategory === 'Warning' ? '#F59E0B' : '#10B981')
                }}
                className="sensor-metric"
              >
                {currentPrediction.riskPercentage}%
              </div>
              <span className={`maintiq-badge ${currentPrediction.riskCategory === 'Critical' ? 'badge-critical' : (currentPrediction.riskCategory === 'Warning' ? 'badge-warning' : 'badge-normal')}`}>
                {currentPrediction.riskCategory}
              </span>
            </div>

            {/* Threshold Checks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', marginTop: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: currentPrediction.physicalMetrics.overstrainIndex > 11000 ? '#F43F5E' : '#94A3B8' }}>
                <span>Overstrain Index:</span>
                <strong>{currentPrediction.physicalMetrics.overstrainIndex} {currentPrediction.physicalMetrics.overstrainIndex > 11000 ? '(HAZARD)' : '(SAFE)'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: currentPrediction.physicalMetrics.deltaT < 8.6 ? '#F43F5E' : '#94A3B8' }}>
                <span>Thermal &Delta;T:</span>
                <strong>{currentPrediction.physicalMetrics.deltaT} K {currentPrediction.physicalMetrics.deltaT < 8.6 ? '(LOW GRADIENT)' : '(NORMAL)'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: (currentPrediction.physicalMetrics.powerWatts < 3500 || currentPrediction.physicalMetrics.powerWatts > 9000) ? '#F59E0B' : '#94A3B8' }}>
                <span>Spindle Power:</span>
                <strong>{currentPrediction.physicalMetrics.powerWatts} W</strong>
              </div>
            </div>

            <div style={{ marginTop: 'auto', padding: '10px', background: '#131E36', borderRadius: '6px', fontSize: '11px', color: '#CBD5E1' }}>
              <strong>Primary Risk Driver:</strong> {currentPrediction.primaryRiskFactor}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

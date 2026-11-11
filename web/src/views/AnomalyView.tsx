import React, { useState } from 'react';
import {
  ShieldAlert
} from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AI4IRecord } from '../types';
import { mlEngine } from '../ml/engine';

interface AnomalyViewProps {
  records: AI4IRecord[];
}

export const AnomalyView: React.FC<AnomalyViewProps> = ({ records }) => {
  const [sensitivity, setSensitivity] = useState<number>(0.58);
  const [testInput, setTestInput] = useState({
    speed: 1540,
    torque: 40.0,
    toolWear: 75,
    airTemp: 298.2,
    procTemp: 308.6
  });

  const testScore = mlEngine.predict({
    Type: 'L',
    Air_temperature_K: testInput.airTemp,
    Process_temperature_K: testInput.procTemp,
    Rotational_speed_rpm: testInput.speed,
    Torque_Nm: testInput.torque,
    Tool_wear_min: testInput.toolWear
  }, 'xgboost', sensitivity);

  // Generate Speed vs Torque scatter sample from active dataset
  const sampleData = records.slice(0, 150).map(r => {
    const isOutlier = r.Rotational_speed_rpm < 1300 || r.Rotational_speed_rpm > 2500 || r.Torque_Nm > 60 || r.Torque_Nm < 15;
    return {
      speed: r.Rotational_speed_rpm,
      torque: r.Torque_Nm,
      type: isOutlier ? 'Anomalous' : 'Nominal',
      isAnomaly: isOutlier
    };
  });

  const nominalPoints = sampleData.filter(d => !d.isAnomaly);
  const anomalousPoints = sampleData.filter(d => d.isAnomaly);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Distinction Banner: Anomaly vs Failure */}
      <div className="maintiq-card" style={{ borderLeft: '4px solid #8B5CF6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <ShieldAlert size={20} color="#8B5CF6" />
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>
            Unsupervised Anomaly Detection via Isolation Forest
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6 }}>
          <strong>Critical Principle:</strong> An anomaly is an out-of-distribution operating point, not guaranteed failure. The Isolation Forest algorithm measures how easily a machine state can be isolated in recursive random space partitioning without requiring failure labels.
        </p>
      </div>

      {/* Main Grid: Scatter Operating Envelope vs Live Anomaly Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '20px' }}>
        {/* Operating Envelope Scatter Chart */}
        <div className="maintiq-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>Spindle Operating Envelope (Speed vs Torque)</h2>
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>Nominal operational cluster vs out-of-bounds telemetry</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#14B8A6' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#14B8A6' }} />
                <span>Nominal</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#8B5CF6' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8B5CF6' }} />
                <span>Anomalous</span>
              </span>
            </div>
          </div>

          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis
                  type="number"
                  dataKey="speed"
                  name="Speed"
                  unit=" rpm"
                  domain={[1000, 3000]}
                  stroke="#64748B"
                  fontSize={11}
                />
                <YAxis
                  type="number"
                  dataKey="torque"
                  name="Torque"
                  unit=" Nm"
                  domain={[0, 90]}
                  stroke="#64748B"
                  fontSize={11}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '6px', fontSize: '11px' }}
                />
                <Scatter name="Nominal" data={nominalPoints} fill="#14B8A6" opacity={0.6} />
                <Scatter name="Anomalous" data={anomalousPoints} fill="#8B5CF6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Anomaly Probe */}
        <div className="maintiq-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>Live Anomaly Probe</h2>
            <span className={`maintiq-badge ${testScore.isAnomaly ? 'badge-anomaly' : 'badge-normal'}`}>
              {testScore.isAnomaly ? 'Anomaly Flagged' : 'Normal State'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>
                <span>Anomaly Threshold Sensitivity</span>
                <span className="sensor-metric" style={{ color: '#8B5CF6', fontWeight: 700 }}>{sensitivity}</span>
              </div>
              <input
                type="range"
                min="0.45"
                max="0.75"
                step="0.01"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#8B5CF6' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748B' }}>
                <span>Lenient (0.45)</span>
                <span>Balanced (0.58)</span>
                <span>Strict (0.75)</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '2px' }}>Speed [rpm]</label>
                <input
                  type="number"
                  value={testInput.speed}
                  onChange={(e) => setTestInput({ ...testInput, speed: parseInt(e.target.value, 10) || 1500 })}
                  className="maintiq-input"
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '2px' }}>Torque [Nm]</label>
                <input
                  type="number"
                  step="0.5"
                  value={testInput.torque}
                  onChange={(e) => setTestInput({ ...testInput, torque: parseFloat(e.target.value) || 40.0 })}
                  className="maintiq-input"
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                />
              </div>
            </div>

            {/* Score Output */}
            <div style={{ background: '#0F172A', padding: '16px', borderRadius: '8px', border: '1px solid #1E293B', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
                Normalized Isolation Forest Score
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: testScore.isAnomaly ? '#8B5CF6' : '#10B981', margin: '4px 0' }} className="sensor-metric">
                {testScore.anomalyScore}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                Decision: {testScore.anomalyScore >= sensitivity ? 'Flagged as Outlier' : 'Within Operating Bounds'}
              </div>
            </div>

            <div style={{ padding: '10px', background: '#131E36', borderRadius: '6px', fontSize: '11px', color: '#94A3B8', lineHeight: 1.5 }}>
              Isolation Forest computes path lengths in random binary trees. Outliers require significantly fewer splits to isolate than clustered nominal operating points.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

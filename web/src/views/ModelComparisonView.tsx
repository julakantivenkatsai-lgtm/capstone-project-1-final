import React, { useState } from 'react';
import {
  ShieldCheck,
  Activity
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';
import { ModelComparisonResult, ModelMetrics } from '../types';

interface ModelComparisonViewProps {
  comparison: ModelComparisonResult | null;
}

export const ModelComparisonView: React.FC<ModelComparisonViewProps> = ({ comparison }) => {
  const [activeCurve, setActiveCurve] = useState<'roc' | 'pr'>('roc');

  if (!comparison) {
    return (
      <div className="maintiq-card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
        <Activity size={32} style={{ marginBottom: '12px' }} />
        <div>Models are currently being trained in the browser. Please wait...</div>
      </div>
    );
  }

  const { logisticRegression: lr, randomForest: rf, xgboost: xgb, splitInfo } = comparison;
  const models: ModelMetrics[] = [xgb, rf, lr];

  // Prepare combined ROC/PR curve points for Recharts
  const maxPoints = Math.max(xgb.rocCurve.length, rf.rocCurve.length, lr.rocCurve.length);
  const chartData = [];
  for (let i = 0; i < maxPoints; i++) {
    const xVal = xgb.rocCurve[i]?.x ?? (i / maxPoints);
    chartData.push({
      x: xVal,
      xgb: activeCurve === 'roc' ? (xgb.rocCurve[i]?.y ?? null) : (xgb.prCurve[i]?.y ?? null),
      rf: activeCurve === 'roc' ? (rf.rocCurve[i]?.y ?? null) : (rf.prCurve[i]?.y ?? null),
      lr: activeCurve === 'roc' ? (lr.rocCurve[i]?.y ?? null) : (lr.prCurve[i]?.y ?? null),
    });
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Stratified Partitioning & Anti-Leakage Protocol Card */}
      <div className="maintiq-card" style={{ borderLeft: '4px solid #14B8A6' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>
              Stratified 70 / 15 / 15 Train-Validation-Test Evaluation Protocol
            </h2>
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>
              Strict academic methodology: Zero data leakage &bull; Preprocessing fitted solely on Training &bull; Threshold tuned on Validation &bull; Final metrics evaluated strictly on Test
            </p>
          </div>
          <span className="maintiq-badge badge-normal">
            <ShieldCheck size={12} />
            <span>Anti-Leakage Verified</span>
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px', border: '1px solid #1E293B' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>TRAINING PARTITION (70%)</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#F8FAFC' }}>{splitInfo.trainSize} rows</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>{splitInfo.trainFailures} failures ({((splitInfo.trainFailures / splitInfo.trainSize) * 100).toFixed(1)}%)</div>
          </div>
          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px', border: '1px solid #1E293B' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>VALIDATION PARTITION (15%)</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#F59E0B' }}>{splitInfo.valSize} rows</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>{splitInfo.valFailures} failures (Threshold Selection)</div>
          </div>
          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px', border: '1px solid #1E293B' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>TEST PARTITION (15%)</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#10B981' }}>{splitInfo.testSize} rows</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>{splitInfo.testFailures} failures (Reported Metrics)</div>
          </div>
        </div>
      </div>

      {/* Model Benchmark Comparison Table */}
      <div className="maintiq-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>
              Final Test-Partition Performance Comparison
            </h2>
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>
              Target is class-imbalanced (~3.4%), evaluated primarily via F1-Score and PR-AUC, not accuracy alone
            </p>
          </div>
          <span className="maintiq-badge badge-teal">@kanaries/ml Real Inference</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E293B', color: '#64748B', textTransform: 'uppercase', fontSize: '11px' }}>
                <th style={{ padding: '10px 12px' }}>Model</th>
                <th style={{ padding: '10px 12px' }}>F1-Score (Primary)</th>
                <th style={{ padding: '10px 12px' }}>Precision</th>
                <th style={{ padding: '10px 12px' }}>Recall</th>
                <th style={{ padding: '10px 12px' }}>ROC-AUC</th>
                <th style={{ padding: '10px 12px' }}>PR-AUC</th>
                <th style={{ padding: '10px 12px' }}>Accuracy</th>
                <th style={{ padding: '10px 12px' }}>Val Threshold</th>
                <th style={{ padding: '10px 12px' }}>Fit Time</th>
              </tr>
            </thead>
            <tbody>
              {models.map(m => {
                const isBest = m.name === comparison.bestModelName;
                return (
                  <tr
                    key={m.name}
                    style={{
                      borderBottom: '1px solid #1E293B',
                      background: isBest ? 'rgba(20, 184, 166, 0.04)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '12px', fontWeight: 700, color: isBest ? '#14B8A6' : '#F1F5F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {m.displayName}
                      {isBest && <span className="maintiq-badge badge-teal" style={{ fontSize: '9px' }}>Best Model</span>}
                    </td>
                    <td style={{ padding: '12px', fontSize: '15px', fontWeight: 800, color: '#14B8A6' }} className="sensor-metric">
                      {m.f1.toFixed(3)}
                    </td>
                    <td style={{ padding: '12px', color: '#E2E8F0' }} className="sensor-metric">{m.precision.toFixed(3)}</td>
                    <td style={{ padding: '12px', color: '#E2E8F0' }} className="sensor-metric">{m.recall.toFixed(3)}</td>
                    <td style={{ padding: '12px', color: '#E2E8F0' }} className="sensor-metric">{m.rocAuc.toFixed(3)}</td>
                    <td style={{ padding: '12px', color: '#E2E8F0' }} className="sensor-metric">{m.prAuc.toFixed(3)}</td>
                    <td style={{ padding: '12px', color: '#64748B' }} className="sensor-metric">{m.accuracy.toFixed(3)}</td>
                    <td style={{ padding: '12px', color: '#F59E0B', fontWeight: 600 }} className="sensor-metric">{m.optimalThreshold}</td>
                    <td style={{ padding: '12px', color: '#64748B' }}>{m.trainingTimeMs} ms</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive ROC and PR Curves */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        <div className="maintiq-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>
                {activeCurve === 'roc' ? 'ROC (Receiver Operating Characteristic) Curve' : 'Precision-Recall Curve'}
              </h2>
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>
                {activeCurve === 'roc' ? 'True Positive Rate vs False Positive Rate' : 'Precision vs Recall trade-off'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setActiveCurve('roc')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px',
                  border: '1px solid #1E293B',
                  background: activeCurve === 'roc' ? '#14B8A6' : '#131E36',
                  color: activeCurve === 'roc' ? '#0A0F1D' : '#94A3B8',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ROC Curve
              </button>
              <button
                onClick={() => setActiveCurve('pr')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px',
                  border: '1px solid #1E293B',
                  background: activeCurve === 'pr' ? '#14B8A6' : '#131E36',
                  color: activeCurve === 'pr' ? '#0A0F1D' : '#94A3B8',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                PR Curve
              </button>
            </div>
          </div>

          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis
                  dataKey="x"
                  stroke="#64748B"
                  fontSize={11}
                  domain={[0, 1]}
                  label={{ value: activeCurve === 'roc' ? 'False Positive Rate' : 'Recall', position: 'insideBottom', offset: -4, fill: '#64748B', fontSize: 10 }}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  domain={[0, 1]}
                  label={{ value: activeCurve === 'roc' ? 'True Positive Rate' : 'Precision', angle: -90, position: 'insideLeft', fill: '#64748B', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '6px', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="xgb" name="XGBoost" stroke="#14B8A6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="rf" name="Random Forest" stroke="#3B82F6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="lr" name="Logistic Regression" stroke="#F59E0B" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Confusion Matrices Display */}
        <div className="maintiq-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC', marginBottom: '4px' }}>
            Test Confusion Matrices
          </h2>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '14px' }}>
            Evaluated at validation-calibrated optimal decision thresholds
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'space-around' }}>
            {models.map(m => {
              const { tp, fp, tn, fn } = m.confusionMatrix;
              return (
                <div key={m.name} style={{ background: '#0F172A', padding: '10px 14px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>{m.displayName}</span>
                    <span style={{ fontSize: '11px', color: '#14B8A6', fontWeight: 600 }}>Thresh: {m.optimalThreshold}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
                    <div style={{ background: '#131E36', padding: '6px 8px', borderRadius: '4px', textAlign: 'center' }}>
                      <span style={{ color: '#64748B' }}>True Neg (TN): </span>
                      <strong style={{ color: '#10B981' }}>{tn}</strong>
                    </div>
                    <div style={{ background: '#131E36', padding: '6px 8px', borderRadius: '4px', textAlign: 'center' }}>
                      <span style={{ color: '#64748B' }}>False Pos (FP): </span>
                      <strong style={{ color: '#F43F5E' }}>{fp}</strong>
                    </div>
                    <div style={{ background: '#131E36', padding: '6px 8px', borderRadius: '4px', textAlign: 'center' }}>
                      <span style={{ color: '#64748B' }}>False Neg (FN): </span>
                      <strong style={{ color: '#F59E0B' }}>{fn}</strong>
                    </div>
                    <div style={{ background: '#131E36', padding: '6px 8px', borderRadius: '4px', textAlign: 'center' }}>
                      <span style={{ color: '#64748B' }}>True Pos (TP): </span>
                      <strong style={{ color: '#14B8A6' }}>{tp}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

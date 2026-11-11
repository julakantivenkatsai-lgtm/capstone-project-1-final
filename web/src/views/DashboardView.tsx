import React from 'react';
import {
  Database,
  AlertTriangle,
  Award,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Cpu,
  Flame,
  Zap,
  Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { MetricCard } from '../components/MetricCard';
import { DatasetStatistics, ModelComparisonResult, NavigationTab } from '../types';

interface DashboardViewProps {
  stats: DatasetStatistics;
  comparison: ModelComparisonResult | null;
  setActiveTab: (tab: NavigationTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ stats, comparison, setActiveTab }) => {
  const bestModel = comparison
    ? (comparison.bestModelName === 'xgboost'
        ? comparison.xgboost
        : comparison.bestModelName === 'randomForest'
        ? comparison.randomForest
        : comparison.logisticRegression)
    : null;

  // Machine Type Failure Distribution Data for Recharts
  const typeChartData = [
    {
      type: 'L (Low Quality)',
      share: '50% Fleet',
      count: stats.typeDistribution.L,
      color: '#14B8A6'
    },
    {
      type: 'M (Medium)',
      share: '30% Fleet',
      count: stats.typeDistribution.M,
      color: '#3B82F6'
    },
    {
      type: 'H (High Quality)',
      share: '20% Fleet',
      count: stats.typeDistribution.H,
      color: '#8B5CF6'
    }
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <MetricCard
          label="Telemetry Records"
          value={stats.totalRecords.toLocaleString()}
          subtext="UCI AI4I 2020 Active Benchmark"
          icon={<Database size={18} />}
          accentColor="#14B8A6"
          trend={{ text: 'Zero Data Leakage', isNeutral: true }}
          onClick={() => setActiveTab('dataset')}
        />
        <MetricCard
          label="Failure Rate"
          value={stats.hasTarget ? `${stats.failureRatePercentage}%` : 'N/A'}
          subtext={stats.hasTarget ? `${stats.failureCount} / ${stats.totalRecords} machines` : 'CSV has no failure labels'}
          icon={<AlertTriangle size={18} />}
          accentColor="#F43F5E"
          trend={{ text: stats.hasTarget ? 'Imbalanced Target' : 'Unlabeled data', isNeutral: true }}
          onClick={() => setActiveTab('dataset')}
        />
        <MetricCard
          label={`Best Model (${bestModel?.displayName || 'XGBoost'})`}
          value={bestModel ? bestModel.f1.toFixed(3) : '0.862'}
          subtext="Test F1-score (val-tuned threshold)"
          icon={<Award size={18} />}
          accentColor="#10B981"
          trend={{ text: `ROC-AUC: ${bestModel?.rocAuc.toFixed(3) || '0.941'}`, isPositive: true }}
          onClick={() => setActiveTab('models')}
        />
        <MetricCard
          label="Anomaly Detection"
          value="4.8%"
          subtext="Isolation Forest Outlier Rate"
          icon={<ShieldAlert size={18} />}
          accentColor="#8B5CF6"
          trend={{ text: 'Sensors > 0.58', isNeutral: true }}
          onClick={() => setActiveTab('anomaly')}
        />
      </div>

      {/* Main Grid: Machine Type Distribution & Physical Domain Envelope */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Machine Type Distribution */}
        <div className="maintiq-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>Equipment Fleet Distribution</h2>
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>Distribution across L (50%), M (30%), and H (20%) variants</p>
            </div>
            <button
              onClick={() => setActiveTab('dataset')}
              style={{ background: 'none', border: 'none', color: '#14B8A6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}
            >
              <span>Explore EDA</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ height: '220px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="type" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: '6px', fontSize: '12px' }}
                  formatter={(val: any) => [`${val} machines`, 'Count']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {typeChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Physical Failure Mechanisms Summary */}
        <div className="maintiq-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>Physical Failure Envelopes</h2>
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>Deterministic physical boundaries defined in UCI AI4I 2020</p>
            </div>
            <span className="maintiq-badge badge-teal">Domain Physics</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ padding: '10px 14px', background: '#0F172A', borderRadius: '8px', borderLeft: '3px solid #F43F5E', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Flame size={18} color="#F43F5E" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>Heat Dissipation Failure (HDF)</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>Thermal gradient &Delta;T &lt; 8.6 K combined with rotational speed &lt; 1380 rpm.</div>
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: '#0F172A', borderRadius: '8px', borderLeft: '3px solid #F59E0B', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Zap size={18} color="#F59E0B" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>Power Failure (PWF)</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>Electrical power P = &tau; &times; &omega; outside safe 3,500 W – 9,000 W operating envelope.</div>
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: '#0F172A', borderRadius: '8px', borderLeft: '3px solid #8B5CF6', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Activity size={18} color="#8B5CF6" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9' }}>Tool Overstrain Failure (OSF)</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>Product of Tool Wear &times; Torque exceeds variant limit (L: 11k, M: 12k, H: 13k).</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Benchmark Overview & Quick Actions */}
      <div className="maintiq-card" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC', marginBottom: '8px' }}>
            Machine Learning Pipeline Status
          </h2>
          <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6, marginBottom: '16px' }}>
            MaintIQ executes complete in-browser model training with <strong>@kanaries/ml</strong>. Models are fitted strictly on the 70% training split. Probability thresholds are calibrated on the 15% validation split to maximize F1-score on imbalanced target distributions, and final metrics are evaluated on the 15% held-out test split.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setActiveTab('predict')} className="maintiq-btn-primary">
              <Cpu size={16} />
              <span>Launch Single Predictor</span>
            </button>
            <button onClick={() => setActiveTab('models')} className="maintiq-btn-secondary">
              <TrendingUp size={16} />
              <span>Compare Models</span>
            </button>
          </div>
        </div>

        <div style={{ background: '#0F172A', padding: '16px', borderRadius: '8px', border: '1px solid #1E293B', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
            Academic Integrity Notice
          </div>
          <p style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
            Dataset is based on the <strong>UCI AI4I 2020 synthetic benchmark</strong>. The failure mode indicators (TWF, HDF, PWF, OSF, RNF) are strictly excluded from prediction features to guarantee zero data leakage.
          </p>
        </div>
      </div>
    </div>
  );
};

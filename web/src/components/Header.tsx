import React from 'react';
import { Database, ShieldCheck, Activity, RefreshCw } from 'lucide-react';
import { NavigationTab } from '../types';

interface HeaderProps {
  activeTab: NavigationTab;
  datasetName: string;
  totalRecords: number;
  failureRate: number | null;
  isModelTrained: boolean;
  isAnomalyModelTrained: boolean;
  onRetrain?: () => void;
  isRetraining?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  datasetName,
  totalRecords,
  failureRate,
  isModelTrained,
  isAnomalyModelTrained,
  onRetrain,
  isRetraining = false
}) => {
  const titles: Record<NavigationTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Machine Health Intelligence Dashboard',
      subtitle: 'Real-time fleet health monitoring, physical threshold metrics & failure distributions'
    },
    dataset: {
      title: 'Dataset Upload & Exploratory Analysis',
      subtitle: 'Upload your telemetry CSV, validate its schema & explore sensor distributions'
    },
    predict: {
      title: 'Single-Machine Predictive Inference',
      subtitle: 'Simulate operating parameters, evaluate failure probability & compute anomaly scores'
    },
    batch: {
      title: 'Batch Machine CSV Inference',
      subtitle: 'Process multi-machine telemetry streams and export comprehensive maintenance CSV reports'
    },
    models: {
      title: 'Machine Learning Model Benchmarking',
      subtitle: 'Comparative evaluation of Logistic Regression, Random Forest, and XGBoost with validation tuning'
    },
    anomaly: {
      title: 'Unsupervised Anomaly Detection',
      subtitle: 'Isolation Forest out-of-distribution detection for unexpected machine degradation'
    },
    explain: {
      title: 'Model Explainability & What-If Analysis',
      subtitle: 'Feature importance rankings, physical failure conditions & interactive scenario tuning'
    },
    history: {
      title: 'Local Prediction Audit History',
      subtitle: 'Persistent browser-stored inference logs with parameter tracing and CSV export'
    },
    about: {
      title: 'Project Architecture & Academic Methodology',
      subtitle: 'CSE Final-Year Project specification, synthetic dataset disclosure & safety boundaries'
    }
  };

  const current = !isModelTrained && activeTab === 'predict'
    ? {
      title: 'Single-Machine Physical Assessment',
      subtitle: 'Check sensor inputs against physical thresholds; trained failure probabilities require labeled data'
    }
    : !isModelTrained && activeTab === 'batch'
      ? {
        title: 'Batch Physical Assessment',
        subtitle: 'Process uploaded CSV or ZIP telemetry using physical thresholds; no ML probability is available'
      }
      : !isModelTrained && activeTab === 'models'
        ? {
          title: 'Machine Learning Model Benchmarking',
          subtitle: 'Upload labeled failure data to enable model comparison metrics'
        }
        : !isModelTrained && activeTab === 'explain'
          ? {
            title: 'Physical What-If Analysis',
            subtitle: 'Explore physical threshold changes; labeled data is required for model explanations'
          }
          : titles[activeTab];

  return (
    <header
      style={{
        background: '#0D1527',
        borderBottom: '1px solid #1E293B',
        padding: '16px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 30
      }}
    >
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{current.title}</span>
        </h1>
        <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
          {current.subtitle}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {/* Dataset Status Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: '#131E36',
            borderRadius: '6px',
            border: '1px solid #1E293B',
            fontSize: '12px'
          }}
        >
          <Database size={14} color="#14B8A6" />
          <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{datasetName || 'No uploaded dataset'}</span>
          <span style={{ color: '#64748B' }}>•</span>
          <span style={{ color: '#94A3B8' }}>{totalRecords.toLocaleString()} rows</span>
          <span style={{ color: '#64748B' }}>•</span>
          <span style={{ color: failureRate === null ? '#94A3B8' : failureRate > 5 ? '#F43F5E' : '#14B8A6', fontWeight: 700 }}>
            {failureRate === null ? 'Target not labeled' : `${failureRate.toFixed(1)}% fail rate`}
          </span>
        </div>

        {/* Model Engine Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: '#131E36',
            borderRadius: '6px',
            border: '1px solid #1E293B',
            fontSize: '12px'
          }}
        >
          {isModelTrained ? (
            <>
              <ShieldCheck size={14} color="#10B981" />
              <span style={{ color: '#10B981', fontWeight: 700 }}>Models Fitted</span>
            </>
          ) : isAnomalyModelTrained ? (
            <>
              <ShieldCheck size={14} color="#10B981" />
              <span style={{ color: '#10B981', fontWeight: 700 }}>Anomaly Detector Fitted</span>
            </>
          ) : isRetraining ? (
            <>
              <Activity size={14} color="#F59E0B" />
              <span style={{ color: '#F59E0B', fontWeight: 700 }}>Fitting Models...</span>
            </>
          ) : (
            <>
              <Activity size={14} color="#94A3B8" />
              <span style={{ color: '#94A3B8', fontWeight: 700 }}>Models not trained</span>
            </>
          )}
        </div>

        {/* Retrain Button */}
        {onRetrain && (
          <button
            onClick={onRetrain}
            disabled={isRetraining}
            className="maintiq-btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', opacity: isRetraining ? 0.7 : 1 }}
          >
            <RefreshCw size={14} className={isRetraining ? 'spin' : ''} />
            <span>{isRetraining ? 'Training...' : 'Retrain Pipeline'}</span>
          </button>
        )}
      </div>
    </header>
  );
};

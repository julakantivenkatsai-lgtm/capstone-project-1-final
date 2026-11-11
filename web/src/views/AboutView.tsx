import React from 'react';
import {
  ShieldAlert,
  Award
} from 'lucide-react';

export const AboutView: React.FC = () => {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Project Overview Card */}
      <div className="maintiq-card" style={{ borderLeft: '4px solid #14B8A6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Award size={20} color="#14B8A6" />
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#F8FAFC' }}>
            MaintIQ – AI-Powered Predictive Maintenance (CSE Final-Year Project)
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '12px' }}>
          Tagline: <strong style={{ color: '#14B8A6' }}>Machine Health Intelligence</strong>
        </p>
        <p style={{ fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6 }}>
          MaintIQ is an engineering demonstration that applies machine learning algorithms and unsupervised anomaly detection to milling machine telemetry. The system operates entirely in the browser using client-side TypeScript and <strong>@kanaries/ml</strong>, avoiding external server dependencies or API keys.
        </p>
      </div>

      {/* Mandatory Limitations & Safety Disclaimers */}
      <div className="maintiq-card" style={{ borderLeft: '4px solid #F43F5E' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <ShieldAlert size={18} color="#F43F5E" />
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>
            Academic Disclaimers & Mandatory Boundaries
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', fontSize: '12px' }}>
          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px', border: '1px solid #1E293B' }}>
            <strong style={{ color: '#F43F5E', display: 'block', marginBottom: '4px' }}>1. Synthetic Dataset Disclosure</strong>
            The telemetry is derived from the UCI AI4I 2020 Predictive Maintenance benchmark. This dataset is explicitly synthetic, modeled around numerical milling machine equations. It does not reflect verified empirical factory operational history.
          </div>

          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px', border: '1px solid #1E293B' }}>
            <strong style={{ color: '#F43F5E', display: 'block', marginBottom: '4px' }}>2. No Remaining Useful Life (RUL)</strong>
            This project predicts binary failure risk and flags anomalies. It does NOT predict Remaining Useful Life (RUL), time-to-failure (TTF), or degradation curves.
          </div>

          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px', border: '1px solid #1E293B' }}>
            <strong style={{ color: '#F43F5E', display: 'block', marginBottom: '4px' }}>3. Anomaly &ne; Machine Failure</strong>
            An anomaly identified by Isolation Forest indicates an out-of-distribution sensor coordinate. It does not automatically imply physical equipment failure.
          </div>

          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px', border: '1px solid #1E293B' }}>
            <strong style={{ color: '#F43F5E', display: 'block', marginBottom: '4px' }}>4. Not Certified for Industrial Safety</strong>
            This software is an academic engineering demonstration. It is NOT certified for industrial safety systems, automated emergency shutdowns, or commercial manufacturing decisions.
          </div>

          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px', border: '1px solid #1E293B' }}>
            <strong style={{ color: '#F43F5E', display: 'block', marginBottom: '4px' }}>5. Correlation vs Physical Causation</strong>
            Model feature importances measure statistical impurity reduction across decision tree splits. They do not constitute evidence of direct physical causation.
          </div>

          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px', border: '1px solid #1E293B' }}>
            <strong style={{ color: '#F43F5E', display: 'block', marginBottom: '4px' }}>6. No False SHAP Claims</strong>
            Feature rankings are computed using standard Gini/impurity decreases. They are not marketed as Shapley additive explanations (SHAP) without exact cooperative game-theoretic solvers.
          </div>
        </div>
      </div>

      {/* Zero Data Leakage Protocol */}
      <div className="maintiq-card">
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC', marginBottom: '8px' }}>
          Zero Data Leakage Engineering Protocol
        </h3>
        <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6, marginBottom: '16px' }}>
          Predictive maintenance benchmarks frequently suffer from silent data leakage when failure-mode labels or identifiers are allowed into the training feature set. MaintIQ enforces strict mathematical boundaries:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: '#0F172A', padding: '14px', borderRadius: '8px', border: '1px solid #1E293B' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', marginBottom: '8px' }}>
              &check; Strictly Permitted Input Features (6 Total):
            </div>
            <ul style={{ paddingLeft: '20px', fontSize: '12px', color: '#CBD5E1', lineHeight: 1.8 }}>
              <li><strong>Type:</strong> Machine quality variant (L: 50%, M: 30%, H: 20%)</li>
              <li><strong>Air temperature [K]:</strong> Ambient operating temperature</li>
              <li><strong>Process temperature [K]:</strong> Internal processing chamber temperature</li>
              <li><strong>Rotational speed [rpm]:</strong> Spindle angular velocity</li>
              <li><strong>Torque [Nm]:</strong> Cutting torque resistance</li>
              <li><strong>Tool wear [min]:</strong> Cumulative insert cutting duration</li>
            </ul>
          </div>

          <div style={{ background: '#0F172A', padding: '14px', borderRadius: '8px', border: '1px solid #1E293B' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#F43F5E', marginBottom: '8px' }}>
              &cross; Strictly Stripped & Excluded Leakage Columns:
            </div>
            <ul style={{ paddingLeft: '20px', fontSize: '12px', color: '#CBD5E1', lineHeight: 1.8 }}>
              <li><strong>Machine failure:</strong> The target label itself</li>
              <li><strong>TWF:</strong> Tool Wear Failure mode label</li>
              <li><strong>HDF:</strong> Heat Dissipation Failure mode label</li>
              <li><strong>PWF:</strong> Power Failure mode label</li>
              <li><strong>OSF:</strong> Overstrain Failure mode label</li>
              <li><strong>RNF:</strong> Random Failure mode label</li>
              <li><strong>UDI / Product ID:</strong> Non-physical tracking keys</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Technology Stack Details */}
      <div className="maintiq-card">
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC', marginBottom: '12px' }}>
          Technical Architecture & Dependencies
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '12px' }}>
          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px' }}>
            <div style={{ color: '#14B8A6', fontWeight: 700, marginBottom: '2px' }}>Frontend</div>
            <div style={{ color: '#94A3B8' }}>React 19 + TypeScript 5.7</div>
          </div>
          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px' }}>
            <div style={{ color: '#14B8A6', fontWeight: 700, marginBottom: '2px' }}>Machine Learning</div>
            <div style={{ color: '#94A3B8' }}>@kanaries/ml v1.1.0</div>
          </div>
          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px' }}>
            <div style={{ color: '#14B8A6', fontWeight: 700, marginBottom: '2px' }}>Visualizations</div>
            <div style={{ color: '#94A3B8' }}>Recharts v2.15</div>
          </div>
          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px' }}>
            <div style={{ color: '#14B8A6', fontWeight: 700, marginBottom: '2px' }}>Local Storage</div>
            <div style={{ color: '#94A3B8' }}>HTML5 browser localStorage</div>
          </div>
          <div style={{ background: '#0F172A', padding: '12px', borderRadius: '6px' }}>
            <div style={{ color: '#14B8A6', fontWeight: 700, marginBottom: '2px' }}>Deployment Target</div>
            <div style={{ color: '#94A3B8' }}>Google AI Studio Publish</div>
          </div>
        </div>
      </div>
    </div>
  );
};

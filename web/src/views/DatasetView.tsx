import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AI4IRecord, DatasetStatistics, DatasetValidationResult } from '../types';
import { DatasetService } from '../data/datasetService';

interface DatasetViewProps {
  records: AI4IRecord[];
  stats: DatasetStatistics;
  onDatasetUpdate: (newRecords: AI4IRecord[], validation: DatasetValidationResult) => void;
  onResetDefault: () => void;
}

export const DatasetView: React.FC<DatasetViewProps> = ({
  stats,
  onDatasetUpdate,
  onResetDefault
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [lastValidation, setLastValidation] = useState<DatasetValidationResult | null>(null);
  const [uploadNotice, setUploadNotice] = useState<{ type: 'error' | 'info' | 'success' | 'warning'; message: string } | null>(null);

  const handleFileUpload = async (file: File) => {
    setUploadNotice(null);
    try {
      const { records: parsedRecords, validation } = DatasetService.parseCSV(await file.text());
      setLastValidation(validation);

      if (!validation.isValid) {
        setUploadNotice({ type: 'error', message: validation.issues.find(issue => issue.type === 'error')?.message ?? 'No valid telemetry rows found.' });
        return;
      }

      if (!validation.hasTarget) {
        onDatasetUpdate(parsedRecords, validation);
        setUploadNotice({ type: 'info', message: `${file.name}: Dataset and sensor EDA updated with ${validation.validRows} unlabeled rows. Failure metrics are unavailable; models remain trained on the previous labeled dataset.` });
        return;
      }

      const failures = parsedRecords.filter(record => record.Machine_failure === 1).length;
      const normal = parsedRecords.length - failures;
      if (failures < 7 || normal < 7) {
        onDatasetUpdate(parsedRecords, validation);
        setUploadNotice({ type: 'warning', message: `${file.name}: Dataset and EDA updated with ${validation.validRows} labeled rows, but training needs at least 7 rows per class (found ${normal} normal and ${failures} failure). Existing models were not retrained.` });
        return;
      }

      onDatasetUpdate(parsedRecords, validation);
      setUploadNotice({
        type: validation.skippedRows > 0 ? 'warning' : 'success',
        message: `${file.name}: Dataset and EDA updated with ${validation.validRows} labeled rows${validation.skippedRows > 0 ? `; ${validation.skippedRows} invalid rows were skipped` : ''}. Model training is updating.`
      });
    } catch {
      setUploadNotice({ type: 'error', message: `Could not read ${file.name}. Please choose a readable CSV file.` });
    }
  };

  const handleDownloadSample = () => {
    const csv = DatasetService.generateSampleCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'maintiq_ai4i_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validationStatus = !lastValidation
    ? { label: 'Schema Ready', className: 'badge-normal', hasError: false }
    : !lastValidation.isValid
      ? { label: 'Needs Review', className: 'badge-critical', hasError: true }
      : lastValidation.skippedRows > 0
        ? { label: 'Warnings', className: 'badge-warning', hasError: true }
        : { label: 'Validated', className: 'badge-normal', hasError: false };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Upload & Controls Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        {/* Upload Dropzone */}
        <div className="maintiq-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>Dataset Ingestion & Validation</h2>
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>In-browser parsing with automatic anti-leakage sanitization</p>
            </div>
            <button
              onClick={handleDownloadSample}
              className="maintiq-btn-secondary"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              <Download size={14} />
              <span>Sample CSV</span>
            </button>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                void handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: 1,
              border: `2px dashed ${dragOver ? '#14B8A6' : '#26354D'}`,
              borderRadius: '8px',
              padding: '30px 20px',
              textAlign: 'center',
              background: dragOver ? 'rgba(20, 184, 166, 0.05)' : '#0F172A',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  void handleFileUpload(e.target.files[0]);
                }
                e.currentTarget.value = '';
              }}
            />
            <div style={{ padding: '12px', borderRadius: '50%', background: '#131E36', color: '#14B8A6' }}>
              <UploadCloud size={24} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9' }}>
                Click to upload CSV or drag & drop file
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                Required: Type, Air temp, Process temp, Rotational speed, Torque, Tool wear
              </div>
            </div>
          </div>

          {uploadNotice && (
            <div role={uploadNotice.type === 'error' ? 'alert' : 'status'} aria-live="polite" style={{
              marginTop: '12px',
              padding: '10px',
              borderRadius: '6px',
              background: uploadNotice.type === 'error' ? '#3B1722' : uploadNotice.type === 'success' ? '#12352F' : uploadNotice.type === 'warning' ? '#3B2E17' : '#172440',
              color: uploadNotice.type === 'error' ? '#FDA4AF' : uploadNotice.type === 'success' ? '#99F6E4' : uploadNotice.type === 'warning' ? '#FCD34D' : '#BFDBFE',
              fontSize: '12px'
            }}>
              {uploadNotice.message}
            </div>
          )}

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onResetDefault}
              className="maintiq-btn-secondary"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              <RotateCcw size={14} />
              <span>Reset to UCI AI4I Default (1,000 records)</span>
            </button>
          </div>
        </div>

        {/* Validation Status & Anti-Leakage Checklist */}
        <div className="maintiq-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>Schema & Anti-Leakage Audit</h2>
            <span className={`maintiq-badge ${validationStatus.className}`}>
              {validationStatus.hasError ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
              <span>{validationStatus.label}</span>
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
            <div style={{ padding: '10px', background: '#0F172A', borderRadius: '6px', border: '1px solid #1E293B' }}>
              <div style={{ fontWeight: 700, color: '#14B8A6', marginBottom: '4px' }}>
                6 Authorized Input Features:
              </div>
              <div style={{ color: '#94A3B8', lineHeight: 1.5 }}>
                1. Type (L/M/H) &bull; 2. Air temperature [K] &bull; 3. Process temperature [K] &bull; 4. Rotational speed [rpm] &bull; 5. Torque [Nm] &bull; 6. Tool wear [min]
              </div>
            </div>

            <div style={{ padding: '10px', background: '#0F172A', borderRadius: '6px', border: '1px solid #1E293B' }}>
              <div style={{ fontWeight: 700, color: '#F43F5E', marginBottom: '4px' }}>
                Excluded Target & Leakage Columns:
              </div>
              <div style={{ color: '#94A3B8', lineHeight: 1.5 }}>
                Machine failure (target), TWF, HDF, PWF, OSF, RNF, UDI, Product ID.
              </div>
            </div>

            {lastValidation && (
              <div style={{ padding: '10px', background: '#172440', borderRadius: '6px', border: '1px solid #203052' }}>
                <div style={{ fontWeight: 700, color: '#F59E0B', marginBottom: '4px' }}>
                  CSV Validation: {lastValidation.validRows} valid / {lastValidation.totalRows} rows
                </div>
                {lastValidation.issues.map((iss, i) => (
                  <div key={i} style={{ color: '#CBD5E1', fontSize: '11px' }}>
                    &bull; {iss.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Exploratory Data Analysis: Descriptive Statistics Table */}
      <div className="maintiq-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>Descriptive Statistics of Telemetry Features</h2>
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>Calculated across {stats.totalRecords.toLocaleString()} active telemetry rows</p>
          </div>
          <span className="maintiq-badge badge-teal">Parametric Summary</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1E293B', color: '#64748B', textTransform: 'uppercase', fontSize: '11px' }}>
                <th style={{ padding: '10px 12px' }}>Feature</th>
                <th style={{ padding: '10px 12px' }}>Count</th>
                <th style={{ padding: '10px 12px' }}>Mean</th>
                <th style={{ padding: '10px 12px' }}>Std Dev</th>
                <th style={{ padding: '10px 12px' }}>Min</th>
                <th style={{ padding: '10px 12px' }}>25%</th>
                <th style={{ padding: '10px 12px' }}>Median (50%)</th>
                <th style={{ padding: '10px 12px' }}>75%</th>
                <th style={{ padding: '10px 12px' }}>Max</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.featureStats).map(([feat, s], idx) => (
                <tr
                  key={feat}
                  style={{
                    borderBottom: '1px solid #1E293B',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)'
                  }}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#F1F5F9' }}>{feat}</td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8' }} className="sensor-metric">{s.count}</td>
                  <td style={{ padding: '10px 12px', color: '#14B8A6' }} className="sensor-metric">{s.mean}</td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8' }} className="sensor-metric">{s.std}</td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8' }} className="sensor-metric">{s.min}</td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8' }} className="sensor-metric">{s.p25}</td>
                  <td style={{ padding: '10px 12px', color: '#F1F5F9', fontWeight: 700 }} className="sensor-metric">{s.median}</td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8' }} className="sensor-metric">{s.p75}</td>
                  <td style={{ padding: '10px 12px', color: '#94A3B8' }} className="sensor-metric">{s.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Target Correlation Analysis */}
      <div className="maintiq-card">
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC', marginBottom: '8px' }}>
          Pearson Correlation with Machine Failure
        </h2>
        <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>
          Linear correlation coefficients between input sensor signals and the failure binary target
        </p>

        {!stats.hasTarget ? (
          <div style={{ padding: '12px', background: '#0F172A', borderRadius: '8px', border: '1px solid #1E293B', color: '#94A3B8', fontSize: '12px' }}>
            Machine failure labels were not included in this CSV, so target correlations and failure rates cannot be calculated. Sensor statistics above are based on the uploaded rows.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {stats.correlationsWithTarget.map(c => {
              const isPos = c.correlation >= 0;
              const barWidth = Math.min(100, Math.abs(c.correlation) * 150);
              return (
                <div key={c.feature} style={{ background: '#0F172A', padding: '12px', borderRadius: '8px', border: '1px solid #1E293B' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>{c.feature}</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: isPos ? '#14B8A6' : '#3B82F6' }}>
                    {isPos ? `+${c.correlation}` : c.correlation}
                  </div>
                  <div style={{ width: '100%', height: '4px', background: '#1E293B', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${barWidth}%`, height: '100%', background: isPos ? '#14B8A6' : '#3B82F6' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

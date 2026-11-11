import React, { useRef, useState } from 'react';
import {
  Download,
  Filter,
  FileSpreadsheet,
  LoaderCircle,
  Play
} from 'lucide-react';
import { unzip } from 'fflate';
import { PredictionInput, PredictionOutput } from '../types';
import { DatasetService } from '../data/datasetService';
import { mlEngine } from '../ml/engine';
import { StorageService } from '../services/storageService';

interface BatchPredictionRow {
  sourceFile: string;
  sourceRow: number;
  prediction: PredictionOutput;
}

interface UploadFileResult {
  name: string;
  status: 'success' | 'warning' | 'error' | 'skipped';
  message: string;
  details: string[];
}

interface ProcessingProgress {
  phase: 'preparing' | 'executing';
  current: number;
  total: number;
  fileName: string;
  rowsProcessed: number;
  totalRows: number;
}

interface CsvJob {
  name: string;
  readText: () => Promise<string>;
}

const MAX_CSV_SIZE = 50 * 1024 * 1024;
const MAX_ZIP_SIZE = 25 * 1024 * 1024;
const MAX_ZIP_CSV_SIZE = 100 * 1024 * 1024;

const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

const extractCsvFiles = async (file: File): Promise<{
  entries: { name: string; data: Uint8Array }[];
  skippedEntries: number;
}> => {
  if (file.size > MAX_ZIP_SIZE) {
    throw new Error('ZIP file is larger than the 25 MB upload limit.');
  }

  const data = new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    let totalExpandedSize = 0;
    let skippedEntries = 0;
    let exceededSizeLimit = false;

    unzip(data, {
      filter: entry => {
        if (!entry.name.toLowerCase().endsWith('.csv')) {
          skippedEntries++;
          return false;
        }
        totalExpandedSize += entry.originalSize;
        if (totalExpandedSize > MAX_ZIP_CSV_SIZE) {
          exceededSizeLimit = true;
          return false;
        }
        return true;
      }
    }, (error, files) => {
      if (error) {
        reject(new Error('Could not read the ZIP archive.'));
      } else if (exceededSizeLimit) {
        reject(new Error('CSV files inside this ZIP exceed the 100 MB expanded size limit.'));
      } else {
        resolve({
          entries: Object.entries(files).map(([name, contents]) => ({ name, data: contents })),
          skippedEntries
        });
      }
    });
  });
};

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export const BatchView: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [batchResults, setBatchResults] = useState<BatchPredictionRow[]>([]);
  const [fileResults, setFileResults] = useState<UploadFileResult[]>([]);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [executionSummary, setExecutionSummary] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState<'all' | 'Normal' | 'Warning' | 'Critical'>('all');
  const [batchStats, setBatchStats] = useState<{ total: number; critical: number; warning: number; normal: number; anomalies: number } | null>(null);

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    setBatchResults([]);
    setBatchStats(null);
    setFileResults([]);
    setProcessingProgress(null);
    setExecutionSummary(null);
  };

  const handleExecuteFiles = async () => {
    if (selectedFiles.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setBatchResults([]);
    setBatchStats(null);
    setFileResults([]);
    setExecutionSummary(null);

    const jobs: CsvJob[] = [];
    const fileReports: UploadFileResult[] = [];

    try {
      for (let index = 0; index < selectedFiles.length; index++) {
        const file = selectedFiles[index];
        setProcessingProgress({
          phase: 'preparing',
          current: index + 1,
          total: selectedFiles.length,
          fileName: file.name,
          rowsProcessed: 0,
          totalRows: 0
        });

        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension === 'csv') {
          if (file.size > MAX_CSV_SIZE) {
            fileReports.push({
              name: file.name,
              status: 'error',
              message: 'CSV file is larger than the 50 MB upload limit.',
              details: []
            });
          } else {
            jobs.push({ name: file.name, readText: () => file.text() });
          }
        } else if (extension === 'zip') {
          try {
            const { entries, skippedEntries } = await extractCsvFiles(file);
            if (entries.length === 0) {
              fileReports.push({
                name: file.name,
                status: 'error',
                message: 'No CSV files were found in this ZIP archive.',
                details: skippedEntries > 0 ? [`Skipped ${skippedEntries} non-CSV archive entries.`] : []
              });
            } else {
              fileReports.push({
                name: file.name,
                status: 'success',
                message: `Found ${entries.length} CSV file(s) in this ZIP archive.`,
                details: skippedEntries > 0 ? [`Skipped ${skippedEntries} non-CSV archive entries.`] : []
              });
              entries.forEach(entry => {
                jobs.push({
                  name: `${file.name} / ${entry.name}`,
                  readText: async () => new TextDecoder().decode(entry.data)
                });
              });
            }
          } catch (error) {
            fileReports.push({
              name: file.name,
              status: 'error',
              message: error instanceof Error ? error.message : 'Could not read the ZIP archive.',
              details: []
            });
          }
        } else {
          fileReports.push({
            name: file.name,
            status: 'skipped',
            message: 'Unsupported file type. Choose CSV or ZIP files.',
            details: []
          });
        }

        setFileResults([...fileReports]);
        await yieldToBrowser();
      }

      let allResults: BatchPredictionRow[] = [];
      let critical = 0;
      let warning = 0;
      let normal = 0;
      let anomalies = 0;
      let completedCsvFiles = 0;

      for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
        const job = jobs[jobIndex];
        setProcessingProgress({
          phase: 'executing',
          current: jobIndex + 1,
          total: jobs.length,
          fileName: job.name,
          rowsProcessed: 0,
          totalRows: 0
        });
        await yieldToBrowser();

        try {
          const { records, validation } = DatasetService.parseCSV(await job.readText());
          if (!validation.isValid) {
            fileReports.push({
              name: job.name,
              status: 'error',
              message: validation.issues.find(issue => issue.type === 'error')?.message ?? 'No valid telemetry rows found.',
              details: validation.issues.filter(issue => issue.type !== 'error').map(issue => issue.message)
            });
            setFileResults([...fileReports]);
            continue;
          }

          setProcessingProgress({
            phase: 'executing',
            current: jobIndex + 1,
            total: jobs.length,
            fileName: job.name,
            rowsProcessed: 0,
            totalRows: records.length
          });
          const predictionsForFile: BatchPredictionRow[] = [];

          for (let rowIndex = 0; rowIndex < records.length; rowIndex++) {
            const record = records[rowIndex];
            const input: PredictionInput = {
              Type: record.Type,
              Air_temperature_K: record.Air_temperature_K,
              Process_temperature_K: record.Process_temperature_K,
              Rotational_speed_rpm: record.Rotational_speed_rpm,
              Torque_Nm: record.Torque_Nm,
              Tool_wear_min: record.Tool_wear_min
            };
            const prediction = mlEngine.predict(input, 'xgboost');
            predictionsForFile.push({
              sourceFile: job.name,
              sourceRow: record.UDI + 1,
              prediction
            });
            if (prediction.riskCategory === 'Critical') critical++;
            else if (prediction.riskCategory === 'Warning') warning++;
            else normal++;
            if (prediction.isAnomaly) anomalies++;

            if ((rowIndex + 1) % 50 === 0 || rowIndex === records.length - 1) {
              setProcessingProgress({
                phase: 'executing',
                current: jobIndex + 1,
                total: jobs.length,
                fileName: job.name,
                rowsProcessed: rowIndex + 1,
                totalRows: records.length
              });
              await yieldToBrowser();
            }
          }

          allResults = [...allResults, ...predictionsForFile];
          setBatchResults(allResults);
          setBatchStats({
            total: allResults.length,
            critical,
            warning,
            normal,
            anomalies
          });
          fileReports.push({
            name: job.name,
            status: validation.skippedRows > 0 ? 'warning' : 'success',
            message: `Generated predictions for ${records.length} row(s).`,
            details: validation.issues.map(issue => issue.message)
          });
          completedCsvFiles++;
        } catch (error) {
          fileReports.push({
            name: job.name,
            status: 'error',
            message: error instanceof Error ? error.message : 'Could not process this CSV file.',
            details: []
          });
        }

        setFileResults([...fileReports]);
        await yieldToBrowser();
      }

      if (allResults.length > 0) {
        StorageService.addBatchPredictions(
          allResults.map(result => result.prediction),
          `batch_${Date.now()}`
        );
      }
      const failedFiles = fileReports.filter(result => result.status === 'error' || result.status === 'skipped').length;
      const warningFiles = fileReports.filter(result => result.status === 'warning').length;
      setExecutionSummary(
        `Execution finished: ${allResults.length} prediction(s) from ${completedCsvFiles} CSV file(s).${warningFiles ? ` ${warningFiles} file(s) completed with row warnings.` : ''}${failedFiles ? ` ${failedFiles} file(s) could not be processed; see details above.` : ''}`
      );
    } finally {
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  };

  const handleExportCSV = () => {
    if (batchResults.length === 0) return;
    const headers = [
      'Source_File',
      'Source_Row',
      'Record_ID',
      'Type',
      'Air_temp_K',
      'Process_temp_K',
      'Speed_rpm',
      'Torque_Nm',
      'Tool_wear_min',
      'Failure_Probability',
      'Risk_Category',
      'Anomaly_Score',
      'Is_Anomaly',
      'Spindle_Power_W',
      'Thermal_DeltaT_K',
      'Overstrain_Index',
      'Recommendation'
    ];
    const rows = batchResults.map(({ sourceFile, sourceRow, prediction }, i) => [
      csvCell(sourceFile),
      sourceRow,
      `BATCH_${i + 1}`,
      prediction.inputs.Type,
      prediction.inputs.Air_temperature_K,
      prediction.inputs.Process_temperature_K,
      prediction.inputs.Rotational_speed_rpm,
      prediction.inputs.Torque_Nm,
      prediction.inputs.Tool_wear_min,
      (prediction.probability * 100).toFixed(1) + '%',
      prediction.riskCategory,
      prediction.anomalyScore.toFixed(3),
      prediction.isAnomaly ? 'YES' : 'NO',
      prediction.physicalMetrics.powerWatts,
      prediction.physicalMetrics.deltaT.toFixed(1),
      prediction.physicalMetrics.overstrainIndex,
      csvCell(prediction.recommendation)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `maintiq_batch_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredResults = batchResults.filter(({ prediction }) => {
    if (filterRisk === 'all') return true;
    return prediction.riskCategory === filterRisk;
  });

  const progressValue = processingProgress
    ? processingProgress.phase === 'executing' && processingProgress.totalRows > 0
      ? processingProgress.current - 1 + processingProgress.rowsProcessed / processingProgress.totalRows
      : processingProgress.current - 1
    : 0;

  const statusColor: Record<UploadFileResult['status'], string> = {
    success: '#99F6E4',
    warning: '#FCD34D',
    error: '#FDA4AF',
    skipped: '#CBD5E1'
  };

  const statusLabel: Record<UploadFileResult['status'], string> = {
    success: 'Complete',
    warning: 'Completed with warnings',
    error: 'Failed',
    skipped: 'Skipped'
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Upload Drop Area */}
      <div className="maintiq-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>Batch Telemetry Inference</h2>
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>Select multiple CSV files or a ZIP archive. Each valid row updates the prediction results.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => void handleExecuteFiles()}
              disabled={selectedFiles.length === 0 || isProcessing}
              className="maintiq-btn-primary"
              aria-busy={isProcessing}
              style={{ fontSize: '12px', opacity: selectedFiles.length === 0 || isProcessing ? 0.6 : 1 }}
            >
              {isProcessing ? <LoaderCircle className="animate-spin" size={14} /> : <Play size={14} />}
              <span>{isProcessing ? 'Executing...' : 'Execute Selected Files'}</span>
            </button>
            {batchResults.length > 0 && (
              <button onClick={handleExportCSV} className="maintiq-btn-secondary" style={{ fontSize: '12px' }}>
                <Download size={14} />
                <span>Export Results</span>
              </button>
            )}
          </div>
        </div>

        <div
          onDragOver={event => event.preventDefault()}
          onDrop={event => {
            event.preventDefault();
            if (!isProcessing && event.dataTransfer.files.length > 0) {
              handleFilesSelected(Array.from(event.dataTransfer.files));
            }
          }}
          onClick={() => {
            if (!isProcessing) fileInputRef.current?.click();
          }}
          style={{
            border: '2px dashed #26354D',
            borderRadius: '8px',
            padding: '28px',
            textAlign: 'center',
            background: '#0F172A',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv,.zip,text/csv,application/zip"
            multiple
            style={{ display: 'none' }}
            disabled={isProcessing}
            onChange={event => {
              if (event.currentTarget.files) {
                handleFilesSelected(Array.from(event.currentTarget.files));
              }
              event.currentTarget.value = '';
            }}
          />
          <div style={{ padding: '10px', borderRadius: '50%', background: '#131E36', color: '#14B8A6' }}>
            <FileSpreadsheet size={24} />
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9' }}>
            {isProcessing ? 'Executing selected files...' : 'Choose or drop CSV / ZIP files'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>
            Required CSV columns: Type, air temperature, process temperature, speed, torque, and tool wear. Labels are optional.
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <div style={{ marginTop: '10px', color: '#94A3B8', fontSize: '12px', overflowWrap: 'anywhere' }}>
            {selectedFiles.length} file(s) selected: {selectedFiles.map(file => file.name).join(', ')}
          </div>
        )}

        {processingProgress && (
          <div role="status" aria-live="polite" style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#99F6E4', fontSize: '12px', marginBottom: '6px' }}>
              <LoaderCircle className="animate-spin" size={14} />
              <span>
                {processingProgress.phase === 'preparing'
                  ? `Preparing ${processingProgress.current}/${processingProgress.total}: ${processingProgress.fileName}`
                  : `Executing ${processingProgress.current}/${processingProgress.total}: ${processingProgress.fileName}${processingProgress.totalRows > 0 ? ` (${processingProgress.rowsProcessed}/${processingProgress.totalRows} rows)` : ''}`}
              </span>
            </div>
            <progress
              aria-label="CSV execution progress"
              value={progressValue}
              max={Math.max(processingProgress.total, 1)}
              style={{ width: '100%', accentColor: '#14B8A6' }}
            />
          </div>
        )}

        {executionSummary && (
          <div role="status" aria-live="polite" style={{ marginTop: '12px', color: '#99F6E4', fontSize: '12px' }}>
            {executionSummary}
          </div>
        )}

        {fileResults.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ color: '#F1F5F9', fontSize: '13px', margin: 0 }}>File execution report</h3>
            {fileResults.map((result, index) => (
              <div key={`${result.name}-${index}`} style={{ background: '#0F172A', borderRadius: '6px', padding: '10px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ color: '#E2E8F0', overflowWrap: 'anywhere' }}>{result.name}</strong>
                  <span style={{ color: statusColor[result.status] }}>{statusLabel[result.status]}</span>
                </div>
                <div style={{ color: statusColor[result.status], marginTop: '4px' }}>{result.message}</div>
                {result.details.map((detail, detailIndex) => (
                  <div key={detailIndex} style={{ color: '#94A3B8', marginTop: '3px' }}>{detail}</div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Batch Summary Metrics */}
      {batchStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          <div className="maintiq-card" style={{ padding: '14px', borderLeft: '4px solid #14B8A6' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700 }}>BATCH SIZE</div>
            <div style={{ fontSize: '22px', fontWeight: 800 }}>{batchStats.total}</div>
            <div style={{ fontSize: '10px', color: '#64748B' }}>Total Machines</div>
          </div>
          <div className="maintiq-card" style={{ padding: '14px', borderLeft: '4px solid #F43F5E' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700 }}>CRITICAL RISK</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#F43F5E' }}>{batchStats.critical}</div>
            <div style={{ fontSize: '10px', color: '#64748B' }}>Immediate Action</div>
          </div>
          <div className="maintiq-card" style={{ padding: '14px', borderLeft: '4px solid #F59E0B' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700 }}>WARNING RISK</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#F59E0B' }}>{batchStats.warning}</div>
            <div style={{ fontSize: '10px', color: '#64748B' }}>Inspection Required</div>
          </div>
          <div className="maintiq-card" style={{ padding: '14px', borderLeft: '4px solid #10B981' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700 }}>NORMAL</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#10B981' }}>{batchStats.normal}</div>
            <div style={{ fontSize: '10px', color: '#64748B' }}>Within Bounds</div>
          </div>
          <div className="maintiq-card" style={{ padding: '14px', borderLeft: '4px solid #8B5CF6' }}>
            <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700 }}>ANOMALIES</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#8B5CF6' }}>{batchStats.anomalies}</div>
            <div style={{ fontSize: '10px', color: '#64748B' }}>Isolation Forest</div>
          </div>
        </div>
      )}

      {/* Batch Results Table */}
      {batchResults.length > 0 && (
        <div className="maintiq-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>
              Batch Classification Records ({filteredResults.length} / {batchResults.length})
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={14} color="#64748B" />
              {(['all', 'Critical', 'Warning', 'Normal'] as const).map(risk => (
                <button
                  key={risk}
                  onClick={() => setFilterRisk(risk)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid #1E293B',
                    background: filterRisk === risk ? '#14B8A6' : '#131E36',
                    color: filterRisk === risk ? '#0A0F1D' : '#94A3B8',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                >
                  {risk}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#131E36' }}>
                <tr style={{ borderBottom: '1px solid #1E293B', color: '#64748B', textTransform: 'uppercase', fontSize: '11px' }}>
                  <th style={{ padding: '8px 10px' }}>Source File / Row</th>
                  <th style={{ padding: '8px 10px' }}>Type</th>
                  <th style={{ padding: '8px 10px' }}>Speed</th>
                  <th style={{ padding: '8px 10px' }}>Torque</th>
                  <th style={{ padding: '8px 10px' }}>Wear</th>
                  <th style={{ padding: '8px 10px' }}>Probability</th>
                  <th style={{ padding: '8px 10px' }}>Risk Category</th>
                  <th style={{ padding: '8px 10px' }}>Anomaly</th>
                  <th style={{ padding: '8px 10px' }}>Directive</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map(({ sourceFile, sourceRow, prediction: r }) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: '8px 10px', color: '#64748B', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${sourceFile} row ${sourceRow}`}>
                      {sourceFile} · {sourceRow}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.inputs.Type}</td>
                    <td style={{ padding: '8px 10px', color: '#94A3B8' }} className="sensor-metric">{r.inputs.Rotational_speed_rpm} rpm</td>
                    <td style={{ padding: '8px 10px', color: '#94A3B8' }} className="sensor-metric">{r.inputs.Torque_Nm} Nm</td>
                    <td style={{ padding: '8px 10px', color: '#94A3B8' }} className="sensor-metric">{r.inputs.Tool_wear_min} min</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: r.riskCategory === 'Critical' ? '#F43F5E' : (r.riskCategory === 'Warning' ? '#F59E0B' : '#10B981') }} className="sensor-metric">
                      {r.riskPercentage}%
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span className={`maintiq-badge ${r.riskCategory === 'Critical' ? 'badge-critical' : (r.riskCategory === 'Warning' ? 'badge-warning' : 'badge-normal')}`}>
                        {r.riskCategory}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {r.isAnomaly ? (
                        <span className="maintiq-badge badge-anomaly">Anomaly</span>
                      ) : (
                        <span style={{ color: '#64748B', fontSize: '11px' }}>Nominal</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#CBD5E1', fontSize: '11px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.recommendation}>
                      {r.recommendation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

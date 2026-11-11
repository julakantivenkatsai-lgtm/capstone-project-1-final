import React, { useState } from 'react';
import {
  History,
  Download,
  Trash2,
  Search
} from 'lucide-react';
import { PredictionHistoryItem } from '../types';
import { StorageService } from '../services/storageService';

interface HistoryViewProps {
  history: PredictionHistoryItem[];
  onClearHistory: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onClearHistory }) => {
  const [filterRisk, setFilterRisk] = useState<'all' | 'Normal' | 'Warning' | 'Critical'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleExportCSV = () => {
    const csv = StorageService.exportHistoryCSV();
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `maintiq_audit_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredHistory = history.filter(item => {
    if (filterRisk !== 'all' && item.riskCategory !== filterRisk) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchText = `${item.id} ${item.inputs.Type} ${item.recommendation} ${item.primaryRiskFactor}`.toLowerCase();
      return matchText.includes(q);
    }
    return true;
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Controls */}
      <div className="maintiq-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#F8FAFC' }}>
            Local Prediction Audit Logs ({history.length} records)
          </h2>
          <p style={{ fontSize: '12px', color: '#94A3B8' }}>
            Persisted securely in browser localStorage without external telemetry transmission
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {history.length > 0 && (
            <>
              <button onClick={handleExportCSV} className="maintiq-btn-primary" style={{ fontSize: '12px' }}>
                <Download size={14} />
                <span>Export Audit CSV</span>
              </button>
              <button onClick={onClearHistory} className="maintiq-btn-secondary" style={{ fontSize: '12px', color: '#F43F5E' }}>
                <Trash2 size={14} />
                <span>Clear History</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search size={16} color="#64748B" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search by ID, type, or directive..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="maintiq-input"
            style={{ paddingLeft: '36px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'Critical', 'Warning', 'Normal'] as const).map(risk => (
            <button
              key={risk}
              onClick={() => setFilterRisk(risk)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #1E293B',
                background: filterRisk === risk ? '#14B8A6' : '#131E36',
                color: filterRisk === risk ? '#0A0F1D' : '#94A3B8',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              {risk}
            </button>
          ))}
        </div>
      </div>

      {/* History Table */}
      <div className="maintiq-card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredHistory.length > 0 ? (
          <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#131E36', zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid #1E293B', color: '#64748B', textTransform: 'uppercase', fontSize: '11px' }}>
                  <th style={{ padding: '12px 14px' }}>Timestamp</th>
                  <th style={{ padding: '12px 14px' }}>Variant</th>
                  <th style={{ padding: '12px 14px' }}>Speed</th>
                  <th style={{ padding: '12px 14px' }}>Torque</th>
                  <th style={{ padding: '12px 14px' }}>Wear</th>
                  <th style={{ padding: '12px 14px' }}>Probability</th>
                  <th style={{ padding: '12px 14px' }}>Risk Category</th>
                  <th style={{ padding: '12px 14px' }}>Anomaly</th>
                  <th style={{ padding: '12px 14px' }}>Maintenance Directive</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    style={{
                      borderBottom: '1px solid #1E293B',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)'
                    }}
                  >
                    <td style={{ padding: '10px 14px', color: '#64748B', whiteSpace: 'nowrap' }}>
                      {item.timestamp}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#F1F5F9' }}>
                      Type {item.inputs.Type}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#94A3B8' }} className="sensor-metric">
                      {item.inputs.Rotational_speed_rpm} rpm
                    </td>
                    <td style={{ padding: '10px 14px', color: '#94A3B8' }} className="sensor-metric">
                      {item.inputs.Torque_Nm} Nm
                    </td>
                    <td style={{ padding: '10px 14px', color: '#94A3B8' }} className="sensor-metric">
                      {item.inputs.Tool_wear_min} min
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: item.riskCategory === 'Critical' ? '#F43F5E' : (item.riskCategory === 'Warning' ? '#F59E0B' : '#10B981') }} className="sensor-metric">
                      {item.riskPercentage}%
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span className={`maintiq-badge ${item.riskCategory === 'Critical' ? 'badge-critical' : (item.riskCategory === 'Warning' ? 'badge-warning' : 'badge-normal')}`}>
                        {item.riskCategory}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {item.isAnomaly ? (
                        <span className="maintiq-badge badge-anomaly">Anomaly</span>
                      ) : (
                        <span style={{ color: '#64748B', fontSize: '11px' }}>Nominal</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#CBD5E1', fontSize: '11px', maxWidth: '320px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.recommendation}>
                      {item.recommendation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
            <History size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8' }}>No predictions found</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>
              Run single predictions or batch inference to populate this local audit log.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

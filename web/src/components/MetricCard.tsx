import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  trend?: {
    text: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon,
  accentColor = '#14B8A6',
  trend,
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      className="maintiq-card"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderLeft: `4px solid ${accentColor}`,
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        {icon && (
          <div
            style={{
              padding: '6px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.04)',
              color: accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div style={{ fontSize: '26px', fontWeight: 800, color: '#F8FAFC', marginBottom: '4px', letterSpacing: '-0.02em' }}>
        {value}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        {subtext && (
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            {subtext}
          </span>
        )}
        {trend && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: trend.isNeutral ? '#94A3B8' : (trend.isPositive ? '#10B981' : '#F43F5E')
            }}
          >
            {trend.text}
          </span>
        )}
      </div>
    </div>
  );
};

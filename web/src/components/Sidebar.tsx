import React from 'react';
import {
  LayoutDashboard,
  Database,
  Gauge,
  Layers,
  BarChart3,
  ShieldAlert,
  Sliders,
  History,
  Info,
  ChevronLeft,
  ChevronRight,
  Cpu,
  LogOut
} from 'lucide-react';
import { NavigationTab } from '../types';

interface SidebarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  datasetCount: number;
  historyCount: number;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  datasetCount,
  historyCount,
  onLogout
}) => {
  const navItems: { id: NavigationTab; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'dataset', label: 'Dataset & EDA', icon: <Database size={18} />, badge: datasetCount > 0 ? datasetCount.toLocaleString() : undefined },
    { id: 'predict', label: 'Single Predictor', icon: <Gauge size={18} /> },
    { id: 'batch', label: 'Batch Inference', icon: <Layers size={18} /> },
    { id: 'models', label: 'Model Comparison', icon: <BarChart3 size={18} /> },
    { id: 'anomaly', label: 'Anomaly Detection', icon: <ShieldAlert size={18} /> },
    { id: 'explain', label: 'Explainability & What-If', icon: <Sliders size={18} /> },
    { id: 'history', label: 'Prediction History', icon: <History size={18} />, badge: historyCount > 0 ? historyCount : undefined },
    { id: 'about', label: 'About & Methodology', icon: <Info size={18} /> }
  ];

  return (
    <aside
      style={{
        width: isCollapsed ? '72px' : '260px',
        minWidth: isCollapsed ? '72px' : '260px',
        background: '#0D1527',
        borderRight: '1px solid #1E293B',
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 40,
        userSelect: 'none'
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: isCollapsed ? '20px 12px' : '20px 18px',
          borderBottom: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0A0F1D',
              fontWeight: 800,
              flexShrink: 0,
              boxShadow: '0 0 12px rgba(20, 184, 166, 0.3)'
            }}
          >
            <Cpu size={20} />
          </div>
          {!isCollapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Maint<span style={{ color: '#14B8A6' }}>IQ</span>
              </div>
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Machine Health Intel
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation List */}
      <nav style={{ flex: 1, padding: '16px 8px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: isCollapsed ? '10px 0' : '10px 14px',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  borderRadius: '8px',
                  border: isActive ? '1px solid rgba(20, 184, 166, 0.4)' : '1px solid transparent',
                  background: isActive ? 'rgba(20, 184, 166, 0.12)' : 'transparent',
                  color: isActive ? '#14B8A6' : '#94A3B8',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
              >
                <div style={{ color: isActive ? '#14B8A6' : '#64748B', display: 'flex', alignItems: 'center' }}>{item.icon}</div>
                {!isCollapsed && (
                  <>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '999px',
                          background: isActive ? 'rgba(20, 184, 166, 0.25)' : '#1E293B',
                          color: isActive ? '#2DD4BF' : '#64748B'
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Logout Button */}
      {onLogout && (
        <div style={{ padding: '12px', borderTop: '1px solid #1E293B' }}>
          <button
            onClick={onLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(20, 184, 166, 0.12)',
              color: '#14B8A6',
              border: '1px solid rgba(20, 184, 166, 0.4)',
              cursor: 'pointer'
            }}
          >
            <LogOut size={16} />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      )}
    </aside>
  );
};

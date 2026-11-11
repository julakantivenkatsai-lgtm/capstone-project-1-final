import React, { useEffect, useState } from 'react';
import { AuthService } from './services/authService';
import { LoginPage } from './pages/LoginPage';

import {
  AI4IRecord,
  DatasetStatistics,
  DatasetValidationResult,
  ModelComparisonResult,
  NavigationTab,
  PredictionHistoryItem
} from './types';
import { DatasetService } from './data/datasetService';
import { mlEngine } from './ml/engine';
import { StorageService } from './services/storageService';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './views/DashboardView';
import { DatasetView } from './views/DatasetView';
import { PredictView } from './views/PredictView';
import { BatchView } from './views/BatchView';
import { ModelComparisonView } from './views/ModelComparisonView';
import { AnomalyView } from './views/AnomalyView';
import { ExplainabilityView } from './views/ExplainabilityView';
import { HistoryView } from './views/HistoryView';
import { AboutView } from './views/AboutView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Auth state
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Dataset state
  const [records, setRecords] = useState<AI4IRecord[]>([]);
  const [datasetName, setDatasetName] = useState<string>('UCI AI4I 2020 Default');
  const [stats, setStats] = useState<DatasetStatistics>({
    totalRecords: 0,
    hasTarget: false,
    failureCount: null,
    normalCount: null,
    failureRatePercentage: null,
    typeDistribution: { L: 0, M: 0, H: 0 },
    featureStats: {},
    correlationsWithTarget: []
  });

  // ML Engine state
  const [comparison, setComparison] = useState<ModelComparisonResult | null>(null);
  const [isModelTrained, setIsModelTrained] = useState<boolean>(false);
  const [isRetraining, setIsRetraining] = useState<boolean>(false);

  // Prediction history state
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);

  // Initial auth check
  useEffect(() => {
    AuthService.checkSession()
      .then(setIsAuthenticated)
      .finally(() => setAuthChecked(true));
  }, []);

  // Load data after auth
  useEffect(() => {
    if (!isAuthenticated) return;
    const defaultData = DatasetService.getReferenceDataset();
    setRecords(defaultData);
    setDatasetName('UCI AI4I 2020 Default');
    setStats(DatasetService.computeStatistics(defaultData, true));
    setHistory(StorageService.getHistory());
    trainEngine(defaultData);
  }, [isAuthenticated]);

  const trainEngine = (data: AI4IRecord[]) => {
    setIsRetraining(true);
    setTimeout(() => {
      try {
        const result = mlEngine.train(data);
        setComparison(result);
        setIsModelTrained(true);
      } catch (err) {
        console.error('ML training error:', err);
      } finally {
        setIsRetraining(false);
      }
    }, 50);
  };

  const handleDatasetUpdate = (newRecords: AI4IRecord[], validation: DatasetValidationResult) => {
    setRecords(newRecords);
    setStats(DatasetService.computeStatistics(newRecords, validation.hasTarget));

    const failures = newRecords.filter(record => record.Machine_failure === 1).length;
    const normal = newRecords.length - failures;
    const canTrainModels = validation.hasTarget && failures >= 7 && normal >= 7;
    setDatasetName(canTrainModels ? 'Custom Uploaded CSV' : 'Custom Uploaded CSV (EDA only)');
    if (canTrainModels) {
      trainEngine(newRecords);
    }
  };

  const handleResetDefault = () => {
    const defaultData = DatasetService.getReferenceDataset();
    setRecords(defaultData);
    setDatasetName('UCI AI4I 2020 Default');
    setStats(DatasetService.computeStatistics(defaultData, true));
    trainEngine(defaultData);
  };

  const handlePredictionSaved = (pred: PredictionHistoryItem) => {
    setHistory(prev => [pred, ...prev]);
  };

  const handleClearHistory = () => {
    StorageService.clearHistory();
    setHistory([]);
  };

  const handleLogout = async () => {
    await AuthService.logout();
    setIsAuthenticated(false);
  };

  const canRetrainModels = stats.hasTarget &&
    records.filter(record => record.Machine_failure === 1).length >= 7 &&
    records.filter(record => record.Machine_failure === 0).length >= 7;

  if (!authChecked) {
    return <div style={{ color: '#F8FAFC', padding: '2rem' }}>Checking authentication…</div>;
  }

  if (!isAuthenticated) {
    return <LoginPage onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0A0F1D' }}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        datasetCount={stats.totalRecords}
        historyCount={history.length}
        onLogout={handleLogout}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        <Header
          activeTab={activeTab}
          datasetName={datasetName}
          totalRecords={stats.totalRecords}
          failureRate={stats.failureRatePercentage}
          isModelTrained={isModelTrained}
          onRetrain={canRetrainModels ? () => trainEngine(records) : undefined}
          isRetraining={isRetraining}
        />
        <main style={{ flex: 1, padding: '24px 28px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
          {activeTab === 'dashboard' && (
            <DashboardView stats={stats} comparison={comparison} setActiveTab={setActiveTab} />
          )}
          {activeTab === 'dataset' && (
            <DatasetView records={records} stats={stats} onDatasetUpdate={handleDatasetUpdate} onResetDefault={handleResetDefault} />
          )}
          {activeTab === 'predict' && <PredictView onPredictionSaved={handlePredictionSaved} />}
          {activeTab === 'batch' && <BatchView />}
          {activeTab === 'models' && <ModelComparisonView comparison={comparison} />}
          {activeTab === 'anomaly' && <AnomalyView records={records} />}
          {activeTab === 'explain' && <ExplainabilityView comparison={comparison} />}
          {activeTab === 'history' && <HistoryView history={history} onClearHistory={handleClearHistory} />}
          {activeTab === 'about' && <AboutView />}
        </main>
      </div>
    </div>
  );
};
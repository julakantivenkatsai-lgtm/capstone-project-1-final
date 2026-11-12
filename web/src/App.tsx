import React, { useEffect, useRef, useState } from 'react';
import { AuthService } from './services/authService';
import { LoginPage } from './pages/LoginPage';

import {
  AI4IRecord,
  ActiveDataset,
  DatasetStatistics,
  DatasetValidationResult,
  ModelComparisonResult,
  NavigationTab,
  PredictionHistoryItem
} from './types';
import { ActiveDatasetService, SavedDatasetResult } from './data/activeDatasetService';
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
  const [activeTab, setActiveTab] = useState<NavigationTab>('dataset');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Auth state
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Dataset state
  const [records, setRecords] = useState<AI4IRecord[]>([]);
  const [datasetName, setDatasetName] = useState<string>('');
  const [stats, setStats] = useState<DatasetStatistics>(() => DatasetService.computeStatistics([], false));
  const [isDatasetLoading, setIsDatasetLoading] = useState(false);
  const [datasetLoadError, setDatasetLoadError] = useState<string | null>(null);
  const [datasetPersistenceWarning, setDatasetPersistenceWarning] = useState<string | null>(null);

  // ML Engine state
  const [comparison, setComparison] = useState<ModelComparisonResult | null>(null);
  const [isModelTrained, setIsModelTrained] = useState<boolean>(false);
  const [isAnomalyModelTrained, setIsAnomalyModelTrained] = useState<boolean>(false);
  const [isRetraining, setIsRetraining] = useState<boolean>(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);

  // Prediction history state
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
  const trainingRun = useRef(0);

  const cancelTraining = () => {
    trainingRun.current++;
    mlEngine.reset();
    setIsRetraining(false);
    setIsModelTrained(false);
    setIsAnomalyModelTrained(false);
    setTrainingError(null);
  };

  const trainEngine = (data: AI4IRecord[]) => {
    const currentRun = ++trainingRun.current;
    mlEngine.reset();
    setComparison(null);
    setIsModelTrained(false);
    setIsAnomalyModelTrained(false);
    setIsRetraining(true);
    setTrainingError(null);
    setTimeout(() => {
      if (currentRun !== trainingRun.current) return;
      try {
        const result = mlEngine.train(data);
        setComparison(result);
        setIsModelTrained(true);
        setIsAnomalyModelTrained(true);
      } catch (err) {
        console.error('ML training error:', err);
        setTrainingError(err instanceof Error ? err.message : 'Model training failed.');
      } finally {
        if (currentRun === trainingRun.current) setIsRetraining(false);
      }
    }, 50);
  };

  const trainAnomalyEngine = (data: AI4IRecord[]) => {
    const currentRun = ++trainingRun.current;
    mlEngine.reset();
    setComparison(null);
    setIsModelTrained(false);
    setIsAnomalyModelTrained(false);
    setIsRetraining(true);
    setTrainingError(null);
    setTimeout(() => {
      if (currentRun !== trainingRun.current) return;
      try {
        mlEngine.trainAnomaly(data);
        setIsAnomalyModelTrained(true);
      } catch (err) {
        console.error('Anomaly training error:', err);
        setTrainingError(err instanceof Error ? err.message : 'Anomaly detector training failed.');
      } finally {
        if (currentRun === trainingRun.current) setIsRetraining(false);
      }
    }, 50);
  };

  // Initial auth check
  useEffect(() => {
    AuthService.checkSession()
      .then(setIsAuthenticated)
      .finally(() => setAuthChecked(true));
  }, []);

  // Load data after auth
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setIsDatasetLoading(true);
    setDatasetLoadError(null);
    cancelTraining();
    setRecords([]);
    setDatasetName('');
    setStats(DatasetService.computeStatistics([], false));
    setComparison(null);
    setHistory(StorageService.getHistory());
    ActiveDatasetService.load()
      .then(result => {
        if (cancelled) return;
        const dataset: ActiveDataset | null = result.dataset;
        setDatasetPersistenceWarning(result.warning);
        if (!dataset) {
          setRecords([]);
          setDatasetName('');
          setStats(DatasetService.computeStatistics([], false));
          return;
        }

        setRecords(dataset.records);
        setDatasetName(dataset.name);
        setStats(DatasetService.computeStatistics(dataset.records, dataset.hasTarget));
        const failures = dataset.records.filter(record => record.Machine_failure === 1).length;
        const normal = dataset.records.length - failures;
        if (dataset.hasTarget && failures >= 7 && normal >= 7) {
          trainEngine(dataset.records);
        } else if (dataset.records.length > 0) {
          trainAnomalyEngine(dataset.records);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setDatasetLoadError(error instanceof Error ? error.message : 'Could not load the saved dataset.');
      })
      .finally(() => {
        if (!cancelled) setIsDatasetLoading(false);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const handleDatasetUpdate = async (
    newRecords: AI4IRecord[],
    validation: DatasetValidationResult,
    fileName: string
  ): Promise<SavedDatasetResult> => {
    const saveResult = await ActiveDatasetService.replace(fileName, newRecords, validation.hasTarget);
    const savedDataset = saveResult.dataset;
    setDatasetPersistenceWarning(saveResult.warning);
    setDatasetLoadError(null);
    setRecords(savedDataset.records);
    setDatasetName(savedDataset.name);
    setStats(DatasetService.computeStatistics(savedDataset.records, savedDataset.hasTarget));

    const failures = savedDataset.records.filter(record => record.Machine_failure === 1).length;
    const normal = savedDataset.records.length - failures;
    const canTrainModels = validation.hasTarget && failures >= 7 && normal >= 7;
    if (canTrainModels) {
      trainEngine(savedDataset.records);
    } else {
      trainAnomalyEngine(savedDataset.records);
    }
    return saveResult;
  };

  const handlePredictionSaved = (pred: PredictionHistoryItem) => {
    setHistory(prev => [pred, ...prev]);
  };

  const handleClearHistory = () => {
    StorageService.clearHistory();
    setHistory([]);
  };

  const handleLogout = async () => {
    cancelTraining();
    setRecords([]);
    setDatasetName('');
    setStats(DatasetService.computeStatistics([], false));
    setComparison(null);
    setDatasetLoadError(null);
    setDatasetPersistenceWarning(null);
    await AuthService.logout();
    setIsAuthenticated(false);
  };

  const handleTabChange = (tab: NavigationTab) => {
    const dataIndependentTabs: NavigationTab[] = ['dataset', 'about', 'dashboard', 'history'];
    if (!records.length && !dataIndependentTabs.includes(tab)) return;
    if (tab === 'anomaly' && !isAnomalyModelTrained) return;
    setActiveTab(tab);
  };

  const canTrainModels = stats.hasTarget &&
    records.filter(record => record.Machine_failure === 1).length >= 7 &&
    records.filter(record => record.Machine_failure === 0).length >= 7;
  const firstRecord = records[0];

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
        setActiveTab={handleTabChange}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        datasetCount={stats.totalRecords}
        hasDataset={records.length > 0}
        hasAnomalyModel={isAnomalyModelTrained}
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
          isAnomalyModelTrained={isAnomalyModelTrained}
          onRetrain={records.length > 0 ? () => canTrainModels ? trainEngine(records) : trainAnomalyEngine(records) : undefined}
          isRetraining={isRetraining}
        />
        <main style={{ flex: 1, padding: '24px 28px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
          {trainingError && (
            <div role="alert" style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '8px', background: '#3F1D2A', color: '#FDA4AF', fontSize: '12px' }}>
              Training failed: {trainingError}
            </div>
          )}
          {activeTab === 'dashboard' && (
            <DashboardView stats={stats} records={records} comparison={comparison} setActiveTab={handleTabChange} />
          )}
          {activeTab === 'dataset' && (
            <DatasetView
              records={records}
              stats={stats}
              isLoading={isDatasetLoading}
              loadError={datasetLoadError}
              persistenceWarning={datasetPersistenceWarning}
              onDatasetUpdate={handleDatasetUpdate}
            />
          )}
          {activeTab === 'predict' && firstRecord && (
            <PredictView onPredictionSaved={handlePredictionSaved} initialRecord={firstRecord} isModelTrained={isModelTrained} />
          )}
          {activeTab === 'batch' && records.length > 0 && <BatchView isModelTrained={isModelTrained} />}
          {activeTab === 'models' && <ModelComparisonView comparison={comparison} isRetraining={isRetraining} onGoToDataset={() => handleTabChange('dataset')} />}
          {activeTab === 'anomaly' && isAnomalyModelTrained && records.length > 0 && <AnomalyView records={records} />}
          {activeTab === 'explain' && firstRecord && (
            <ExplainabilityView comparison={comparison} initialRecord={firstRecord} isModelTrained={isModelTrained} />
          )}
          {activeTab === 'history' && <HistoryView history={history} onClearHistory={handleClearHistory} />}
          {activeTab === 'about' && <AboutView />}
        </main>
      </div>
    </div>
  );
};
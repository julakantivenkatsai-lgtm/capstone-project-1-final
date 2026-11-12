import { ActiveDataset, AI4IRecord } from '../types';

const LOCAL_DATASET_KEY = 'maintiq_active_uploaded_dataset_v1';

type DatasetPersistence = 'mongodb' | 'browser';

export interface DatasetStorageResult {
  dataset: ActiveDataset | null;
  persistence: DatasetPersistence;
  warning: string | null;
}

export interface SavedDatasetResult extends DatasetStorageResult {
  dataset: ActiveDataset;
}

class MongoUnavailableError extends Error {}

const readError = async (response: Response): Promise<string> => {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || `Dataset request failed (${response.status}).`;
};

const readBrowserDataset = (): ActiveDataset | null => {
  const serialized = localStorage.getItem(LOCAL_DATASET_KEY);
  if (!serialized) return null;

  const dataset = JSON.parse(serialized) as ActiveDataset;
  if (!dataset || !Array.isArray(dataset.records) || dataset.records.length === 0) {
    throw new Error('The browser-saved dataset is invalid. Upload the CSV again.');
  }
  return dataset;
};

const saveInBrowser = (
  dataset: ActiveDataset,
  reason: string
): SavedDatasetResult => {
  try {
    localStorage.setItem(LOCAL_DATASET_KEY, JSON.stringify(dataset));
  } catch {
    throw new Error('MongoDB is unavailable and the uploaded dataset could not be saved in browser storage.');
  }

  return {
    dataset,
    persistence: 'browser',
    warning: `${reason} The dataset is saved in this browser only and will not sync to other devices.`
  };
};

const saveInMongo = async (dataset: ActiveDataset): Promise<ActiveDataset> => {
  let response: Response;
  try {
    response = await fetch('/api/dataset', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: dataset.name,
        records: dataset.records,
        hasTarget: dataset.hasTarget
      })
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new MongoUnavailableError('The dataset server is unavailable.');
    }
    throw error;
  }

  if (response.status === 503) {
    throw new MongoUnavailableError(await readError(response));
  }
  if (!response.ok) throw new Error(await readError(response));
  const body = await response.json() as { dataset: ActiveDataset };
  return body.dataset;
};

const useBrowserDataset = (reason: string): DatasetStorageResult => ({
  dataset: readBrowserDataset(),
  persistence: 'browser',
  warning: `${reason} Uploads are available in browser-only mode and will not sync to other devices.`
});

export const ActiveDatasetService = {
  async load(): Promise<DatasetStorageResult> {
    let response: Response;
    try {
      response = await fetch('/api/dataset', { credentials: 'include' });
    } catch (error) {
      if (error instanceof TypeError) {
        return useBrowserDataset('The dataset server is unavailable.');
      }
      throw error;
    }

    if (response.status === 503) {
      return useBrowserDataset(await readError(response));
    }
    if (!response.ok) throw new Error(await readError(response));

    const body = await response.json() as { dataset: ActiveDataset | null };
    if (body.dataset) {
      return { dataset: body.dataset, persistence: 'mongodb', warning: null };
    }

    const browserDataset = readBrowserDataset();
    if (!browserDataset) return { dataset: null, persistence: 'mongodb', warning: null };

    try {
      const dataset = await saveInMongo(browserDataset);
      return { dataset, persistence: 'mongodb', warning: null };
    } catch (error) {
      if (error instanceof MongoUnavailableError) {
        return {
          dataset: browserDataset,
          persistence: 'browser',
          warning: `${error.message} The dataset is saved in this browser only and will not sync to other devices.`
        };
      }
      throw error;
    }
  },

  async replace(name: string, records: AI4IRecord[], hasTarget: boolean): Promise<SavedDatasetResult> {
    const dataset: ActiveDataset = {
      name,
      records,
      hasTarget,
      updatedAt: new Date().toISOString()
    };

    try {
      const savedDataset = await saveInMongo(dataset);
      localStorage.removeItem(LOCAL_DATASET_KEY);
      return { dataset: savedDataset, persistence: 'mongodb', warning: null };
    } catch (error) {
      if (error instanceof MongoUnavailableError) {
        return saveInBrowser(dataset, error.message);
      }
      throw error;
    }
  }
};

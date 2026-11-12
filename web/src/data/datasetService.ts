/**
 * MaintIQ – Dataset Service & Validation Engine
 * Parses uploaded CSV files in-browser,
 * checks data validity, and strips data-leakage features.
 */

import {
  AI4IRecord,
  DatasetStatistics,
  DatasetSummaryStats,
  DatasetValidationResult,
  MachineType,
  ValidationIssue
} from '../types';

export class DatasetService {
  private static parseRows(csvText: string): { rows: string[][]; malformed: boolean } {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      if (inQuotes) {
        if (char === '"' && csvText[i + 1] === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
      } else if (char === '"' && field.trim() === '') {
        field = '';
        inQuotes = true;
      } else if (char === ',') {
        row.push(field.trim());
        field = '';
      } else if (char === '\n' || char === '\r') {
        row.push(field.trim());
        if (row.some(value => value !== '')) rows.push(row);
        row = [];
        field = '';
        if (char === '\r' && csvText[i + 1] === '\n') i++;
      } else {
        field += char;
      }
    }

    if (inQuotes) return { rows, malformed: true };
    row.push(field.trim());
    if (row.some(value => value !== '')) rows.push(row);
    return { rows, malformed: false };
  }

  /**
   * Parse CSV text into validated records in the browser without external network calls.
   */
  static parseCSV(csvText: string): { records: AI4IRecord[]; validation: DatasetValidationResult } {
    const { rows, malformed } = this.parseRows(csvText.replace(/^\uFEFF/, ''));
    const issues: ValidationIssue[] = [];

    if (malformed) {
      return {
        records: [],
        validation: {
          isValid: false,
          hasTarget: false,
          totalRows: Math.max(0, rows.length - 1),
          validRows: 0,
          skippedRows: Math.max(0, rows.length - 1),
          detectedFeatures: [],
          missingFeatures: [],
          leakedColumnsExcluded: [],
          issues: [{ type: 'error', message: 'CSV contains an unclosed quoted field.' }]
        }
      };
    }

    if (rows.length < 2) {
      return {
        records: [],
        validation: {
          isValid: false,
          hasTarget: false,
          totalRows: 0,
          validRows: 0,
          skippedRows: 0,
          detectedFeatures: [],
          missingFeatures: ['All'],
          leakedColumnsExcluded: [],
          issues: [{ type: 'error', message: 'CSV file contains no data rows.' }]
        }
      };
    }

    const rawHeaders = rows[0];

    // Matching helper for flexible column header naming
    const matchCol = (names: string[]) => {
      return rawHeaders.findIndex(h =>
        names.some(n => h.toLowerCase().replace(/[\s_\[\]\-]/g, '') === n.toLowerCase().replace(/[\s_\[\]\-]/g, ''))
      );
    };

    const typeIdx = matchCol(['type', 'machinetype']);
    const airTempIdx = matchCol(['airtemperaturek', 'airtemperature', 'airtemp', 'airtempk']);
    const procTempIdx = matchCol(['processtemperaturek', 'processtemperature', 'processtemp', 'proctempk']);
    const speedIdx = matchCol(['rotationalspeedrpm', 'rotationalspeed', 'speedrpm', 'speed', 'rpm']);
    const torqueIdx = matchCol(['torquenm', 'torque']);
    const toolWearIdx = matchCol(['toolwearmin', 'toolwear', 'wearmin', 'wear']);
    const failureIdx = matchCol(['machinefailure', 'failure', 'target']);
    const hasTarget = failureIdx !== -1;

    // Check for leakable failure modes to exclude them
    const leakedFound: string[] = [];
    ['twf', 'hdf', 'pwf', 'osf', 'rnf', 'udi', 'productid'].forEach(leakName => {
      const idx = matchCol([leakName]);
      if (idx !== -1) {
        leakedFound.push(rawHeaders[idx]);
      }
    });

    const detectedFeatures: string[] = [];
    const missingFeatures: string[] = [];

    if (typeIdx !== -1) detectedFeatures.push('Type');
    else missingFeatures.push('Type');

    if (airTempIdx !== -1) detectedFeatures.push('Air temperature [K]');
    else missingFeatures.push('Air temperature [K]');

    if (procTempIdx !== -1) detectedFeatures.push('Process temperature [K]');
    else missingFeatures.push('Process temperature [K]');

    if (speedIdx !== -1) detectedFeatures.push('Rotational speed [rpm]');
    else missingFeatures.push('Rotational speed [rpm]');

    if (torqueIdx !== -1) detectedFeatures.push('Torque [Nm]');
    else missingFeatures.push('Torque [Nm]');

    if (toolWearIdx !== -1) detectedFeatures.push('Tool wear [min]');
    else missingFeatures.push('Tool wear [min]');

    if (missingFeatures.length > 0) {
      issues.push({
        type: 'error',
        message: `Missing required prediction features: ${missingFeatures.join(', ')}.`
      });
      return {
        records: [],
        validation: {
          isValid: false,
          hasTarget,
          totalRows: rows.length - 1,
          validRows: 0,
          skippedRows: rows.length - 1,
          detectedFeatures,
          missingFeatures,
          leakedColumnsExcluded: leakedFound,
          issues
        }
      };
    }

    if (leakedFound.length > 0) {
      issues.push({
        type: 'info',
        message: `Sanitized dataset: Excluded ${leakedFound.length} auxiliary/leakage columns (${leakedFound.join(', ')}) from prediction feature space.`
      });
    }

    if (!hasTarget) {
      issues.push({
        type: 'info',
        message: 'No Machine failure target column found. These rows can be used for batch inference, but not model training.'
      });
    }

    const records: AI4IRecord[] = [];
    let skipped = 0;
    let duplicateRows = 0;
    const seenRows = new Set<string>();
    const rowWarnings: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const rawType = cols[typeIdx]?.toUpperCase();
      const validTypes: MachineType[] = ['L', 'M', 'H'];

      const numericValues = [airTempIdx, procTempIdx, speedIdx, torqueIdx, toolWearIdx]
        .map(idx => cols[idx]?.trim() ? Number(cols[idx]) : NaN);
      const [airTemp, procTemp, speed, torque, wear] = numericValues;
      const rawFailure = hasTarget && cols[failureIdx]?.trim()
        ? Number(cols[failureIdx])
        : (hasTarget ? NaN : 0);
      const invalidFields: string[] = [];

      if (!validTypes.includes(rawType as MachineType)) {
        invalidFields.push('Type (expected L, M, or H)');
      }

      const numericNames = [
        'Air temperature [K]',
        'Process temperature [K]',
        'Rotational speed [rpm]',
        'Torque [Nm]',
        'Tool wear [min]'
      ];
      numericValues.forEach((value, index) => {
        if (!Number.isFinite(value)) {
          invalidFields.push(`${numericNames[index]} (missing or non-numeric)`);
        } else if (value < 0) {
          invalidFields.push(`${numericNames[index]} (negative)`);
        } else if (index < 2 && value === 0) {
          invalidFields.push(`${numericNames[index]} (must be above 0 K)`);
        }
      });

      if (hasTarget && rawFailure !== 0 && rawFailure !== 1) {
        invalidFields.push('Machine failure (expected 0 or 1)');
      }

      if (invalidFields.length > 0) {
        skipped++;
        if (rowWarnings.length < 10) {
          rowWarnings.push(`Row ${i + 1}: ${invalidFields.join(', ')}.`);
        }
        continue;
      }

      const type = rawType as MachineType;
      const duplicateKey = JSON.stringify([type, ...numericValues, rawFailure]);
      if (seenRows.has(duplicateKey)) duplicateRows++;
      else seenRows.add(duplicateKey);

      records.push({
        UDI: i,
        Product_ID: `IMPORT_${i}`,
        Type: type,
        Air_temperature_K: airTemp,
        Process_temperature_K: procTemp,
        Rotational_speed_rpm: Math.round(speed),
        Torque_Nm: torque,
        Tool_wear_min: wear,
        Machine_failure: rawFailure as 0 | 1
      });
    }

    if (skipped > 0) {
      issues.push({
        type: 'warning',
        message: `Skipped ${skipped} invalid rows. The first ${rowWarnings.length} affected row(s) are listed below.`
      });
      rowWarnings.forEach(message => issues.push({ type: 'warning', message }));
    }
    if (duplicateRows > 0) {
      issues.push({
        type: 'info',
        message: `Found ${duplicateRows} duplicate row(s). Duplicates are retained and processed as separate records.`
      });
    }
    if (records.length === 0) {
      issues.push({
        type: 'error',
        message: 'No valid telemetry rows were found. Check the required columns and row values.'
      });
    }

    return {
      records,
      validation: {
        isValid: records.length > 0,
        hasTarget,
        totalRows: rows.length - 1,
        validRows: records.length,
        skippedRows: skipped,
        detectedFeatures,
        missingFeatures: [],
        leakedColumnsExcluded: leakedFound,
        issues
      }
    };
  }

  /**
   * Compute descriptive statistics and target correlations across numerical features
   */
  static computeStatistics(records: AI4IRecord[], hasTarget = true): DatasetStatistics {
    const totalRecords = records.length;
    if (totalRecords === 0) {
      return {
        totalRecords: 0,
        hasTarget,
        failureCount: hasTarget ? 0 : null,
        normalCount: hasTarget ? 0 : null,
        failureRatePercentage: hasTarget ? 0 : null,
        typeDistribution: { L: 0, M: 0, H: 0 },
        featureStats: {},
        correlationsWithTarget: []
      };
    }

    let failures = 0;
    const typeCounts = { L: 0, M: 0, H: 0 };

    const airVals: number[] = [];
    const procVals: number[] = [];
    const speedVals: number[] = [];
    const torqueVals: number[] = [];
    const wearVals: number[] = [];
    const targetVals: number[] = [];

    records.forEach(r => {
      if (hasTarget && r.Machine_failure === 1) failures++;
      if (r.Type in typeCounts) typeCounts[r.Type]++;
      airVals.push(r.Air_temperature_K);
      procVals.push(r.Process_temperature_K);
      speedVals.push(r.Rotational_speed_rpm);
      torqueVals.push(r.Torque_Nm);
      wearVals.push(r.Tool_wear_min);
      if (hasTarget) targetVals.push(r.Machine_failure);
    });

    const calcSummary = (arr: number[]): DatasetSummaryStats => {
      const sorted = [...arr].sort((a, b) => a - b);
      const n = sorted.length;
      const sum = sorted.reduce((acc, v) => acc + v, 0);
      const mean = sum / n;
      const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
      const std = Math.sqrt(variance);

      const q = (p: number) => {
        const idx = Math.floor(p * (n - 1));
        return sorted[idx];
      };

      return {
        count: n,
        mean: parseFloat(mean.toFixed(2)),
        std: parseFloat(std.toFixed(2)),
        min: sorted[0],
        p25: q(0.25),
        median: q(0.50),
        p75: q(0.75),
        max: sorted[n - 1]
      };
    };

    // Pearson correlation
    const calcCorr = (x: number[], y: number[]): number => {
      const n = x.length;
      const meanX = x.reduce((a, b) => a + b, 0) / n;
      const meanY = y.reduce((a, b) => a + b, 0) / n;
      let num = 0;
      let denX = 0;
      let denY = 0;
      for (let i = 0; i < n; i++) {
        const dx = x[i] - meanX;
        const dy = y[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }
      const denom = Math.sqrt(denX * denY);
      return denom === 0 ? 0 : parseFloat((num / denom).toFixed(3));
    };

    return {
      totalRecords,
      hasTarget,
      failureCount: hasTarget ? failures : null,
      normalCount: hasTarget ? totalRecords - failures : null,
      failureRatePercentage: hasTarget ? parseFloat(((failures / totalRecords) * 100).toFixed(2)) : null,
      typeDistribution: typeCounts,
      featureStats: {
        'Air temperature [K]': calcSummary(airVals),
        'Process temperature [K]': calcSummary(procVals),
        'Rotational speed [rpm]': calcSummary(speedVals),
        'Torque [Nm]': calcSummary(torqueVals),
        'Tool wear [min]': calcSummary(wearVals)
      },
      correlationsWithTarget: hasTarget ? [
        { feature: 'Torque [Nm]', correlation: calcCorr(torqueVals, targetVals) },
        { feature: 'Tool wear [min]', correlation: calcCorr(wearVals, targetVals) },
        { feature: 'Air temperature [K]', correlation: calcCorr(airVals, targetVals) },
        { feature: 'Process temperature [K]', correlation: calcCorr(procVals, targetVals) },
        { feature: 'Rotational speed [rpm]', correlation: calcCorr(speedVals, targetVals) }
      ].sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)) : []
    };
  }

}

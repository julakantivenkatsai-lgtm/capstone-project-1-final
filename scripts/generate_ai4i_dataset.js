// Script to generate the representative UCI AI4I 2020 dataset
const fs = require('fs');
const path = require('path');

function gaussianRandom(mean = 0, stdev = 1) {
    let u = 1 - Math.random();
    let v = Math.random();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdev + mean;
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function generateDataset(numRecords = 1000) {
    const records = [];
    const types = ['L', 'M', 'H'];
    const typeWeights = [0.5, 0.3, 0.2];

    for (let i = 1; i <= numRecords; i++) {
        // Pick type
        const rand = Math.random();
        let type = 'L';
        if (rand > 0.8) type = 'H';
        else if (rand > 0.5) type = 'M';

        const udi = i;
        const productId = `${type}${47000 + i}`;

        // Air temperature [K] ~ N(300.0, 2.0) [295.3, 304.5]
        const airTemp = parseFloat(clamp(gaussianRandom(300.0, 2.0), 295.3, 304.5).toFixed(1));

        // Process temperature [K] ~ AirTemp + 10 + N(0, 1.0) [305.7, 313.8]
        const tempDelta = gaussianRandom(10.0, 1.0);
        const processTemp = parseFloat(clamp(airTemp + tempDelta, 305.7, 313.8).toFixed(1));

        // Rotational speed [rpm] ~ N(1538, 179) [1168, 2886]
        const rotationalSpeed = Math.round(clamp(gaussianRandom(1538, 179), 1168, 2886));

        // Torque [Nm] inverse relation with rotational speed around 40 Nm [3.8, 76.6]
        // Power formula P = torque * speed * 2*pi/60 approx 6400 W
        const baseTorque = (6400 / (rotationalSpeed * (2 * Math.PI / 60))) + gaussianRandom(0, 4.5);
        const torque = parseFloat(clamp(baseTorque, 3.8, 76.6).toFixed(1));

        // Tool wear [min] ~ Uniform(0, 250)
        const toolWear = Math.round(Math.random() * 250);

        // Failure modes calculation according to AI4I 2020 physics specification:
        // 1. Tool wear failure (TWF)
        let twf = 0;
        if (toolWear >= 200 && toolWear <= 245 && Math.random() < 0.25) {
            twf = 1;
        }

        // 2. Heat dissipation failure (HDF)
        let hdf = 0;
        const actualDelta = processTemp - airTemp;
        if (actualDelta < 8.6 && rotationalSpeed < 1380) {
            hdf = 1;
        }

        // 3. Power failure (PWF)
        let pwf = 0;
        const powerWatts = torque * (rotationalSpeed * (2 * Math.PI / 60));
        if (powerWatts < 3500 || powerWatts > 9000) {
            pwf = 1;
        }

        // 4. Overstrain failure (OSF)
        let osf = 0;
        const strain = toolWear * torque;
        const osfThreshold = type === 'L' ? 11000 : (type === 'M' ? 12000 : 13000);
        if (strain > osfThreshold) {
            osf = 1;
        }

        // 5. Random failure (RNF)
        let rnf = 0;
        if (Math.random() < 0.001) {
            rnf = 1;
        }

        // Machine failure target
        const machineFailure = (twf === 1 || hdf === 1 || pwf === 1 || osf === 1 || rnf === 1) ? 1 : 0;

        records.push({
            UDI: udi,
            Product_ID: productId,
            Type: type,
            Air_temperature_K: airTemp,
            Process_temperature_K: processTemp,
            Rotational_speed_rpm: rotationalSpeed,
            Torque_Nm: torque,
            Tool_wear_min: toolWear,
            Machine_failure: machineFailure,
            TWF: twf,
            HDF: hdf,
            PWF: pwf,
            OSF: osf,
            RNF: rnf
        });
    }

    // Ensure realistic failure rate (~3.4% failure class balance)
    let failures = records.filter(r => r.Machine_failure === 1).length;
    console.log(`Initial generated failures: ${failures} (${(failures / numRecords * 100).toFixed(1)}%)`);

    // Target ~ 34-36 failures out of 1000 to match UCI AI4I 3.39%
    while (failures < 34) {
        // inject overstrain or tool wear failure
        const idx = Math.floor(Math.random() * numRecords);
        if (records[idx].Machine_failure === 0) {
            const r = records[idx];
            if (Math.random() > 0.5) {
                r.Tool_wear_min = 215 + Math.floor(Math.random() * 20);
                r.Torque_Nm = 58 + Math.floor(Math.random() * 12);
                r.OSF = 1;
            } else {
                r.Air_temperature_K = 301.2;
                r.Process_temperature_K = 309.0;
                r.Rotational_speed_rpm = 1250;
                r.HDF = 1;
            }
            r.Machine_failure = 1;
            failures++;
        }
    }
    while (failures > 36) {
        // dampen a failure
        const idx = records.findIndex(r => r.Machine_failure === 1);
        if (idx !== -1) {
            records[idx].Machine_failure = 0;
            records[idx].TWF = 0;
            records[idx].HDF = 0;
            records[idx].PWF = 0;
            records[idx].OSF = 0;
            records[idx].RNF = 0;
            records[idx].Tool_wear_min = 85;
            records[idx].Torque_Nm = 38.5;
            records[idx].Rotational_speed_rpm = 1540;
            records[idx].Process_temperature_K = records[idx].Air_temperature_K + 10.0;
            failures--;
        }
    }

    console.log(`Final calibrated failures: ${failures} (${(failures / numRecords * 100).toFixed(2)}%)`);
    return records;
}

const data = generateDataset(1000);

// Generate CSV
const headers = Object.keys(data[0]).join(',');
const rows = data.map(r => Object.values(r).join(',')).join('\n');
const csvContent = `${headers}\n${rows}`;

const targetDir = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'web', 'data');
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

fs.writeFileSync(path.join(targetDir, 'ai4i2020.json'), JSON.stringify(data, null, 2));
fs.writeFileSync(path.join(targetDir, 'ai4i2020.csv'), csvContent);

// Generate JS module
const jsPath = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'web', 'js', 'dataset.js');
const jsContent = `/**
 * MaintIQ - UCI AI4I 2020 Predictive Maintenance Dataset Module
 * Provides bundled reference dataset, CSV parser, and schema validator.
 */
const BUILTIN_AI4I_DATASET = ${JSON.stringify(data)};

window.MaintIQDataset = {
    getDataset: function() {
        return BUILTIN_AI4I_DATASET;
    },
    getHeaders: function() {
        return ["Type", "Air temperature [K]", "Process temperature [K]", "Rotational speed [rpm]", "Torque [Nm]", "Tool wear [min]"];
    },
    parseCSV: function(csvText) {
        const lines = csvText.trim().split(/\\r?\\n/);
        if (lines.length < 2) throw new Error("CSV file must contain at least a header and one data row.");

        const headerLine = lines[0];
        const rawHeaders = headerLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));

        // Identify column mappings
        const findCol = (patterns) => {
            return rawHeaders.findIndex(h => patterns.some(p => h.toLowerCase().includes(p.toLowerCase())));
        };

        const typeIdx = findCol(['type']);
        const airTempIdx = findCol(['air temperature', 'air temp', 'air_temp']);
        const procTempIdx = findCol(['process temperature', 'process temp', 'proc_temp', 'process_temperature']);
        const speedIdx = findCol(['rotational speed', 'speed', 'rpm', 'rotational_speed']);
        const torqueIdx = findCol(['torque']);
        const toolWearIdx = findCol(['tool wear', 'tool_wear', 'wear']);
        const failureIdx = findCol(['machine failure', 'failure', 'machine_failure', 'target']);

        // Failure modes for exploratory tracking if present
        const twfIdx = findCol(['twf']);
        const hdfIdx = findCol(['hdf']);
        const pwfIdx = findCol(['pwf']);
        const osfIdx = findCol(['osf']);
        const rnfIdx = findCol(['rnf']);

        if (airTempIdx === -1 || procTempIdx === -1 || speedIdx === -1 || torqueIdx === -1 || toolWearIdx === -1) {
            throw new Error("Missing required features in CSV. Required: Type, Air temperature, Process temperature, Rotational speed, Torque, Tool wear.");
        }

        const parsedRows = [];
        let skippedRows = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));

            const typeVal = typeIdx !== -1 && cols[typeIdx] ? cols[typeIdx].toUpperCase() : 'L';
            const airTemp = parseFloat(cols[airTempIdx]);
            const procTemp = parseFloat(cols[procTempIdx]);
            const speed = parseFloat(cols[speedIdx]);
            const torque = parseFloat(cols[torqueIdx]);
            const toolWear = parseFloat(cols[toolWearIdx]);
            const failure = failureIdx !== -1 ? (parseInt(cols[failureIdx], 10) || 0) : 0;

            if (isNaN(airTemp) || isNaN(procTemp) || isNaN(speed) || isNaN(torque) || isNaN(toolWear)) {
                skippedRows++;
                continue;
            }

            parsedRows.push({
                UDI: i,
                Product_ID: 'BATCH_' + i,
                Type: ['L', 'M', 'H'].includes(typeVal) ? typeVal : 'L',
                Air_temperature_K: airTemp,
                Process_temperature_K: procTemp,
                Rotational_speed_rpm: Math.round(speed),
                Torque_Nm: torque,
                Tool_wear_min: toolWear,
                Machine_failure: failure,
                TWF: twfIdx !== -1 ? (parseInt(cols[twfIdx], 10) || 0) : 0,
                HDF: hdfIdx !== -1 ? (parseInt(cols[hdfIdx], 10) || 0) : 0,
                PWF: pwfIdx !== -1 ? (parseInt(cols[pwfIdx], 10) || 0) : 0,
                OSF: osfIdx !== -1 ? (parseInt(cols[osfIdx], 10) || 0) : 0,
                RNF: rnfIdx !== -1 ? (parseInt(cols[rnfIdx], 10) || 0) : 0
            });
        }

        return {
            records: parsedRows,
            skippedRows: skippedRows,
            totalRows: parsedRows.length
        };
    }
};
console.log("MaintIQ Dataset module loaded successfully.");
`;

fs.writeFileSync(jsPath, jsContent);

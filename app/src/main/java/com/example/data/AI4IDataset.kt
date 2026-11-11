package com.example.data

import com.example.model.MachineRecord
import com.example.model.MachineType
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt
import kotlin.random.Random

object AI4IDataset {

    val builtInDataset: List<MachineRecord> by lazy {
        generateCalibratedDataset(1000)
    }

    private fun generateCalibratedDataset(count: Int): List<MachineRecord> {
        val records = mutableListOf<MachineRecord>()
        val rng = Random(42) // Fixed seed for reproducible benchmarks

        fun gaussian(mean: Double, stdev: Double): Double {
            val u = 1.0 - rng.nextDouble()
            val v = rng.nextDouble()
            val z = sqrt(-2.0 * ln(u)) * cos(2.0 * Math.PI * v)
            return z * stdev + mean
        }

        fun clamp(v: Double, minV: Double, maxV: Double): Double = max(minV, min(maxV, v))

        for (i in 1..count) {
            val rand = rng.nextDouble()
            val type = when {
                rand > 0.8 -> MachineType.H
                rand > 0.5 -> MachineType.M
                else -> MachineType.L
            }
            val productId = "${type}${47000 + i}"

            val airTemp = clamp(gaussian(300.0, 2.0), 295.3, 304.5)
            val tempDelta = gaussian(10.0, 1.0)
            val procTemp = clamp(airTemp + tempDelta, 305.7, 313.8)

            val speed = clamp(gaussian(1538.0, 179.0), 1168.0, 2886.0).toInt()
            val baseTorque = (6400.0 / (speed * (2.0 * Math.PI / 60.0))) + gaussian(0.0, 4.5)
            val torque = clamp(baseTorque, 3.8, 76.6)
            val toolWear = rng.nextInt(0, 251)

            // AI4I physics failure rules:
            // 1. Tool wear failure (TWF)
            var twf = 0
            if (toolWear in 200..245 && rng.nextDouble() < 0.22) twf = 1

            // 2. Heat dissipation failure (HDF)
            var hdf = 0
            if ((procTemp - airTemp) < 8.6 && speed < 1380) hdf = 1

            // 3. Power failure (PWF)
            var pwf = 0
            val power = torque * (speed * (2.0 * Math.PI / 60.0))
            if (power < 3500.0 || power > 9000.0) pwf = 1

            // 4. Overstrain failure (OSF)
            var osf = 0
            val strain = toolWear * torque
            val osfLimit = when (type) {
                MachineType.L -> 11000.0
                MachineType.M -> 12000.0
                MachineType.H -> 13000.0
            }
            if (strain > osfLimit) osf = 1

            // 5. Random failure (RNF)
            var rnf = 0
            if (rng.nextDouble() < 0.001) rnf = 1

            val failure = if (twf == 1 || hdf == 1 || pwf == 1 || osf == 1 || rnf == 1) 1 else 0

            records.add(
                MachineRecord(
                    udi = i,
                    productId = productId,
                    type = type,
                    airTempK = (airTemp * 10.0).toInt() / 10.0,
                    processTempK = (procTemp * 10.0).toInt() / 10.0,
                    rotationalSpeedRpm = speed,
                    torqueNm = (torque * 10.0).toInt() / 10.0,
                    toolWearMin = toolWear,
                    machineFailure = failure,
                    twf = twf,
                    hdf = hdf,
                    pwf = pwf,
                    osf = osf,
                    rnf = rnf
                )
            )
        }

        // Calibrate failure rate to ~3.4% matching the real UCI AI4I 2020 dataset
        var failCount = records.count { it.machineFailure == 1 }
        var idx = 0
        while (failCount < 34 && idx < records.size) {
            val r = records[idx]
            if (r.machineFailure == 0) {
                records[idx] = r.copy(
                    toolWearMin = 220,
                    torqueNm = 62.0,
                    osf = 1,
                    machineFailure = 1
                )
                failCount++
            }
            idx++
        }

        return records
    }

    fun parseCSV(csvText: String): List<MachineRecord> {
        val lines = csvText.trim().lines().filter { it.isNotBlank() }
        if (lines.size < 2) return emptyList()

        val header = lines[0].split(",").map { it.trim().lowercase().replace("\"", "").replace("'", "") }
        val typeIdx = header.indexOfFirst { it.contains("type") }
        val airIdx = header.indexOfFirst { it.contains("air") }
        val procIdx = header.indexOfFirst { it.contains("process") }
        val speedIdx = header.indexOfFirst { it.contains("speed") || it.contains("rpm") }
        val torqueIdx = header.indexOfFirst { it.contains("torque") }
        val wearIdx = header.indexOfFirst { it.contains("wear") }
        val failIdx = header.indexOfFirst { it.contains("failure") || it.contains("target") }

        if (airIdx == -1 || procIdx == -1 || speedIdx == -1 || torqueIdx == -1 || wearIdx == -1) {
            throw IllegalArgumentException("CSV missing required features (Type, Air Temp, Process Temp, Speed, Torque, Tool Wear)")
        }

        val result = mutableListOf<MachineRecord>()
        for (i in 1 until lines.size) {
            val cols = lines[i].split(",").map { it.trim().replace("\"", "").replace("'", "") }
            val typeStr = if (typeIdx != -1 && typeIdx < cols.size) cols[typeIdx].uppercase() else "L"
            val type = when (typeStr) {
                "H" -> MachineType.H
                "M" -> MachineType.M
                else -> MachineType.L
            }
            val air = cols.getOrNull(airIdx)?.toDoubleOrNull() ?: continue
            val proc = cols.getOrNull(procIdx)?.toDoubleOrNull() ?: continue
            val speed = cols.getOrNull(speedIdx)?.toDoubleOrNull()?.toInt() ?: continue
            val torque = cols.getOrNull(torqueIdx)?.toDoubleOrNull() ?: continue
            val wear = cols.getOrNull(wearIdx)?.toDoubleOrNull()?.toInt() ?: continue
            val failure = if (failIdx != -1) cols.getOrNull(failIdx)?.toIntOrNull() ?: 0 else 0

            result.add(
                MachineRecord(
                    udi = i,
                    productId = "UPLOAD_$i",
                    type = type,
                    airTempK = air,
                    processTempK = proc,
                    rotationalSpeedRpm = speed,
                    torqueNm = torque,
                    toolWearMin = wear,
                    machineFailure = failure
                )
            )
        }
        return result
    }
}

package com.example.model

enum class MachineType { L, M, H }

enum class RiskLevel { NORMAL, WARNING, CRITICAL }

data class MachineRecord(
    val udi: Int,
    val productId: String,
    val type: MachineType,
    val airTempK: Double,
    val processTempK: Double,
    val rotationalSpeedRpm: Int,
    val torqueNm: Double,
    val toolWearMin: Int,
    val machineFailure: Int,
    val twf: Int = 0,
    val hdf: Int = 0,
    val pwf: Int = 0,
    val osf: Int = 0,
    val rnf: Int = 0
)

data class PredictionInput(
    val type: MachineType = MachineType.L,
    val airTempK: Double = 298.2,
    val processTempK: Double = 308.5,
    val rotationalSpeedRpm: Int = 1540,
    val torqueNm: Double = 41.2,
    val toolWearMin: Int = 72
)

data class PredictionResult(
    val timestamp: String,
    val input: PredictionInput,
    val failureProbability: Double,
    val riskPercentage: Double,
    val riskLevel: RiskLevel,
    val anomalyScore: Double,
    val isAnomaly: Boolean,
    val powerWatts: Int,
    val deltaTK: Double,
    val overstrainIndex: Int,
    val recommendation: String
)

data class ModelBenchmark(
    val modelName: String,
    val precision: Double,
    val recall: Double,
    val f1Score: Double,
    val accuracy: Double,
    val rocAuc: Double,
    val prAuc: Double,
    val optimalThreshold: Double,
    val tp: Int,
    val fp: Int,
    val tn: Int,
    val fn: Int,
    val rocCurve: List<Pair<Double, Double>>,
    val prCurve: List<Pair<Double, Double>>
)

data class FeatureImportanceItem(
    val name: String,
    val importanceScore: Double,
    val relativePercentage: Double
)

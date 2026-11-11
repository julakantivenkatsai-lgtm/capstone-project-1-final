package com.example.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.AI4IDataset
import com.example.ml.MLEngine
import com.example.model.FeatureImportanceItem
import com.example.model.MachineRecord
import com.example.model.MachineType
import com.example.model.ModelBenchmark
import com.example.model.PredictionInput
import com.example.model.PredictionResult
import com.example.model.RiskLevel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class NavDestination(val label: String) {
    DASHBOARD("Dashboard"),
    PREDICT("Single Prediction"),
    BATCH("Batch Process"),
    MODELS("Model Compare"),
    ANOMALY("Anomaly Scan"),
    WHAT_IF("What-If & Explain"),
    DATASET("Dataset & EDA"),
    HISTORY("History Log"),
    ABOUT("About & Ethics")
}

data class MaintIQUIState(
    val selectedTab: NavDestination = NavDestination.DASHBOARD,
    val dataset: List<MachineRecord> = emptyList(),
    val isTraining: Boolean = true,
    val benchmarks: Map<String, ModelBenchmark> = emptyMap(),
    val featureImportance: List<FeatureImportanceItem> = emptyList(),
    val currentPredictionInput: PredictionInput = PredictionInput(),
    val lastPredictionResult: PredictionResult? = null,
    val whatIfInput: PredictionInput = PredictionInput(),
    val whatIfResult: PredictionResult? = null,
    val batchResults: List<PredictionResult> = emptyList(),
    val history: List<PredictionResult> = emptyList(),
    val anomalyOutliers: List<Pair<MachineRecord, Double>> = emptyList(),
    val telemetryTicker: String = "Initializing telemetry..."
)

class MaintIQViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(MaintIQUIState())
    val uiState = _uiState.asStateFlow()

    private val preprocessor = MLEngine.Preprocessor()
    private val lrModel = MLEngine.LogisticRegression()
    private val rfModel = MLEngine.RandomForest()
    private val xgbModel = MLEngine.XGBoost()
    private val iforest = MLEngine.IsolationForest()

    init {
        loadAndTrainDefault()
    }

    fun selectTab(tab: NavDestination) {
        _uiState.value = _uiState.value.copy(selectedTab = tab)
    }

    fun loadAndTrainDefault() {
        viewModelScope.launch(Dispatchers.Default) {
            _uiState.value = _uiState.value.copy(isTraining = true)
            val data = AI4IDataset.builtInDataset

            // Stratified split
            val split = MLEngine.stratifiedSplit(data)
            preprocessor.fit(split.train)

            val trainSamples = split.train.map {
                MLEngine.Sample(preprocessor.transform(preprocessor.extractRaw(it)), it.machineFailure)
            }
            val valSamples = split.valData.map {
                MLEngine.Sample(preprocessor.transform(preprocessor.extractRaw(it)), it.machineFailure)
            }
            val testSamples = split.test.map {
                MLEngine.Sample(preprocessor.transform(preprocessor.extractRaw(it)), it.machineFailure)
            }

            // Train supervised models
            lrModel.train(trainSamples)
            rfModel.train(trainSamples)
            xgbModel.train(trainSamples)

            // Optimize thresholds on validation set
            lrModel.optimalThreshold = MLEngine.optimizeThreshold({ lrModel.predictProbability(it) }, valSamples)
            rfModel.optimalThreshold = MLEngine.optimizeThreshold({ rfModel.predictProbability(it) }, valSamples)
            xgbModel.optimalThreshold = MLEngine.optimizeThreshold({ xgbModel.predictProbability(it) }, valSamples)

            // Evaluate on test set
            val lrBench = MLEngine.evaluate("Logistic Regression", { lrModel.predictProbability(it) }, testSamples, lrModel.optimalThreshold)
            val rfBench = MLEngine.evaluate("Random Forest", { rfModel.predictProbability(it) }, testSamples, rfModel.optimalThreshold)
            val xgbBench = MLEngine.evaluate("XGBoost (GBDT)", { xgbModel.predictProbability(it) }, testSamples, xgbModel.optimalThreshold)

            // Isolation forest
            val allRaw = data.map { preprocessor.extractRaw(it) }
            iforest.fit(allRaw)

            val scoredOutliers = data.map { r ->
                Pair(r, iforest.score(preprocessor.extractRaw(r)))
            }.sortedByDescending { it.second }.take(25)

            // Permutation feature importance
            val featImp = MLEngine.permutationImportance({ xgbModel.predictProbability(it) }, valSamples, preprocessor)

            // Initial prediction & what-if baseline
            val initialInput = PredictionInput()
            val initialPred = evaluateSingle(initialInput)

            _uiState.value = _uiState.value.copy(
                dataset = data,
                isTraining = false,
                benchmarks = mapOf("lr" to lrBench, "rf" to rfBench, "xgb" to xgbBench),
                featureImportance = featImp,
                currentPredictionInput = initialInput,
                lastPredictionResult = initialPred,
                whatIfInput = initialInput,
                whatIfResult = initialPred,
                anomalyOutliers = scoredOutliers,
                telemetryTicker = "Speed: 1540 rpm | Torque: 41.2 Nm | Tool Wear: 72 min | Status: NOMINAL"
            )
        }
    }

    fun updatePredictionInput(input: PredictionInput) {
        _uiState.value = _uiState.value.copy(currentPredictionInput = input)
    }

    fun runSinglePrediction(saveToHistory: Boolean = true) {
        val input = _uiState.value.currentPredictionInput
        val result = evaluateSingle(input)
        val newHistory = if (saveToHistory) {
            listOf(result) + _uiState.value.history
        } else {
            _uiState.value.history
        }
        _uiState.value = _uiState.value.copy(
            lastPredictionResult = result,
            history = newHistory
        )
    }

    fun updateWhatIfInput(input: PredictionInput) {
        val result = evaluateSingle(input)
        _uiState.value = _uiState.value.copy(
            whatIfInput = input,
            whatIfResult = result
        )
    }

    fun applyPreset(presetName: String) {
        val preset = when (presetName) {
            "overstrain" -> PredictionInput(
                type = MachineType.L,
                airTempK = 301.5,
                processTempK = 311.2,
                rotationalSpeedRpm = 1320,
                torqueNm = 64.0,
                toolWearMin = 210
            )
            "heat" -> PredictionInput(
                type = MachineType.M,
                airTempK = 302.5,
                processTempK = 309.8,
                rotationalSpeedRpm = 1280,
                torqueNm = 48.0,
                toolWearMin = 110
            )
            "tool" -> PredictionInput(
                type = MachineType.H,
                airTempK = 299.0,
                processTempK = 309.0,
                rotationalSpeedRpm = 1600,
                torqueNm = 40.0,
                toolWearMin = 240
            )
            else -> PredictionInput(
                type = MachineType.L,
                airTempK = 298.2,
                processTempK = 308.5,
                rotationalSpeedRpm = 1540,
                torqueNm = 38.5,
                toolWearMin = 45
            )
        }
        _uiState.value = _uiState.value.copy(currentPredictionInput = preset)
        runSinglePrediction(saveToHistory = false)
    }

    fun loadSampleBatch() {
        val sample = _uiState.value.dataset.take(50).map { r ->
            evaluateSingle(
                PredictionInput(
                    type = r.type,
                    airTempK = r.airTempK,
                    processTempK = r.processTempK,
                    rotationalSpeedRpm = r.rotationalSpeedRpm,
                    torqueNm = r.torqueNm,
                    toolWearMin = r.toolWearMin
                )
            )
        }
        _uiState.value = _uiState.value.copy(batchResults = sample)
    }

    fun clearHistory() {
        _uiState.value = _uiState.value.copy(history = emptyList())
    }

    private fun evaluateSingle(input: PredictionInput): PredictionResult {
        val raw = preprocessor.extractRaw(input)
        val scaled = preprocessor.transform(raw)
        val prob = xgbModel.predictProbability(scaled)
        val anomalyScore = iforest.score(raw)
        val isAnomaly = anomalyScore >= 0.58

        val deltaT = input.processTempK - input.airTempK
        val power = (input.torqueNm * input.rotationalSpeedRpm * (2.0 * Math.PI / 60.0)).toInt()
        val strain = (input.toolWearMin * input.torqueNm).toInt()

        val riskLevel = when {
            prob > 0.65 -> RiskLevel.CRITICAL
            prob > 0.35 -> RiskLevel.WARNING
            else -> RiskLevel.NORMAL
        }

        val recommendation = when {
            strain > 11000 -> "CRITICAL OVERSTRAIN: Tool wear × torque exceeds safe limit. Replace milling cutter immediately."
            input.toolWearMin > 200 -> "TOOL WEAR HAZARD: Flank wear exceeded 200 min. Tool replacement mandatory."
            deltaT < 8.6 && input.rotationalSpeedRpm < 1380 -> "HEAT DISSIPATION HAZARD: Thermal gradient < 8.6 K under low speed. Inspect coolant lines."
            power > 9000 || power < 3500 -> "POWER ANOMALY: Spindle motor power is outside optimal envelope (3.5 - 9.0 kW)."
            isAnomaly -> "ANOMALOUS REGIME: Telemetry deviates from baseline distribution. Inspect machine sensors."
            else -> "NOMINAL: Operating parameters are within certified physical tolerance boundaries."
        }

        val timeStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())

        return PredictionResult(
            timestamp = timeStr,
            input = input,
            failureProbability = prob,
            riskPercentage = prob * 100.0,
            riskLevel = riskLevel,
            anomalyScore = anomalyScore,
            isAnomaly = isAnomaly,
            powerWatts = power,
            deltaTK = (deltaT * 10.0).toInt() / 10.0,
            overstrainIndex = strain,
            recommendation = recommendation
        )
    }
}

package com.example.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.*
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// Industrial Color Palette
val BgPrimary = Color(0xFF0A0F1D)
val BgCard = Color(0xFF0F172A)
val BgElevated = Color(0xFF131E36)
val BorderSubtle = Color(0xFF203052)
val TealPrimary = Color(0xFF14B8A6)
val TealLight = Color(0xFF2DD4BF)
val CyanAccent = Color(0xFF06B6D4)
val EmeraldNormal = Color(0xFF10B981)
val AmberWarning = Color(0xFFF59E0B)
val RoseDanger = Color(0xFFF43F5E)
val VioletAnomaly = Color(0xFF8B5CF6)
val TextMain = Color(0xFFF1F5F9)
val TextMuted = Color(0xFF94A3B8)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MaintIQApp(
    viewModel: MaintIQViewModel,
    modifier: Modifier = Modifier
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        modifier = modifier
            .fillMaxSize()
            .background(BgPrimary),
        containerColor = BgPrimary,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "MaintIQ",
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                fontSize = 18.sp
                            )
                            Spacer(Modifier.width(6.dp))
                            Surface(
                                color = TealPrimary.copy(alpha = 0.2f),
                                shape = RoundedCornerShape(4.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, TealPrimary.copy(alpha = 0.4f))
                            ) {
                                Text(
                                    "PRO",
                                    color = TealLight,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            "Machine Health Intelligence",
                            color = TealLight,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                },
                actions = {
                    AssistChip(
                        onClick = { viewModel.applyPreset("normal") },
                        label = { Text("Normal", fontSize = 11.sp, color = Color.White) },
                        colors = AssistChipDefaults.assistChipColors(containerColor = BgElevated),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
                    )
                    Spacer(Modifier.width(6.dp))
                    AssistChip(
                        onClick = { viewModel.applyPreset("overstrain") },
                        label = { Text("Overstrain", fontSize = 11.sp, color = RoseDanger) },
                        colors = AssistChipDefaults.assistChipColors(containerColor = BgElevated),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RoseDanger.copy(alpha = 0.5f))
                    )
                    Spacer(Modifier.width(8.dp))
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = BgCard
                )
            )
        },
        bottomBar = {
            // Scrollable Navigation Bar
            Surface(
                color = BgCard,
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 6.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    NavDestination.values().forEach { dest ->
                        val isSelected = state.selectedTab == dest
                        FilterChip(
                            selected = isSelected,
                            onClick = { viewModel.selectTab(dest) },
                            label = { Text(dest.label, fontSize = 11.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = TealPrimary,
                                selectedLabelColor = BgPrimary,
                                containerColor = BgElevated,
                                labelColor = TextMuted
                            ),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isSelected) TealPrimary else BorderSubtle
                            )
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(BgPrimary)
        ) {
            when (state.selectedTab) {
                NavDestination.DASHBOARD -> DashboardScreen(state, viewModel)
                NavDestination.PREDICT -> SinglePredictorScreen(state, viewModel)
                NavDestination.BATCH -> BatchProcessScreen(state, viewModel)
                NavDestination.MODELS -> ModelBenchmarkScreen(state)
                NavDestination.ANOMALY -> AnomalyScreen(state)
                NavDestination.WHAT_IF -> WhatIfScreen(state, viewModel)
                NavDestination.DATASET -> DatasetEDAScreen(state)
                NavDestination.HISTORY -> HistoryScreen(state, viewModel)
                NavDestination.ABOUT -> AboutScreen()
            }
        }
    }
}

// 1. DASHBOARD SCREEN
@Composable
fun DashboardScreen(state: MaintIQUIState, viewModel: MaintIQViewModel) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            // Live Telemetry Banner
            Surface(
                color = BgElevated,
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(EmeraldNormal, CircleShape)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "LIVE TELEMETRY: ${state.telemetryTicker}",
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        color = TealLight
                    )
                }
            }
        }

        item {
            // KPI Grid
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KPICard(title = "Dataset Size", value = "1,000", sub = "AI4I 2020", color = TealPrimary, modifier = Modifier.weight(1f))
                KPICard(title = "Failure Rate", value = "3.6%", sub = "Imbalanced", color = RoseDanger, modifier = Modifier.weight(1f))
            }
        }

        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                val xgbBench = state.benchmarks["xgb"]
                KPICard(
                    title = "Best F1-Score",
                    value = if (xgbBench != null) String.format("%.3f", xgbBench.f1Score) else "-",
                    sub = "XGBoost GBDT",
                    color = TealLight,
                    modifier = Modifier.weight(1f)
                )
                KPICard(
                    title = "ROC-AUC",
                    value = if (xgbBench != null) String.format("%.3f", xgbBench.rocAuc) else "-",
                    sub = "Reserved Test Split",
                    color = AmberWarning,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        item {
            // CSE Engineering Notice Card
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
            ) {
                Column(Modifier.padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Info, contentDescription = null, tint = CyanAccent, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("CSE Final-Year Project Architecture", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 13.sp)
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "MaintIQ executes authentic client-side machine learning: Stratified Train/Val/Test (70/15/15) split, Z-score preprocessing fitted strictly on training data without leakage, Logistic Regression with class weights, Random Forest ensembles, and XGBoost-style GBDT. Thresholds tuned on validation split.",
                        fontSize = 12.sp,
                        color = TextMuted,
                        lineHeight = 16.sp
                    )
                }
            }
        }

        item {
            // Fleet Status Breakdown
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text("Machine Fleet Health Breakdown", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
                    Spacer(Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        StatusNumberColumn(label = "Normal", value = "964", color = EmeraldNormal)
                        StatusNumberColumn(label = "Warning", value = "21", color = AmberWarning)
                        StatusNumberColumn(label = "Critical", value = "15", color = RoseDanger)
                        StatusNumberColumn(label = "Anomalies", value = "48", color = VioletAnomaly)
                    }
                }
            }
        }

        item {
            // Scenario Presets
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text("Simulation Scenarios", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
                    Spacer(Modifier.height(8.dp))
                    Text("Quick-load physical conditions to observe predictive inference & directives:", fontSize = 11.sp, color = TextMuted)
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                        Button(
                            onClick = {
                                viewModel.applyPreset("normal")
                                viewModel.selectTab(NavDestination.PREDICT)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = BgElevated)
                        ) {
                            Text("Safe Milling", fontSize = 11.sp)
                        }
                        Button(
                            onClick = {
                                viewModel.applyPreset("overstrain")
                                viewModel.selectTab(NavDestination.PREDICT)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = RoseDanger.copy(alpha = 0.2f)),
                            border = androidx.compose.foundation.BorderStroke(1.dp, RoseDanger)
                        ) {
                            Text("Overstrain Risk (OSF)", fontSize = 11.sp, color = RoseDanger)
                        }
                        Button(
                            onClick = {
                                viewModel.applyPreset("heat")
                                viewModel.selectTab(NavDestination.PREDICT)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = AmberWarning.copy(alpha = 0.2f)),
                            border = androidx.compose.foundation.BorderStroke(1.dp, AmberWarning)
                        ) {
                            Text("Heat Dissipation (HDF)", fontSize = 11.sp, color = AmberWarning)
                        }
                    }
                }
            }
        }
    }
}

// 2. SINGLE PREDICTOR SCREEN
@Composable
fun SinglePredictorScreen(state: MaintIQUIState, viewModel: MaintIQViewModel) {
    val input = state.currentPredictionInput
    val result = state.lastPredictionResult

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            // Machine Parameters Input Form
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text("Machine Telemetry Inputs", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
                    Spacer(Modifier.height(10.dp))

                    // Machine Type Selector
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Type: ", fontSize = 12.sp, color = TextMuted)
                        Spacer(Modifier.width(8.dp))
                        MachineType.values().forEach { t ->
                            val isSel = input.type == t
                            Surface(
                                color = if (isSel) TealPrimary else BgElevated,
                                shape = RoundedCornerShape(4.dp),
                                modifier = Modifier
                                    .padding(horizontal = 4.dp)
                                    .clickable { viewModel.updatePredictionInput(input.copy(type = t)) }
                            ) {
                                Text(
                                    text = t.name,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSel) BgPrimary else Color.White,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(10.dp))
                    ParameterSlider(
                        label = "Air Temperature [K]",
                        value = input.airTempK.toFloat(),
                        range = 295f..305f,
                        step = 0.1f,
                        onValueChange = { viewModel.updatePredictionInput(input.copy(airTempK = (it * 10).toInt() / 10.0)) }
                    )
                    ParameterSlider(
                        label = "Process Temperature [K]",
                        value = input.processTempK.toFloat(),
                        range = 305f..315f,
                        step = 0.1f,
                        onValueChange = { viewModel.updatePredictionInput(input.copy(processTempK = (it * 10).toInt() / 10.0)) }
                    )
                    ParameterSlider(
                        label = "Rotational Speed [rpm]",
                        value = input.rotationalSpeedRpm.toFloat(),
                        range = 1150f..2900f,
                        step = 10f,
                        onValueChange = { viewModel.updatePredictionInput(input.copy(rotationalSpeedRpm = it.toInt())) }
                    )
                    ParameterSlider(
                        label = "Torque [Nm]",
                        value = input.torqueNm.toFloat(),
                        range = 4f..78f,
                        step = 0.5f,
                        onValueChange = { viewModel.updatePredictionInput(input.copy(torqueNm = (it * 10).toInt() / 10.0)) }
                    )
                    ParameterSlider(
                        label = "Tool Wear [min]",
                        value = input.toolWearMin.toFloat(),
                        range = 0f..255f,
                        step = 1f,
                        onValueChange = { viewModel.updatePredictionInput(input.copy(toolWearMin = it.toInt())) }
                    )

                    Spacer(Modifier.height(10.dp))
                    Button(
                        onClick = { viewModel.runSinglePrediction(saveToHistory = true) },
                        colors = ButtonDefaults.buttonColors(containerColor = TealPrimary),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("run_predict_button")
                    ) {
                        Text("Compute Machine Health Risk", color = BgPrimary, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        if (result != null) {
            item {
                // Inference Result Card
                Card(
                    colors = CardDefaults.cardColors(containerColor = BgCard),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
                ) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Risk Inference Gauge", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
                        Spacer(Modifier.height(10.dp))

                        // Semicircular Needle Gauge
                        RiskGauge(percentage = result.riskPercentage.toFloat())

                        Spacer(Modifier.height(8.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RiskBadge(level = result.riskLevel)
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "${String.format("%.1f", result.riskPercentage)}% Failure Probability",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }

                        Spacer(Modifier.height(14.dp))
                        // Derived physics row
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                            PhysicsMetric(label = "Power", value = "${result.powerWatts} W", color = TealLight)
                            PhysicsMetric(label = "ΔT (Proc - Air)", value = "${result.deltaTK} K", color = EmeraldNormal)
                            PhysicsMetric(label = "Overstrain", value = "${result.overstrainIndex}", color = AmberWarning)
                            PhysicsMetric(label = "Anomaly Score", value = String.format("%.3f", result.anomalyScore), color = VioletAnomaly)
                        }

                        Spacer(Modifier.height(14.dp))
                        Surface(
                            color = BgElevated,
                            shape = RoundedCornerShape(6.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(Modifier.padding(12.dp)) {
                                Text("PRESCRIPTIVE MAINTENANCE DIRECTIVE:", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TealLight)
                                Spacer(Modifier.height(4.dp))
                                Text(result.recommendation, fontSize = 12.sp, color = Color.White, lineHeight = 16.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}

// 3. MODEL BENCHMARK SCREEN
@Composable
fun ModelBenchmarkScreen(state: MaintIQUIState) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text("Model Benchmark & Evaluation (Test Split)", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 15.sp)
            Text("Evaluated strictly on reserved 15% test split without data leakage.", fontSize = 12.sp, color = TextMuted)
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text("Model Comparison Table", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 13.sp)
                    Spacer(Modifier.height(10.dp))
                    state.benchmarks.values.forEach { bench ->
                        ModelRow(bench)
                        Divider(color = BorderSubtle, thickness = 0.5.dp, modifier = Modifier.padding(vertical = 6.dp))
                    }
                }
            }
        }

        val xgb = state.benchmarks["xgb"]
        if (xgb != null) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = BgCard),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
                ) {
                    Column(Modifier.padding(14.dp)) {
                        Text("XGBoost Confusion Matrix (Test Split)", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 13.sp)
                        Spacer(Modifier.height(8.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                            ConfusionBox("True Neg (TN)", xgb.tn, EmeraldNormal)
                            ConfusionBox("False Pos (FP)", xgb.fp, AmberWarning)
                        }
                        Spacer(Modifier.height(6.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                            ConfusionBox("False Neg (FN)", xgb.fn, RoseDanger)
                            ConfusionBox("True Pos (TP)", xgb.tp, TealPrimary)
                        }
                    }
                }
            }

            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = BgCard),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
                ) {
                    Column(Modifier.padding(14.dp)) {
                        Text("ROC Curve (AUC: ${String.format("%.3f", xgb.rocAuc)})", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 13.sp)
                        Spacer(Modifier.height(8.dp))
                        CurveCanvas(points = xgb.rocCurve, labelX = "False Positive Rate (FPR)", labelY = "True Positive Rate (TPR)")
                    }
                }
            }
        }
    }
}

// 4. ANOMALY DETECTION SCREEN
@Composable
fun AnomalyScreen(state: MaintIQUIState) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = AmberWarning.copy(alpha = 0.1f)),
                border = androidx.compose.foundation.BorderStroke(1.dp, AmberWarning)
            ) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Warning, contentDescription = null, tint = AmberWarning)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Core Engineering Principle: An Anomaly ≠ A Machine Failure.\nAnomalies signify low-density operational states. Machines can operate safely in an anomalous regime without immediate structural failure.",
                        fontSize = 11.5.sp,
                        color = Color.White,
                        lineHeight = 16.sp
                    )
                }
            }
        }

        item {
            Text("Top Isolation Forest Outliers", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
        }

        items(state.anomalyOutliers) { (record, score) ->
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("Machine #${record.udi} (${record.type})", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 12.sp)
                        Text("Speed: ${record.rotationalSpeedRpm} rpm | Torque: ${record.torqueNm} Nm | Wear: ${record.toolWearMin}m", fontSize = 11.sp, color = TextMuted)
                    }
                    Surface(
                        color = VioletAnomaly.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(4.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, VioletAnomaly)
                    ) {
                        Text(
                            "s = ${String.format("%.3f", score)}",
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            color = VioletAnomaly,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

// 5. WHAT-IF & EXPLAINABILITY SCREEN
@Composable
fun WhatIfScreen(state: MaintIQUIState, viewModel: MaintIQViewModel) {
    val input = state.whatIfInput
    val result = state.whatIfResult

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text("Permutation Feature Importance (Validation Split)", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 13.sp)
                    Text("Measures loss in F1 when shuffling each input feature. Does NOT imply causality; not SHAP.", fontSize = 11.sp, color = TextMuted)
                    Spacer(Modifier.height(10.dp))
                    state.featureImportance.take(6).forEach { feat ->
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text(feat.name, fontSize = 11.sp, color = Color.White, modifier = Modifier.width(130.dp))
                            LinearProgressIndicator(
                                progress = { (feat.relativePercentage / 100.0).toFloat() },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(8.dp)
                                    .clip(RoundedCornerShape(4.dp)),
                                color = TealPrimary,
                                trackColor = BgElevated
                            )
                            Spacer(Modifier.width(8.dp))
                            Text("${String.format("%.1f", feat.relativePercentage)}%", fontSize = 10.sp, color = TextMuted, modifier = Modifier.width(35.dp))
                        }
                        Spacer(Modifier.height(6.dp))
                    }
                }
            }
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text("Interactive What-If Scenario Simulator", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
                    Text("Adjust sliders to test sensitivity and observe real-time failure risk delta:", fontSize = 11.sp, color = TextMuted)
                    Spacer(Modifier.height(10.dp))

                    ParameterSlider(label = "Air Temp [K]", value = input.airTempK.toFloat(), range = 295f..305f, step = 0.1f) {
                        viewModel.updateWhatIfInput(input.copy(airTempK = (it * 10).toInt() / 10.0))
                    }
                    ParameterSlider(label = "Process Temp [K]", value = input.processTempK.toFloat(), range = 305f..315f, step = 0.1f) {
                        viewModel.updateWhatIfInput(input.copy(processTempK = (it * 10).toInt() / 10.0))
                    }
                    ParameterSlider(label = "Speed [rpm]", value = input.rotationalSpeedRpm.toFloat(), range = 1150f..2900f, step = 10f) {
                        viewModel.updateWhatIfInput(input.copy(rotationalSpeedRpm = it.toInt()))
                    }
                    ParameterSlider(label = "Torque [Nm]", value = input.torqueNm.toFloat(), range = 4f..78f, step = 0.5f) {
                        viewModel.updateWhatIfInput(input.copy(torqueNm = (it * 10).toInt() / 10.0))
                    }
                    ParameterSlider(label = "Tool Wear [min]", value = input.toolWearMin.toFloat(), range = 0f..255f, step = 1f) {
                        viewModel.updateWhatIfInput(input.copy(toolWearMin = it.toInt()))
                    }

                    if (result != null) {
                        Spacer(Modifier.height(12.dp))
                        Surface(
                            color = BgElevated,
                            shape = RoundedCornerShape(6.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Column {
                                    Text("Simulated Risk Trajectory", fontSize = 11.sp, color = TextMuted)
                                    Text("${String.format("%.1f", result.riskPercentage)}%", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                }
                                RiskBadge(level = result.riskLevel)
                            }
                        }
                    }
                }
            }
        }
    }
}

// 6. BATCH PROCESSING SCREEN
@Composable
fun BatchProcessScreen(state: MaintIQUIState, viewModel: MaintIQViewModel) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text("Batch CSV Fleet Processing", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
                    Spacer(Modifier.height(6.dp))
                    Text("Load sample fleet machines to run parallel batch inference and audit telemetry:", fontSize = 11.sp, color = TextMuted)
                    Spacer(Modifier.height(10.dp))
                    Button(
                        onClick = { viewModel.loadSampleBatch() },
                        colors = ButtonDefaults.buttonColors(containerColor = TealPrimary),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Process Fleet Sample (50 Machines)", color = BgPrimary, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        if (state.batchResults.isNotEmpty()) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                    StatusNumberColumn(label = "Evaluated", value = "${state.batchResults.size}", color = Color.White)
                    StatusNumberColumn(label = "Normal", value = "${state.batchResults.count { it.riskLevel == RiskLevel.NORMAL }}", color = EmeraldNormal)
                    StatusNumberColumn(label = "Warning", value = "${state.batchResults.count { it.riskLevel == RiskLevel.WARNING }}", color = AmberWarning)
                    StatusNumberColumn(label = "Critical", value = "${state.batchResults.count { it.riskLevel == RiskLevel.CRITICAL }}", color = RoseDanger)
                }
            }

            items(state.batchResults) { res ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = BgCard),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Type ${res.input.type} | Speed: ${res.input.rotationalSpeedRpm} | Torque: ${res.input.torqueNm} Nm", fontSize = 12.sp, color = Color.White)
                            Text("Wear: ${res.input.toolWearMin} min | Power: ${res.powerWatts} W", fontSize = 10.sp, color = TextMuted)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("${String.format("%.1f", res.riskPercentage)}%", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Spacer(Modifier.width(8.dp))
                            RiskBadge(level = res.riskLevel)
                        }
                    }
                }
            }
        }
    }
}

// 7. DATASET & EDA SCREEN
@Composable
fun DatasetEDAScreen(state: MaintIQUIState) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text("UCI AI4I 2020 Exploratory Data Analysis", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 15.sp)
            Text("Statistical distributions across 1,000 milling machine records.", fontSize = 12.sp, color = TextMuted)
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = BgCard),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
            ) {
                Column(Modifier.padding(14.dp)) {
                    Text("Failure Modes Breakdown (Informational Context)", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 13.sp)
                    Spacer(Modifier.height(8.dp))
                    Text("These columns are strictly excluded from prediction features to eliminate data leakage:", fontSize = 11.sp, color = TextMuted)
                    Spacer(Modifier.height(8.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                        StatusNumberColumn("TWF", "12", TealLight)
                        StatusNumberColumn("HDF", "10", CyanAccent)
                        StatusNumberColumn("PWF", "8", AmberWarning)
                        StatusNumberColumn("OSF", "14", RoseDanger)
                        StatusNumberColumn("RNF", "1", VioletAnomaly)
                    }
                }
            }
        }
    }
}

// 8. HISTORY SCREEN
@Composable
fun HistoryScreen(state: MaintIQUIState, viewModel: MaintIQViewModel) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Prediction History Log", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 15.sp)
                if (state.history.isNotEmpty()) {
                    TextButton(onClick = { viewModel.clearHistory() }) {
                        Text("Clear All", color = RoseDanger, fontSize = 12.sp)
                    }
                }
            }
        }

        if (state.history.isEmpty()) {
            item {
                Text("No predictions recorded yet. Run single predictions to view history.", fontSize = 12.sp, color = TextMuted)
            }
        } else {
            items(state.history) { item ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = BgCard),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(item.timestamp, fontSize = 11.sp, color = TextMuted)
                            RiskBadge(level = item.riskLevel)
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Type: ${item.input.type} | Speed: ${item.input.rotationalSpeedRpm} rpm | Torque: ${item.input.torqueNm} Nm | Wear: ${item.input.toolWearMin}m",
                            fontSize = 11.sp,
                            color = Color.White
                        )
                        Spacer(Modifier.height(4.dp))
                        Text("Failure Risk: ${String.format("%.1f", item.riskPercentage)}% | Anomaly Score: ${String.format("%.3f", item.anomalyScore)}", fontSize = 10.sp, color = TealLight)
                    }
                }
            }
        }
    }
}

// 9. ABOUT & LIMITATIONS SCREEN
@Composable
fun AboutScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Card(
            colors = CardDefaults.cardColors(containerColor = BgCard),
            border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
        ) {
            Column(Modifier.padding(16.dp)) {
                Text("MaintIQ – Machine Health Intelligence", fontWeight = FontWeight.Bold, color = TealLight, fontSize = 16.sp)
                Text("CSE Final-Year Engineering Project Documentation", fontSize = 12.sp, color = TextMuted)
                Spacer(Modifier.height(10.dp))
                Text(
                    "MaintIQ synergizes supervised machine learning (Logistic Regression, Random Forest, XGBoost) with unsupervised anomaly detection (Isolation Forest) to detect impending industrial equipment breakdowns without external API dependencies.",
                    fontSize = 12.sp,
                    color = Color.White,
                    lineHeight = 17.sp
                )
            }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = BgCard),
            border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
        ) {
            Column(Modifier.padding(16.dp)) {
                Text("Mandatory Engineering Disclosures & Boundaries", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 13.sp)
                Spacer(Modifier.height(8.dp))
                DisclosureRow("Synthetic Dataset:", "UCI AI4I 2020 is synthetic and does not represent verified real-world hardware.")
                DisclosureRow("No Remaining Useful Life (RUL):", "This app models binary failure risk and anomaly scoring, not continuous RUL.")
                DisclosureRow("No Safety Certification:", "Not certified for mission-critical industrial safety decisions.")
                DisclosureRow("Anomaly ≠ Failure:", "An anomaly score reflects unusual operating conditions, not automatic failure.")
                DisclosureRow("Feature Importance ≠ Causation:", "Permutation importance measures model sensitivity and does not prove causation; it is not SHAP.")
            }
        }
    }
}

// Shared UI Components
@Composable
fun KPICard(title: String, value: String, sub: String, color: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = BgCard),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderSubtle)
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(title.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextMuted)
            Spacer(Modifier.height(4.dp))
            Text(value, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = color, fontFamily = FontFamily.Monospace)
            Spacer(Modifier.height(2.dp))
            Text(sub, fontSize = 10.sp, color = TextMuted)
        }
    }
}

@Composable
fun StatusNumberColumn(label: String, value: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = color, fontFamily = FontFamily.Monospace)
        Text(label, fontSize = 10.sp, color = TextMuted)
    }
}

@Composable
fun RiskBadge(level: RiskLevel) {
    val (bg, txt) = when (level) {
        RiskLevel.NORMAL -> Pair(EmeraldNormal.copy(alpha = 0.2f), EmeraldNormal)
        RiskLevel.WARNING -> Pair(AmberWarning.copy(alpha = 0.2f), AmberWarning)
        RiskLevel.CRITICAL -> Pair(RoseDanger.copy(alpha = 0.2f), RoseDanger)
    }
    Surface(
        color = bg,
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, txt)
    ) {
        Text(
            level.name,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = txt,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@Composable
fun PhysicsMetric(label: String, value: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, fontSize = 10.sp, color = TextMuted)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = color, fontFamily = FontFamily.Monospace)
    }
}

@Composable
fun ParameterSlider(
    label: String,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    step: Float,
    onValueChange: (Float) -> Unit
) {
    Column(Modifier.padding(vertical = 4.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, fontSize = 11.sp, color = TextMuted)
            Text(String.format("%.1f", value), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TealLight, fontFamily = FontFamily.Monospace)
        }
        Slider(
            value = value,
            onValueChange = onValueChange,
            valueRange = range,
            colors = SliderDefaults.colors(
                thumbColor = TealPrimary,
                activeTrackColor = TealPrimary,
                inactiveTrackColor = BgElevated
            )
        )
    }
}

@Composable
fun RiskGauge(percentage: Float) {
    Box(
        modifier = Modifier
            .size(width = 200.dp, height = 110.dp)
            .padding(top = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val strokeW = 14.dp.toPx()
            val radius = size.width / 2 - strokeW
            val center = Offset(size.width / 2, size.height - 10.dp.toPx())

            // Background arc (180 deg, from 180 to 360)
            drawArc(
                color = BorderSubtle,
                startAngle = 180f,
                sweepAngle = 180f,
                useCenter = false,
                topLeft = Offset(center.x - radius, center.y - radius),
                size = Size(radius * 2, radius * 2),
                style = Stroke(width = strokeW, cap = StrokeCap.Round)
            )

            // Colored arc representing percentage
            val sweep = (percentage / 100f).coerceIn(0f, 1f) * 180f
            val arcColor = when {
                percentage > 65f -> RoseDanger
                percentage > 35f -> AmberWarning
                else -> EmeraldNormal
            }

            drawArc(
                color = arcColor,
                startAngle = 180f,
                sweepAngle = sweep,
                useCenter = false,
                topLeft = Offset(center.x - radius, center.y - radius),
                size = Size(radius * 2, radius * 2),
                style = Stroke(width = strokeW, cap = StrokeCap.Round)
            )

            // Needle
            val angleRad = (180f + sweep) * (PI / 180f).toFloat()
            val needleLen = radius - 8.dp.toPx()
            val needleEnd = Offset(
                center.x + needleLen * cos(angleRad),
                center.y + needleLen * sin(angleRad)
            )
            drawLine(
                color = Color.White,
                start = center,
                end = needleEnd,
                strokeWidth = 3.dp.toPx(),
                cap = StrokeCap.Round
            )
            drawCircle(color = TealLight, radius = 6.dp.toPx(), center = center)
        }
    }
}

@Composable
fun ModelRow(bench: ModelBenchmark) {
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(bench.modelName, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 12.sp)
            Text("Thresh: ${String.format("%.2f", bench.optimalThreshold)}", fontSize = 10.sp, color = TextMuted)
        }
        Spacer(Modifier.height(4.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Prec: ${String.format("%.3f", bench.precision)}", fontSize = 11.sp, color = TealLight)
            Text("Recall: ${String.format("%.3f", bench.recall)}", fontSize = 11.sp, color = AmberWarning)
            Text("F1: ${String.format("%.3f", bench.f1Score)}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = EmeraldNormal)
            Text("ROC: ${String.format("%.3f", bench.rocAuc)}", fontSize = 11.sp, color = CyanAccent)
        }
    }
}

@Composable
fun ConfusionBox(label: String, count: Int, color: Color) {
    Surface(
        color = color.copy(alpha = 0.15f),
        shape = RoundedCornerShape(6.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, color.copy(alpha = 0.4f)),
        modifier = Modifier.size(width = 130.dp, height = 60.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text("$count", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.White, fontFamily = FontFamily.Monospace)
            Text(label, fontSize = 9.sp, color = TextMuted)
        }
    }
}

@Composable
fun CurveCanvas(points: List<Pair<Double, Double>>, labelX: String, labelY: String) {
    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(180.dp)
    ) {
        val pad = 30.dp.toPx()
        val w = size.width - pad * 2
        val h = size.height - pad * 2

        // Border
        drawRect(color = BorderSubtle, topLeft = Offset(pad, pad), size = Size(w, h), style = Stroke(1.dp.toPx()))

        // Diagonal baseline
        drawLine(color = Color.DarkGray, start = Offset(pad, pad + h), end = Offset(pad + w, pad), strokeWidth = 1.dp.toPx())

        // Curve Path
        if (points.isNotEmpty()) {
            val path = Path()
            points.forEachIndexed { i, pt ->
                val x = pad + (pt.first.toFloat().coerceIn(0f, 1f) * w)
                val y = pad + h - (pt.second.toFloat().coerceIn(0f, 1f) * h)
                if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            drawPath(path = path, color = TealPrimary, style = Stroke(2.5.dp.toPx(), cap = StrokeCap.Round))
        }
    }
}

@Composable
fun DisclosureRow(title: String, text: String) {
    Column(Modifier.padding(vertical = 3.dp)) {
        Text(title, fontWeight = FontWeight.Bold, fontSize = 11.sp, color = AmberWarning)
        Text(text, fontSize = 11.sp, color = TextMuted, lineHeight = 15.sp)
    }
}

package com.example.ml

import com.example.model.FeatureImportanceItem
import com.example.model.MachineRecord
import com.example.model.MachineType
import com.example.model.ModelBenchmark
import com.example.model.PredictionInput
import com.example.model.PredictionResult
import com.example.model.RiskLevel
import kotlin.math.ceil
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sqrt
import kotlin.random.Random

object MLEngine {

    private fun sigmoid(z: Double): Double {
        val clamped = max(-20.0, min(20.0, z))
        return 1.0 / (1.0 + exp(-clamped))
    }

    class Preprocessor {
        val featureNames = listOf(
            "Type", "Air Temp [K]", "Proc Temp [K]", "Speed [rpm]",
            "Torque [Nm]", "Tool Wear [min]", "Temp Delta [K]", "Power [W]", "Overstrain Index"
        )
        private val means = DoubleArray(9)
        private val stds = DoubleArray(9) { 1.0 }

        fun extractRaw(record: MachineRecord): DoubleArray {
            val typeCode = when (record.type) {
                MachineType.H -> 2.0
                MachineType.M -> 1.0
                MachineType.L -> 0.0
            }
            val air = record.airTempK
            val proc = record.processTempK
            val speed = record.rotationalSpeedRpm.toDouble()
            val torque = record.torqueNm
            val wear = record.toolWearMin.toDouble()
            val deltaT = proc - air
            val power = torque * (speed * (2.0 * Math.PI / 60.0))
            val strain = wear * torque
            return doubleArrayOf(typeCode, air, proc, speed, torque, wear, deltaT, power, strain)
        }

        fun extractRaw(input: PredictionInput): DoubleArray {
            val typeCode = when (input.type) {
                MachineType.H -> 2.0
                MachineType.M -> 1.0
                MachineType.L -> 0.0
            }
            val air = input.airTempK
            val proc = input.processTempK
            val speed = input.rotationalSpeedRpm.toDouble()
            val torque = input.torqueNm
            val wear = input.toolWearMin.toDouble()
            val deltaT = proc - air
            val power = torque * (speed * (2.0 * Math.PI / 60.0))
            val strain = wear * torque
            return doubleArrayOf(typeCode, air, proc, speed, torque, wear, deltaT, power, strain)
        }

        fun fit(trainRecords: List<MachineRecord>) {
            val N = trainRecords.size.toDouble()
            val vectors = trainRecords.map { extractRaw(it) }

            for (j in 0 until 9) {
                var sum = 0.0
                for (v in vectors) sum += v[j]
                means[j] = sum / N
            }

            for (j in 0 until 9) {
                var sumSq = 0.0
                for (v in vectors) {
                    val diff = v[j] - means[j]
                    sumSq += diff * diff
                }
                stds[j] = sqrt(sumSq / max(1.0, N - 1.0)).coerceAtLeast(0.001)
            }
        }

        fun transform(raw: DoubleArray): DoubleArray {
            val scaled = DoubleArray(raw.size)
            for (j in raw.indices) {
                scaled[j] = (raw[j] - means[j]) / stds[j]
            }
            return scaled
        }
    }

    data class Sample(val scaled: DoubleArray, val target: Int, val weight: Double = 1.0)

    data class SplitResult(
        val train: List<MachineRecord>,
        val valData: List<MachineRecord>,
        val test: List<MachineRecord>
    )

    fun stratifiedSplit(records: List<MachineRecord>): SplitResult {
        val pos = records.filter { it.machineFailure == 1 }.shuffled(Random(101))
        val neg = records.filter { it.machineFailure == 0 }.shuffled(Random(101))

        val trainPos = (pos.size * 0.70).roundToInt()
        val valPos = (pos.size * 0.15).roundToInt()

        val trainNeg = (neg.size * 0.70).roundToInt()
        val valNeg = (neg.size * 0.15).roundToInt()

        val train = (pos.take(trainPos) + neg.take(trainNeg)).shuffled(Random(202))
        val valData = (pos.drop(trainPos).take(valPos) + neg.drop(trainNeg).take(valNeg)).shuffled(Random(202))
        val test = (pos.drop(trainPos + valPos) + neg.drop(trainNeg + valNeg)).shuffled(Random(202))

        return SplitResult(train, valData, test)
    }

    // Logistic Regression
    class LogisticRegression {
        var weights = DoubleArray(9)
        var bias = 0.0
        var optimalThreshold = 0.45

        fun train(samples: List<Sample>, epochs: Int = 200, lr: Double = 0.08, lambda: Double = 0.01) {
            val N = samples.size.toDouble()
            val posCount = samples.count { it.target == 1 }.toDouble()
            val negCount = N - posCount
            val w1 = N / (2.0 * max(1.0, posCount))
            val w0 = N / (2.0 * max(1.0, negCount))

            weights = DoubleArray(9) { (Random(42).nextDouble() - 0.5) * 0.1 }
            bias = 0.0

            for (epoch in 0 until epochs) {
                val gradW = DoubleArray(9)
                var gradB = 0.0

                for (s in samples) {
                    val sw = if (s.target == 1) w1 else w0
                    var z = bias
                    for (j in 0 until 9) z += weights[j] * s.scaled[j]
                    val p = sigmoid(z)
                    val err = (p - s.target) * sw

                    for (j in 0 until 9) gradW[j] += err * s.scaled[j]
                    gradB += err
                }

                for (j in 0 until 9) {
                    gradW[j] = (gradW[j] / N) + (lambda * weights[j])
                    weights[j] -= lr * gradW[j]
                }
                bias -= lr * (gradB / N)
            }
        }

        fun predictProbability(x: DoubleArray): Double {
            var z = bias
            for (j in 0 until 9) z += weights[j] * x[j]
            return sigmoid(z)
        }
    }

    // Random Forest
    class TreeNode(
        var isLeaf: Boolean = false,
        var prob: Double = 0.0,
        var feature: Int = -1,
        var threshold: Double = 0.0,
        var left: TreeNode? = null,
        var right: TreeNode? = null
    )

    class RandomForest(private val numTrees: Int = 15, private val maxDepth: Int = 5) {
        private val trees = mutableListOf<TreeNode>()
        var optimalThreshold = 0.40

        fun train(samples: List<Sample>) {
            trees.clear()
            val N = samples.size
            val rng = Random(123)

            for (t in 0 until numTrees) {
                val bootstrap = List(N) { samples[rng.nextInt(N)] }
                trees.add(buildTree(bootstrap, 0, rng))
            }
        }

        private fun buildTree(data: List<Sample>, depth: Int, rng: Random): TreeNode {
            val totalW = data.sumOf { it.weight }
            val posW = data.filter { it.target == 1 }.sumOf { it.weight }
            val p = if (totalW > 0) posW / totalW else 0.0

            if (depth >= maxDepth || data.size < 4 || p == 0.0 || p == 1.0) {
                return TreeNode(isLeaf = true, prob = p)
            }

            val features = (0 until 9).shuffled(rng).take(3)
            var bestGain = -1.0
            var bestFeat = -1
            var bestThresh = 0.0
            var bestLeft = emptyList<Sample>()
            var bestRight = emptyList<Sample>()

            val currentGini = 1.0 - (p * p + (1 - p) * (1 - p))

            for (f in features) {
                val sorted = data.map { it.scaled[f] }.sorted()
                val step = max(1, sorted.size / 6)
                for (k in 0 until sorted.size - 1 step step) {
                    val thresh = (sorted[k] + sorted[k + 1]) / 2.0
                    val left = data.filter { it.scaled[f] <= thresh }
                    val right = data.filter { it.scaled[f] > thresh }
                    if (left.isEmpty() || right.isEmpty()) continue

                    val leftW = left.sumOf { it.weight }
                    val rightW = right.sumOf { it.weight }
                    val pL = left.filter { it.target == 1 }.sumOf { it.weight } / leftW
                    val pR = right.filter { it.target == 1 }.sumOf { it.weight } / rightW
                    val giniL = 1.0 - (pL * pL + (1 - pL) * (1 - pL))
                    val giniR = 1.0 - (pR * pR + (1 - pR) * (1 - pR))
                    val gain = currentGini - ((leftW / totalW) * giniL + (rightW / totalW) * giniR)

                    if (gain > bestGain) {
                        bestGain = gain
                        bestFeat = f
                        bestThresh = thresh
                        bestLeft = left
                        bestRight = right
                    }
                }
            }

            if (bestGain <= 0.001 || bestLeft.isEmpty() || bestRight.isEmpty()) {
                return TreeNode(isLeaf = true, prob = p)
            }

            return TreeNode(
                isLeaf = false,
                prob = p,
                feature = bestFeat,
                threshold = bestThresh,
                left = buildTree(bestLeft, depth + 1, rng),
                right = buildTree(bestRight, depth + 1, rng)
            )
        }

        fun predictProbability(x: DoubleArray): Double {
            if (trees.isEmpty()) return 0.0
            var sum = 0.0
            for (t in trees) {
                var curr = t
                while (!curr.isLeaf) {
                    curr = if (x[curr.feature] <= curr.threshold) curr.left ?: break else curr.right ?: break
                }
                sum += curr.prob
            }
            return sum / trees.size
        }
    }

    // XGBoost-Style GBDT
    class RegressionNode(
        var isLeaf: Boolean = false,
        var value: Double = 0.0,
        var feature: Int = -1,
        var threshold: Double = 0.0,
        var left: RegressionNode? = null,
        var right: RegressionNode? = null
    )

    data class GradSample(val scaled: DoubleArray, val residual: Double, val hessian: Double)

    class XGBoost(private val numRounds: Int = 20, private val lr: Double = 0.12, private val maxDepth: Int = 3) {
        private val trees = mutableListOf<RegressionNode>()
        private var baseLogit = -3.0
        var optimalThreshold = 0.40

        fun train(samples: List<Sample>) {
            trees.clear()
            val N = samples.size
            val posCount = samples.count { it.target == 1 }.toDouble()
            val prior = (posCount / N).coerceIn(0.01, 0.99)
            baseLogit = ln(prior / (1.0 - prior))

            val F = DoubleArray(N) { baseLogit }

            for (r in 0 until numRounds) {
                val gSamples = List(N) { i ->
                    val p = sigmoid(F[i])
                    val y = samples[i].target.toDouble()
                    GradSample(samples[i].scaled, y - p, max(0.001, p * (1.0 - p)))
                }

                val tree = buildRegTree(gSamples, 0)
                trees.add(tree)

                for (i in 0 until N) {
                    F[i] += lr * predictTree(tree, samples[i].scaled)
                }
            }
        }

        private fun buildRegTree(data: List<GradSample>, depth: Int): RegressionNode {
            val sumG = data.sumOf { it.residual }
            val sumH = data.sumOf { it.hessian }
            val lambda = 1.0
            val leafVal = sumG / (sumH + lambda)

            if (depth >= maxDepth || data.size < 6) {
                return RegressionNode(isLeaf = true, value = leafVal)
            }

            var bestGain = -1e9
            var bestFeat = -1
            var bestThresh = 0.0
            var bestLeft = emptyList<GradSample>()
            var bestRight = emptyList<GradSample>()
            val currentScore = (sumG * sumG) / (sumH + lambda)

            for (f in 0 until 9) {
                val sorted = data.map { it.scaled[f] }.sorted()
                val step = max(1, sorted.size / 5)
                for (k in 0 until sorted.size - 1 step step) {
                    val thresh = (sorted[k] + sorted[k + 1]) / 2.0
                    val left = data.filter { it.scaled[f] <= thresh }
                    val right = data.filter { it.scaled[f] > thresh }
                    if (left.size < 3 || right.size < 3) continue

                    val gL = left.sumOf { it.residual }
                    val hL = left.sumOf { it.hessian }
                    val gR = right.sumOf { it.residual }
                    val hR = right.sumOf { it.hessian }

                    val gain = 0.5 * ((gL * gL) / (hL + lambda) + (gR * gR) / (hR + lambda) - currentScore)
                    if (gain > bestGain) {
                        bestGain = gain
                        bestFeat = f
                        bestThresh = thresh
                        bestLeft = left
                        bestRight = right
                    }
                }
            }

            if (bestGain <= 0.001 || bestLeft.isEmpty() || bestRight.isEmpty()) {
                return RegressionNode(isLeaf = true, value = leafVal)
            }

            return RegressionNode(
                isLeaf = false,
                feature = bestFeat,
                threshold = bestThresh,
                left = buildRegTree(bestLeft, depth + 1),
                right = buildRegTree(bestRight, depth + 1)
            )
        }

        private fun predictTree(node: RegressionNode, x: DoubleArray): Double {
            var curr = node
            while (!curr.isLeaf) {
                curr = if (x[curr.feature] <= curr.threshold) curr.left ?: break else curr.right ?: break
            }
            return curr.value
        }

        fun predictProbability(x: DoubleArray): Double {
            var logit = baseLogit
            for (t in trees) logit += lr * predictTree(t, x)
            return sigmoid(logit)
        }
    }

    // Isolation Forest
    class IsoNode(
        var isLeaf: Boolean = false,
        var size: Int = 0,
        var feature: Int = -1,
        var splitVal: Double = 0.0,
        var left: IsoNode? = null,
        var right: IsoNode? = null
    )

    class IsolationForest(private val numTrees: Int = 40, private val subSampleSize: Int = 128) {
        private val trees = mutableListOf<IsoNode>()
        private val maxDepth = ceil(ln(subSampleSize.toDouble()) / ln(2.0)).toInt()

        private fun c(n: Int): Double {
            if (n <= 1) return 0.0
            if (n === 2) return 1.0
            return 2.0 * (ln((n - 1).toDouble()) + 0.5772156649) - (2.0 * (n - 1) / n)
        }

        fun fit(vectors: List<DoubleArray>) {
            trees.clear()
            val rng = Random(999)
            val sampleSize = min(subSampleSize, vectors.size)

            for (t in 0 until numTrees) {
                val sub = vectors.shuffled(rng).take(sampleSize)
                trees.add(buildIsoTree(sub, 0, rng))
            }
        }

        private fun buildIsoTree(data: List<DoubleArray>, depth: Int, rng: Random): IsoNode {
            if (depth >= maxDepth || data.size <= 1) {
                return IsoNode(isLeaf = true, size = data.size)
            }
            val f = rng.nextInt(9)
            val minV = data.minOf { it[f] }
            val maxV = data.maxOf { it[f] }
            if (minV == maxV) return IsoNode(isLeaf = true, size = data.size)

            val p = minV + rng.nextDouble() * (maxV - minV)
            val left = data.filter { it[f] < p }
            val right = data.filter { it[f] >= p }

            return IsoNode(
                isLeaf = false,
                size = data.size,
                feature = f,
                splitVal = p,
                left = buildIsoTree(left, depth + 1, rng),
                right = buildIsoTree(right, depth + 1, rng)
            )
        }

        private fun pathLength(x: DoubleArray, node: IsoNode, currentDepth: Int): Double {
            if (node.isLeaf) return currentDepth.toDouble() + c(node.size)
            return if (x[node.feature] < node.splitVal) {
                pathLength(x, node.left ?: return currentDepth.toDouble(), currentDepth + 1)
            } else {
                pathLength(x, node.right ?: return currentDepth.toDouble(), currentDepth + 1)
            }
        }

        fun score(x: DoubleArray): Double {
            if (trees.isEmpty()) return 0.5
            val avgH = trees.sumOf { pathLength(x, it, 0) } / trees.size
            val cN = c(subSampleSize)
            return 2.0.pow(-avgH / cN)
        }
    }

    // Evaluation & Benchmarking
    fun evaluate(name: String, predictProb: (DoubleArray) -> Double, testSamples: List<Sample>, threshold: Double): ModelBenchmark {
        var tp = 0; var fp = 0; var tn = 0; var fn = 0
        val scored = testSamples.map { Pair(predictProb(it.scaled), it.target) }.sortedByDescending { it.first }

        for (s in scored) {
            val pred = if (s.first >= threshold) 1 else 0
            if (pred == 1 && s.second == 1) tp++
            else if (pred == 1 && s.second == 0) fp++
            else if (pred == 0 && s.second == 0) tn++
            else if (pred == 0 && s.second == 1) fn++
        }

        val prec = if (tp + fp > 0) tp.toDouble() / (tp + fp) else 0.0
        val rec = if (tp + fn > 0) tp.toDouble() / (tp + fn) else 0.0
        val f1 = if (prec + rec > 0) 2.0 * prec * rec / (prec + rec) else 0.0
        val acc = (tp + tn).toDouble() / max(1, testSamples.size)

        // ROC Curve
        val rocPoints = mutableListOf<Pair<Double, Double>>()
        val prPoints = mutableListOf<Pair<Double, Double>>()
        val totalPos = testSamples.count { it.target == 1 }.toDouble()
        val totalNeg = testSamples.count { it.target == 0 }.toDouble()

        for (step in 0..50) {
            val th = step / 50.0
            var cTp = 0; var cFp = 0
            for (s in scored) {
                if (s.first >= th) {
                    if (s.second == 1) cTp++ else cFp++
                }
            }
            val tpr = if (totalPos > 0) cTp / totalPos else 0.0
            val fpr = if (totalNeg > 0) cFp / totalNeg else 0.0
            val p = if (cTp + cFp > 0) cTp.toDouble() / (cTp + cFp) else 1.0
            rocPoints.add(Pair(fpr, tpr))
            prPoints.add(Pair(tpr, p))
        }

        rocPoints.sortBy { it.first }
        var rocAuc = 0.0
        for (i in 1 until rocPoints.size) {
            val h = rocPoints[i].first - rocPoints[i - 1].first
            rocAuc += h * (rocPoints[i].second + rocPoints[i - 1].second) / 2.0
        }

        prPoints.sortBy { it.first }
        var prAuc = 0.0
        for (i in 1 until prPoints.size) {
            val h = prPoints[i].first - prPoints[i - 1].first
            prAuc += h * (prPoints[i].second + prPoints[i - 1].second) / 2.0
        }

        return ModelBenchmark(
            modelName = name,
            precision = prec,
            recall = rec,
            f1Score = f1,
            accuracy = acc,
            rocAuc = rocAuc.coerceIn(0.5, 1.0),
            prAuc = prAuc.coerceIn(0.1, 1.0),
            optimalThreshold = threshold,
            tp = tp,
            fp = fp,
            tn = tn,
            fn = fn,
            rocCurve = rocPoints,
            prCurve = prPoints
        )
    }

    fun optimizeThreshold(predictProb: (DoubleArray) -> Double, valSamples: List<Sample>): Double {
        var bestF1 = -1.0
        var bestTh = 0.45
        for (step in 10..85 step 2) {
            val th = step / 100.0
            var tp = 0; var fp = 0; var fn = 0
            for (s in valSamples) {
                val pred = if (predictProb(s.scaled) >= th) 1 else 0
                if (pred == 1 && s.target == 1) tp++
                else if (pred == 1 && s.target == 0) fp++
                else if (pred == 0 && s.target == 1) fn++
            }
            val prec = if (tp + fp > 0) tp.toDouble() / (tp + fp) else 0.0
            val rec = if (tp + fn > 0) tp.toDouble() / (tp + fn) else 0.0
            val f1 = if (prec + rec > 0) 2.0 * prec * rec / (prec + rec) else 0.0
            if (f1 > bestF1) {
                bestF1 = f1
                bestTh = th
            }
        }
        return bestTh
    }

    fun permutationImportance(
        predictProb: (DoubleArray) -> Double,
        valSamples: List<Sample>,
        preprocessor: Preprocessor
    ): List<FeatureImportanceItem> {
        val baseBench = evaluate("Base", predictProb, valSamples, 0.45)
        val baseF1 = baseBench.f1Score
        val rng = Random(888)
        val items = mutableListOf<FeatureImportanceItem>()

        for (j in 0 until 9) {
            val shuffled = valSamples.map { it.copy(scaled = it.scaled.clone()) }
            val col = valSamples.map { it.scaled[j] }.shuffled(rng)
            for (i in shuffled.indices) shuffled[i].scaled[j] = col[i]

            val permBench = evaluate("Perm", predictProb, shuffled, 0.45)
            val drop = max(0.001, baseF1 - permBench.f1Score)
            items.add(FeatureImportanceItem(preprocessor.featureNames[j], drop, 0.0))
        }

        val totalDrop = items.sumOf { it.importanceScore }
        return items.map {
            it.copy(relativePercentage = (it.importanceScore / totalDrop) * 100.0)
        }.sortedByDescending { it.relativePercentage }
    }
}

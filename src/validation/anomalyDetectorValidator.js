// src/validation/anomalyDetectorValidator.js
import { AnomalyDetector } from '../models/anomalyDetector';
import { DataCollector } from '../services/dataCollector';

/**
 * Classe para validação do detector de anomalias
 * 
 * Esta classe implementa métodos para validar o detector de anomalias
 * usando dados reais e sintéticos, gerando relatórios de performance
 * e acurácia.
 */
export class AnomalyDetectorValidator {
  constructor(config = {}) {
    this.config = {
      sampleSize: config.sampleSize || 100, // Número de amostras para validação
      testTickers: config.testTickers || ['KNRI11', 'HGLG11', 'MXRF11', 'XPLG11', 'VISC11'],
      anomalyRates: config.anomalyRates || [0.05, 0.1, 0.15], // Taxas de anomalias para testes
      methods: config.methods || ['zScore', 'iqr', 'isolationForest', 'autoencoder'],
      ...config
    };
    
    this.detector = new AnomalyDetector(config.detectorConfig);
    this.dataCollector = new DataCollector(config.collectorConfig);
    this.results = {};
  }
  
  /**
   * Inicializa o validador
   * @returns {Promise<boolean>} - Sucesso da inicialização
   */
  async initialize() {
    return await this.detector.initialize();
  }
  
  /**
   * Valida o detector com dados reais e sintéticos
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateDetector() {
    try {
      console.log('Iniciando validação do detector de anomalias...');
      
      // Inicializar detector
      await this.initialize();
      
      // Validar com dados sintéticos
      const syntheticResults = await this.validateWithSyntheticData();
      
      // Validar com dados reais
      let realResults = null;
      try {
        realResults = await this.validateWithRealData();
      } catch (error) {
        console.warn('Não foi possível validar com dados reais:', error);
      }
      
      // Validar com dados de benchmark
      const benchmarkResults = await this.validateWithBenchmarkData();
      
      // Consolidar resultados
      this.results = {
        synthetic: syntheticResults,
        real: realResults,
        benchmark: benchmarkResults,
        summary: this.generateSummary(syntheticResults, realResults, benchmarkResults)
      };
      
      console.log('Validação concluída com sucesso');
      console.log(`Precisão geral: ${this.results.summary.overallPrecision.toFixed(2)}%`);
      console.log(`Recall geral: ${this.results.summary.overallRecall.toFixed(2)}%`);
      
      return this.results;
    } catch (error) {
      console.error('Erro na validação do detector de anomalias:', error);
      throw error;
    }
  }
  
  /**
   * Valida o detector com dados sintéticos
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateWithSyntheticData() {
    console.log('Validando com dados sintéticos...');
    
    const results = {
      byRate: {},
      overall: {}
    };
    
    // Testar diferentes taxas de anomalias
    for (const anomalyRate of this.config.anomalyRates) {
      console.log(`Testando taxa de anomalias: ${anomalyRate}`);
      
      const rateResults = await this.validateSyntheticRate(anomalyRate);
      results.byRate[anomalyRate] = rateResults;
    }
    
    // Calcular métricas gerais
    results.overall = this.calculateOverallMetrics(
      Object.values(results.byRate).map(r => r.metrics)
    );
    
    console.log(`Validação sintética concluída: F1-Score: ${results.overall.f1Score.toFixed(2)}`);
    
    return results;
  }
  
  /**
   * Valida o detector com uma taxa específica de anomalias sintéticas
   * @param {Number} anomalyRate - Taxa de anomalias
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateSyntheticRate(anomalyRate) {
    // Gerar dados sintéticos
    const { data, anomalyIndices } = this.generateSyntheticDividendData(
      this.config.sampleSize,
      anomalyRate
    );
    
    // Converter para formato de dividendos
    const dividendData = data.map((value, index) => ({
      date: new Date(2024, 0, index + 1).toISOString().split('T')[0],
      value,
      price: 100, // Preço fixo para simplificar
      yield: (value / 100) * 100 // Yield em %
    }));
    
    // Detectar anomalias
    const detectionResults = await this.detector.detectDividendAnomalies(dividendData);
    
    // Extrair índices detectados
    const detectedIndices = detectionResults.anomalies.map(
      anomaly => dividendData.findIndex(d => d.date === anomaly.date)
    );
    
    // Calcular métricas
    const metrics = this.calculateDetectionMetrics(anomalyIndices, detectedIndices, data.length);
    
    // Analisar resultados por método
    const methodResults = {};
    
    for (const method of this.config.methods) {
      if (detectionResults.methods[method]) {
        const methodIndices = [];
        
        // Reconstruir índices detectados por este método
        detectionResults.anomalies.forEach(anomaly => {
          if (anomaly.detectedBy.includes(method)) {
            const index = dividendData.findIndex(d => d.date === anomaly.date);
            if (index !== -1) {
              methodIndices.push(index);
            }
          }
        });
        
        // Calcular métricas para este método
        methodResults[method] = this.calculateDetectionMetrics(
          anomalyIndices,
          methodIndices,
          data.length
        );
      }
    }
    
    return {
      anomalyRate,
      metrics,
      methodResults,
      sampleSize: data.length,
      actualAnomalyCount: anomalyIndices.length,
      detectedAnomalyCount: detectedIndices.length
    };
  }
  
  /**
   * Valida o detector com dados reais
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateWithRealData() {
    console.log('Validando com dados reais...');
    
    const results = {
      byTicker: {},
      overall: {}
    };
    
    // Testar cada ticker
    for (const ticker of this.config.testTickers) {
      try {
        console.log(`Testando ticker: ${ticker}`);
        
        // Obter dados históricos
        const startDate = this.getDateYearsAgo(2); // 2 anos de dados
        const endDate = new Date().toISOString().split('T')[0];
        
        const dividendData = await this.dataCollector.getHistoricalDividends(
          ticker,
          startDate,
          endDate
        );
        
        if (!dividendData || dividendData.length < 10) {
          console.warn(`Dados insuficientes para ${ticker}, pulando...`);
          continue;
        }
        
        console.log(`Obtidos ${dividendData.length} pontos de dados para ${ticker}`);
        
        // Detectar anomalias
        const detectionResults = await this.detector.detectDividendAnomalies(dividendData);
        
        // Como não temos ground truth para dados reais, avaliar consistência
        const consistencyResults = this.evaluateConsistency(detectionResults, dividendData);
        
        results.byTicker[ticker] = {
          sampleSize: dividendData.length,
          detectedAnomalyCount: detectionResults.anomalies.length,
          anomalyRate: detectionResults.stats.percentage / 100,
          consistency: consistencyResults,
          methodAgreement: this.calculateMethodAgreement(detectionResults)
        };
      } catch (error) {
        console.error(`Erro ao validar ${ticker}:`, error);
      }
    }
    
    // Calcular métricas gerais
    if (Object.keys(results.byTicker).length > 0) {
      results.overall = {
        averageAnomalyRate: this.calculateAverage(
          Object.values(results.byTicker).map(r => r.anomalyRate)
        ),
        averageConsistency: this.calculateAverage(
          Object.values(results.byTicker).map(r => r.consistency.overallConsistency)
        ),
        averageMethodAgreement: this.calculateAverage(
          Object.values(results.byTicker).map(r => r.methodAgreement.averageAgreement)
        )
      };
      
      console.log(`Validação real concluída: Consistência média: ${results.overall.averageConsistency.toFixed(2)}`);
    } else {
      console.warn('Não foi possível realizar validação com dados reais');
    }
    
    return results;
  }
  
  /**
   * Valida o detector com dados de benchmark
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateWithBenchmarkData() {
    console.log('Validando com dados de benchmark...');
    
    // Dados de benchmark com anomalias conhecidas
    const benchmarkData = this.generateBenchmarkData();
    
    const results = {
      scenarios: {},
      overall: {}
    };
    
    // Testar cada cenário
    for (const [scenario, data] of Object.entries(benchmarkData)) {
      console.log(`Testando cenário: ${scenario}`);
      
      // Detectar anomalias
      const detectionResults = await this.detector.detectDividendAnomalies(data.dividendData);
      
      // Extrair índices detectados
      const detectedIndices = detectionResults.anomalies.map(
        anomaly => data.dividendData.findIndex(d => d.date === anomaly.date)
      );
      
      // Calcular métricas
      const metrics = this.calculateDetectionMetrics(
        data.anomalyIndices,
        detectedIndices,
        data.dividendData.length
      );
      
      // Analisar resultados por método
      const methodResults = {};
      
      for (const method of this.config.methods) {
        if (detectionResults.methods[method]) {
          const methodIndices = [];
          
          // Reconstruir índices detectados por este método
          detectionResults.anomalies.forEach(anomaly => {
            if (anomaly.detectedBy.includes(method)) {
              const index = data.dividendData.findIndex(d => d.date === anomaly.date);
              if (index !== -1) {
                methodIndices.push(index);
              }
            }
          });
          
          // Calcular métricas para este método
          methodResults[method] = this.calculateDetectionMetrics(
            data.anomalyIndices,
            methodIndices,
            data.dividendData.length
          );
        }
      }
      
      results.scenarios[scenario] = {
        metrics,
        methodResults,
        sampleSize: data.dividendData.length,
        actualAnomalyCount: data.anomalyIndices.length,
        detectedAnomalyCount: detectedIndices.length
      };
    }
    
    // Calcular métricas gerais
    results.overall = this.calculateOverallMetrics(
      Object.values(results.scenarios).map(r => r.metrics)
    );
    
    console.log(`Validação benchmark concluída: F1-Score: ${results.overall.f1Score.toFixed(2)}`);
    
    return results;
  }
  
  /**
   * Gera dados sintéticos de dividendos com anomalias conhecidas
   * @param {Number} count - Número de pontos a gerar
   * @param {Number} anomalyRate - Taxa de anomalias (0-1)
   * @returns {Object} - Dados sintéticos e índices de anomalias
   */
  generateSyntheticDividendData(count = 100, anomalyRate = 0.05) {
    // Gerar valores base
    const baseValues = this.detector.generateSyntheticData(count, anomalyRate);
    
    // Escalar para valores realistas de dividendos (entre 0.3 e 1.2)
    const data = baseValues.map(value => 0.3 + value * 0.9);
    
    // Identificar anomalias (valores nos extremos)
    const anomalyIndices = [];
    
    data.forEach((value, index) => {
      if (value < 0.35 || value > 1.15) {
        anomalyIndices.push(index);
      }
    });
    
    return { data, anomalyIndices };
  }
  
  /**
   * Gera dados de benchmark para validação
   * @returns {Object} - Cenários de benchmark
   */
  generateBenchmarkData() {
    const scenarios = {};
    
    // Cenário 1: Dividendos estáveis com picos ocasionais
    scenarios.stable_with_spikes = this.generateScenario(
      'stable_with_spikes',
      0.8,
      0.05,
      [10, 25, 40], // Índices de picos
      2.0 // Multiplicador para picos
    );
    
    // Cenário 2: Dividendos com tendência de crescimento e quedas abruptas
    scenarios.growth_with_drops = this.generateScenario(
      'growth_with_drops',
      0.6,
      0.1,
      [15, 30, 45], // Índices de quedas
      0.3, // Multiplicador para quedas
      true // Com tendência
    );
    
    // Cenário 3: Dividendos voláteis com outliers
    scenarios.volatile = this.generateScenario(
      'volatile',
      0.7,
      0.2,
      [8, 22, 38, 47], // Índices de outliers
      [2.5, 0.2, 2.2, 0.25] // Multiplicadores específicos
    );
    
    // Cenário 4: Dividendos sazonais com anomalias
    scenarios.seasonal = this.generateSeasonalScenario(
      'seasonal',
      0.7,
      0.1
    );
    
    return scenarios;
  }
  
  /**
   * Gera um cenário de benchmark
   * @param {String} name - Nome do cenário
   * @param {Number} baseValue - Valor base dos dividendos
   * @param {Number} noise - Nível de ruído (0-1)
   * @param {Array} anomalyIndices - Índices das anomalias
   * @param {Number|Array} anomalyMultiplier - Multiplicador para anomalias
   * @param {Boolean} withTrend - Se deve incluir tendência
   * @returns {Object} - Dados do cenário
   */
  generateScenario(name, baseValue, noise, anomalyIndices, anomalyMultiplier, withTrend = false) {
    const count = 50; // 50 pontos de dados
    const dividendData = [];
    
    // Gerar datas (mensais)
    const startDate = new Date(2023, 0, 15); // 15 de janeiro de 2023
    
    for (let i = 0; i < count; i++) {
      // Calcular valor base com ruído
      let value = baseValue + (Math.random() * 2 - 1) * noise;
      
      // Adicionar tendência se necessário
      if (withTrend) {
        value += (i / count) * 0.4; // Tendência de crescimento
      }
      
      // Verificar se é um ponto de anomalia
      if (anomalyIndices.includes(i)) {
        // Aplicar multiplicador (pode ser específico por índice)
        const multiplier = Array.isArray(anomalyMultiplier) 
          ? anomalyMultiplier[anomalyIndices.indexOf(i)]
          : anomalyMultiplier;
        
        value *= multiplier;
      }
      
      // Garantir valor mínimo
      value = Math.max(0.1, value);
      
      // Calcular data
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      
      // Adicionar ao array
      dividendData.push({
        date: date.toISOString().split('T')[0],
        value,
        price: 100, // Preço fixo para simplificar
        yield: (value / 100) * 100 // Yield em %
      });
    }
    
    return {
      name,
      dividendData,
      anomalyIndices
    };
  }
  
  /**
   * Gera um cenário sazonal de benchmark
   * @param {String} name - Nome do cenário
   * @param {Number} baseValue - Valor base dos dividendos
   * @param {Number} noise - Nível de ruído (0-1)
   * @returns {Object} - Dados do cenário
   */
  generateSeasonalScenario(name, baseValue, noise) {
    const count = 50; // 50 pontos de dados
    const dividendData = [];
    const anomalyIndices = [12, 24, 36]; // Anomalias nos meses 12, 24 e 36
    
    // Gerar datas (mensais)
    const startDate = new Date(2023, 0, 15); // 15 de janeiro de 2023
    
    for (let i = 0; i < count; i++) {
      // Calcular componente sazonal (ciclo de 12 meses)
      const seasonal = Math.sin((i % 12) / 12 * 2 * Math.PI) * 0.2;
      
      // Calcular valor base com sazonalidade e ruído
      let value = baseValue + seasonal + (Math.random() * 2 - 1) * noise;
      
      // Verificar se é um ponto de anomalia
      if (anomalyIndices.includes(i)) {
        // Anomalias diferentes em cada ponto
        if (i === 12) value *= 2.0; // Pico
        else if (i === 24) value *= 0.3; // Queda
        else if (i === 36) value *= 1.8; // Pico menor
      }
      
      // Garantir valor mínimo
      value = Math.max(0.1, value);
      
      // Calcular data
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      
      // Adicionar ao array
      dividendData.push({
        date: date.toISOString().split('T')[0],
        value,
        price: 100, // Preço fixo para simplificar
        yield: (value / 100) * 100 // Yield em %
      });
    }
    
    return {
      name,
      dividendData,
      anomalyIndices
    };
  }
  
  /**
   * Calcula métricas de detecção de anomalias
   * @param {Array} actualIndices - Índices reais de anomalias
   * @param {Array} detectedIndices - Índices detectados como anomalias
   * @param {Number} totalCount - Total de pontos de dados
   * @returns {Object} - Métricas calculadas
   */
  calculateDetectionMetrics(actualIndices, detectedIndices, totalCount) {
    // Converter para conjuntos para facilitar operações
    const actualSet = new Set(actualIndices);
    const detectedSet = new Set(detectedIndices);
    
    // Calcular verdadeiros positivos (TP)
    const truePositives = detectedIndices.filter(index => actualSet.has(index)).length;
    
    // Calcular falsos positivos (FP)
    const falsePositives = detectedIndices.filter(index => !actualSet.has(index)).length;
    
    // Calcular falsos negativos (FN)
    const falseNegatives = actualIndices.filter(index => !detectedSet.has(index)).length;
    
    // Calcular verdadeiros negativos (TN)
    const trueNegatives = totalCount - truePositives - falsePositives - falseNegatives;
    
    // Calcular precisão (precision)
    const precision = detectedIndices.length > 0 
      ? truePositives / detectedIndices.length 
      : 0;
    
    // Calcular recall
    const recall = actualIndices.length > 0 
      ? truePositives / actualIndices.length 
      : 0;
    
    // Calcular F1-score
    const f1Score = precision > 0 && recall > 0 
      ? 2 * (precision * recall) / (precision + recall) 
      : 0;
    
    // Calcular acurácia
    const accuracy = totalCount > 0 
      ? (truePositives + trueNegatives) / totalCount 
      : 0;
    
    return {
      precision: precision * 100,
      recall: recall * 100,
      f1Score: f1Score * 100,
      accuracy: accuracy * 100,
      truePositives,
      falsePositives,
      trueNegatives,
      falseNegatives
    };
  }
  
  /**
   * Avalia a consistência das detecções em dados reais
   * @param {Object} detectionResults - Resultados da detecção
   * @param {Array} dividendData - Dados de dividendos
   * @returns {Object} - Métricas de consistência
   */
  evaluateConsistency(detectionResults, dividendData) {
    // Extrair valores e calcular estatísticas
    const values = dividendData.map(item => item.value);
    const mean = this.calculateMean(values);
    const stdDev = this.calculateStdDev(values);
    
    // Calcular Z-scores para todos os pontos
    const zScores = values.map(value => Math.abs((value - mean) / stdDev));
    
    // Ordenar Z-scores (do maior para o menor)
    const sortedIndices = zScores
      .map((score, index) => ({ score, index }))
      .sort((a, b) => b.score - a.score);
    
    // Pegar os top N% como "prováveis anomalias"
    const anomalyRate = detectionResults.stats.percentage / 100;
    const topCount = Math.max(1, Math.ceil(values.length * anomalyRate));
    const topIndices = sortedIndices.slice(0, topCount).map(item => item.index);
    
    // Extrair índices detectados
    const detectedIndices = detectionResults.anomalies.map(
      anomaly => dividendData.findIndex(d => d.date === anomaly.date)
    );
    
    // Calcular sobreposição
    const overlap = detectedIndices.filter(index => topIndices.includes(index)).length;
    const overlapRate = topCount > 0 ? overlap / topCount : 0;
    
    // Verificar se as anomalias detectadas são realmente outliers
    const detectedZScores = detectedIndices.map(index => zScores[index]);
    const avgDetectedZScore = detectedZScores.length > 0 
      ? detectedZScores.reduce((sum, score) => sum + score, 0) / detectedZScores.length 
      : 0;
    
    // Verificar consistência de severidade
    const severityConsistency = detectionResults.anomalies.every(anomaly => {
      const index = dividendData.findIndex(d => d.date === anomaly.date);
      const zScore = zScores[index];
      
      // Verificar se severidade corresponde ao Z-score
      if (anomaly.severity === 'high' && zScore < 2) return false;
      if (anomaly.severity === 'low' && zScore > 3) return false;
      
      return true;
    });
    
    return {
      overlapWithTopOutliers: overlapRate * 100,
      averageZScoreOfDetected: avgDetectedZScore,
      severityConsistency: severityConsistency ? 100 : 0,
      overallConsistency: (overlapRate * 0.6 + (avgDetectedZScore / 4) * 0.3 + (severityConsistency ? 0.1 : 0)) * 100
    };
  }
  
  /**
   * Calcula o acordo entre diferentes métodos de detecção
   * @param {Object} detectionResults - Resultados da detecção
   * @returns {Object} - Métricas de acordo entre métodos
   */
  calculateMethodAgreement(detectionResults) {
    const methods = Object.keys(detectionResults.methods);
    
    if (methods.length <= 1) {
      return {
        pairwiseAgreement: {},
        averageAgreement: 0
      };
    }
    
    // Mapear anomalias detectadas por cada método
    const methodDetections = {};
    
    detectionResults.anomalies.forEach(anomaly => {
      anomaly.detectedBy.forEach(method => {
        if (!methodDetections[method]) {
          methodDetections[method] = new Set();
        }
        methodDetections[method].add(anomaly.date);
      });
    });
    
    // Calcular acordo par a par
    const pairwiseAgreement = {};
    let totalAgreement = 0;
    let pairCount = 0;
    
    for (let i = 0; i < methods.length; i++) {
      for (let j = i + 1; j < methods.length; j++) {
        const method1 = methods[i];
        const method2 = methods[j];
        
        const detections1 = methodDetections[method1] || new Set();
        const detections2 = methodDetections[method2] || new Set();
        
        // Calcular interseção
        const intersection = new Set([...detections1].filter(x => detections2.has(x)));
        
        // Calcular união
        const union = new Set([...detections1, ...detections2]);
        
        // Calcular coeficiente de Jaccard
        const jaccard = union.size > 0 ? intersection.size / union.size : 0;
        
        pairwiseAgreement[`${method1}_${method2}`] = jaccard * 100;
        totalAgreement += jaccard;
        pairCount++;
      }
    }
    
    // Calcular acordo médio
    const averageAgreement = pairCount > 0 ? (totalAgreement / pairCount) * 100 : 0;
    
    return {
      pairwiseAgreement,
      averageAgreement
    };
  }
  
  /**
   * Calcula métricas gerais a partir de múltiplas métricas
   * @param {Array} metricsArray - Array de objetos de métricas
   * @returns {Object} - Métricas gerais
   */
  calculateOverallMetrics(metricsArray) {
    if (!metricsArray || metricsArray.length === 0) {
      return {
        precision: 0,
        recall: 0,
        f1Score: 0,
        accuracy: 0
      };
    }
    
    // Calcular médias
    const precision = this.calculateAverage(metricsArray.map(m => m.precision));
    const recall = this.calculateAverage(metricsArray.map(m => m.recall));
    const f1Score = this.calculateAverage(metricsArray.map(m => m.f1Score));
    const accuracy = this.calculateAverage(metricsArray.map(m => m.accuracy));
    
    // Somar contadores
    const truePositives = metricsArray.reduce((sum, m) => sum + m.truePositives, 0);
    const falsePositives = metricsArray.reduce((sum, m) => sum + m.falsePositives, 0);
    const trueNegatives = metricsArray.reduce((sum, m) => sum + m.trueNegatives, 0);
    const falseNegatives = metricsArray.reduce((sum, m) => sum + m.falseNegatives, 0);
    
    return {
      precision,
      recall,
      f1Score,
      accuracy,
      truePositives,
      falsePositives,
      trueNegatives,
      falseNegatives
    };
  }
  
  /**
   * Calcula a média de um array de valores
   * @param {Array} values - Array de valores
   * @returns {Number} - Média
   */
  calculateAverage(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Calcula a média de um array de valores
   * @param {Array} values - Array de valores
   * @returns {Number} - Média
   */
  calculateMean(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Calcula o desvio padrão de um array de valores
   * @param {Array} values - Array de valores
   * @returns {Number} - Desvio padrão
   */
  calculateStdDev(values) {
    if (!values || values.length <= 1) return 0;
    
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Obtém data há X anos atrás
   * @param {Number} years - Número de anos
   * @returns {String} - Data no formato YYYY-MM-DD
   */
  getDateYearsAgo(years) {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    return date.toISOString().split('T')[0];
  }
  
  /**
   * Gera resumo dos resultados de validação
   * @param {Object} syntheticResults - Resultados de dados sintéticos
   * @param {Object} realResults - Resultados de dados reais
   * @param {Object} benchmarkResults - Resultados de dados de benchmark
   * @returns {Object} - Resumo consolidado
   */
  generateSummary(syntheticResults, realResults, benchmarkResults) {
    // Calcular precisão e recall gerais
    const overallPrecision = this.calculateAverage([
      syntheticResults ? syntheticResults.overall.precision : 0,
      benchmarkResults ? benchmarkResults.overall.precision : 0
    ].filter(v => v > 0));
    
    const overallRecall = this.calculateAverage([
      syntheticResults ? syntheticResults.overall.recall : 0,
      benchmarkResults ? benchmarkResults.overall.recall : 0
    ].filter(v => v > 0));
    
    // Calcular F1-score geral
    const overallF1Score = overallPrecision > 0 && overallRecall > 0
      ? 2 * (overallPrecision * overallRecall) / (overallPrecision + overallRecall)
      : 0;
    
    // Calcular consistência com dados reais
    const realConsistency = realResults && realResults.overall 
      ? realResults.overall.averageConsistency 
      : 0;
    
    // Identificar melhor método
    const methodPerformance = {};
    
    // Analisar métodos em dados sintéticos
    if (syntheticResults && syntheticResults.byRate) {
      Object.values(syntheticResults.byRate).forEach(rateResult => {
        if (rateResult.methodResults) {
          Object.entries(rateResult.methodResults).forEach(([method, metrics]) => {
            if (!methodPerformance[method]) {
              methodPerformance[method] = { f1Scores: [] };
            }
            
            methodPerformance[method].f1Scores.push(metrics.f1Score);
          });
        }
      });
    }
    
    // Analisar métodos em dados de benchmark
    if (benchmarkResults && benchmarkResults.scenarios) {
      Object.values(benchmarkResults.scenarios).forEach(scenarioResult => {
        if (scenarioResult.methodResults) {
          Object.entries(scenarioResult.methodResults).forEach(([method, metrics]) => {
            if (!methodPerformance[method]) {
              methodPerformance[method] = { f1Scores: [] };
            }
            
            methodPerformance[method].f1Scores.push(metrics.f1Score);
          });
        }
      });
    }
    
    // Calcular F1-score médio para cada método
    Object.keys(methodPerformance).forEach(method => {
      const scores = methodPerformance[method].f1Scores;
      methodPerformance[method].averageF1 = scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 0;
    });
    
    // Encontrar melhor método
    let bestMethod = null;
    let bestF1 = -1;
    
    Object.entries(methodPerformance).forEach(([method, performance]) => {
      if (performance.averageF1 > bestF1) {
        bestF1 = performance.averageF1;
        bestMethod = method;
      }
    });
    
    // Identificar pontos fortes e fracos
    const strengths = [];
    const weaknesses = [];
    
    // Analisar precisão e recall
    if (overallPrecision > 80) {
      strengths.push(`Alta precisão geral (${overallPrecision.toFixed(1)}%)`);
    } else if (overallPrecision < 60) {
      weaknesses.push(`Baixa precisão geral (${overallPrecision.toFixed(1)}%)`);
    }
    
    if (overallRecall > 80) {
      strengths.push(`Alto recall geral (${overallRecall.toFixed(1)}%)`);
    } else if (overallRecall < 60) {
      weaknesses.push(`Baixo recall geral (${overallRecall.toFixed(1)}%)`);
    }
    
    // Analisar consistência
    if (realConsistency > 80) {
      strengths.push(`Alta consistência com dados reais (${realConsistency.toFixed(1)}%)`);
    } else if (realConsistency < 60) {
      weaknesses.push(`Baixa consistência com dados reais (${realConsistency.toFixed(1)}%)`);
    }
    
    // Analisar métodos
    if (bestMethod) {
      strengths.push(`Melhor desempenho com método ${bestMethod} (F1: ${bestF1.toFixed(1)}%)`);
    }
    
    // Verificar desempenho em cenários específicos
    if (benchmarkResults && benchmarkResults.scenarios) {
      // Encontrar melhor e pior cenário
      let bestScenario = null;
      let worstScenario = null;
      let bestScenarioF1 = -1;
      let worstScenarioF1 = 101;
      
      Object.entries(benchmarkResults.scenarios).forEach(([scenario, result]) => {
        const f1 = result.metrics.f1Score;
        
        if (f1 > bestScenarioF1) {
          bestScenarioF1 = f1;
          bestScenario = scenario;
        }
        
        if (f1 < worstScenarioF1) {
          worstScenarioF1 = f1;
          worstScenario = scenario;
        }
      });
      
      if (bestScenario && bestScenarioF1 > 70) {
        strengths.push(`Bom desempenho em cenário "${bestScenario}" (F1: ${bestScenarioF1.toFixed(1)}%)`);
      }
      
      if (worstScenario && worstScenarioF1 < 60) {
        weaknesses.push(`Desempenho fraco em cenário "${worstScenario}" (F1: ${worstScenarioF1.toFixed(1)}%)`);
      }
    }
    
    return {
      overallPrecision,
      overallRecall,
      overallF1Score,
      realConsistency,
      methodPerformance,
      bestMethod,
      strengths,
      weaknesses,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Gera relatório de validação
   * @returns {Object} - Relatório completo
   */
  generateReport() {
    if (Object.keys(this.results).length === 0) {
      return { error: 'Nenhuma validação realizada ainda' };
    }
    
    return {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      details: {
        synthetic: this.results.synthetic ? {
          overallMetrics: this.results.synthetic.overall,
          testedRates: Object.keys(this.results.synthetic.byRate)
        } : null,
        real: this.results.real ? {
          overallConsistency: this.results.real.overall.averageConsistency,
          testedTickers: Object.keys(this.results.real.byTicker)
        } : null,
        benchmark: this.results.benchmark ? {
          overallMetrics: this.results.benchmark.overall,
          testedScenarios: Object.keys(this.results.benchmark.scenarios)
        } : null
      },
      recommendations: this.generateRecommendations()
    };
  }
  
  /**
   * Gera recomendações com base nos resultados
   * @returns {Array} - Lista de recomendações
   */
  generateRecommendations() {
    if (!this.results.summary) return [];
    
    const recommendations = [];
    
    // Verificar precisão e recall
    if (this.results.summary.overallPrecision < 70) {
      recommendations.push('Ajustar parâmetros para melhorar a precisão da detecção de anomalias');
    }
    
    if (this.results.summary.overallRecall < 70) {
      recommendations.push('Ajustar parâmetros para melhorar o recall da detecção de anomalias');
    }
    
    // Verificar consistência
    if (this.results.summary.realConsistency < 70) {
      recommendations.push('Melhorar a consistência da detecção em dados reais');
    }
    
    // Verificar pontos fracos
    if (this.results.summary.weaknesses.length > 0) {
      this.results.summary.weaknesses.forEach(weakness => {
        if (weakness.includes('cenário')) {
          const scenarioMatch = weakness.match(/cenário "([^"]+)"/);
          if (scenarioMatch) {
            const scenario = scenarioMatch[1];
            recommendations.push(`Melhorar a detecção no cenário "${scenario}" com ajustes específicos`);
          }
        }
      });
    }
    
    // Recomendações baseadas no melhor método
    if (this.results.summary.bestMethod) {
      recommendations.push(`Priorizar o método ${this.results.summary.bestMethod} na configuração de ensemble`);
    }
    
    // Recomendações gerais
    recommendations.push('Implementar validação contínua com novos dados para manter a qualidade da detecção');
    
    return recommendations;
  }
  
  /**
   * Salva relatório em formato JSON
   * @param {String} filePath - Caminho do arquivo
   * @returns {Boolean} - Sucesso da operação
   */
  saveReport(filePath) {
    try {
      const report = this.generateReport();
      const fs = require('fs');
      fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
      return true;
    } catch (error) {
      console.error('Erro ao salvar relatório:', error);
      return false;
    }
  }
}

// src/__tests__/models/anomalyDetectorTest.js
import { AnomalyDetector } from '../../models/anomalyDetector';
import { AnomalyDetectorValidator } from '../../validation/anomalyDetectorValidator';

/**
 * Testes automatizados para o detector de anomalias em dividendos
 * 
 * Este arquivo contém testes unitários e de integração para validar
 * o comportamento e a precisão do detector de anomalias em dividendos de FIIs.
 */

// Mock de dados de dividendos para testes
const mockDividendData = [
  { date: '2024-01-15', value: 0.70, price: 100.0, yield: 0.70 },
  { date: '2024-02-15', value: 0.72, price: 102.0, yield: 0.71 },
  { date: '2024-03-15', value: 0.71, price: 103.0, yield: 0.69 },
  { date: '2024-04-15', value: 0.73, price: 101.0, yield: 0.72 },
  { date: '2024-05-15', value: 0.75, price: 104.0, yield: 0.72 },
  { date: '2024-06-15', value: 0.74, price: 105.0, yield: 0.70 },
  { date: '2024-07-15', value: 0.76, price: 106.0, yield: 0.72 },
  { date: '2024-08-15', value: 0.75, price: 107.0, yield: 0.70 },
  { date: '2024-09-15', value: 0.77, price: 108.0, yield: 0.71 },
  { date: '2024-10-15', value: 0.78, price: 109.0, yield: 0.72 },
  { date: '2024-11-15', value: 0.76, price: 110.0, yield: 0.69 },
  { date: '2024-12-15', value: 1.20, price: 112.0, yield: 1.07 }, // Anomalia (dezembro com valor muito alto)
  { date: '2025-01-15', value: 0.79, price: 113.0, yield: 0.70 },
  { date: '2025-02-15', value: 0.80, price: 114.0, yield: 0.70 },
  { date: '2025-03-15', value: 0.40, price: 115.0, yield: 0.35 }, // Anomalia (valor muito baixo)
  { date: '2025-04-15', value: 0.81, price: 116.0, yield: 0.70 },
  { date: '2025-05-15', value: 0.82, price: 117.0, yield: 0.70 },
  { date: '2025-06-15', value: 0.83, price: 118.0, yield: 0.70 },
];

// Índices conhecidos de anomalias no conjunto de dados
const knownAnomalyIndices = [11, 14]; // Índices das anomalias no array acima

describe('AnomalyDetector - Modelo Básico', () => {
  let detector;

  beforeEach(async () => {
    // Inicializar o detector antes de cada teste
    detector = new AnomalyDetector({
      zScoreThreshold: 2.5,
      iqrMultiplier: 1.5,
      useCache: false
    });
    
    await detector.initialize();
  });

  test('deve inicializar corretamente', () => {
    expect(detector).toBeDefined();
    expect(detector.initialized).toBe(true);
    expect(detector.config.zScoreThreshold).toBe(2.5);
    expect(detector.config.iqrMultiplier).toBe(1.5);
  });

  test('deve detectar anomalias em dados de dividendos', async () => {
    const results = await detector.detectDividendAnomalies(mockDividendData);
    
    expect(results).toBeDefined();
    expect(results).toHaveProperty('anomalies');
    expect(results).toHaveProperty('stats');
    expect(results).toHaveProperty('methods');
    
    // Verificar que as anomalias foram detectadas
    expect(results.anomalies.length).toBeGreaterThan(0);
    
    // Verificar estatísticas
    expect(results.stats).toHaveProperty('count');
    expect(results.stats).toHaveProperty('percentage');
    expect(results.stats.count).toBe(results.anomalies.length);
    expect(results.stats.percentage).toBe((results.anomalies.length / mockDividendData.length) * 100);
  });

  test('deve detectar anomalias conhecidas', async () => {
    const results = await detector.detectDividendAnomalies(mockDividendData);
    
    // Extrair datas das anomalias detectadas
    const detectedDates = results.anomalies.map(anomaly => anomaly.date);
    
    // Verificar que as anomalias conhecidas foram detectadas
    expect(detectedDates).toContain(mockDividendData[knownAnomalyIndices[0]].date);
    expect(detectedDates).toContain(mockDividendData[knownAnomalyIndices[1]].date);
  });

  test('deve classificar anomalias por severidade', async () => {
    const results = await detector.detectDividendAnomalies(mockDividendData);
    
    // Verificar que cada anomalia tem severidade
    results.anomalies.forEach(anomaly => {
      expect(anomaly).toHaveProperty('severity');
      expect(['high', 'medium', 'low']).toContain(anomaly.severity);
    });
    
    // Verificar que a anomalia de dezembro (valor muito alto) tem severidade alta
    const decemberAnomaly = results.anomalies.find(a => a.date === mockDividendData[knownAnomalyIndices[0]].date);
    expect(decemberAnomaly).toBeDefined();
    expect(decemberAnomaly.severity).toBe('high');
  });

  test('deve identificar o tipo de anomalia', async () => {
    const results = await detector.detectDividendAnomalies(mockDividendData);
    
    // Verificar que cada anomalia tem tipo
    results.anomalies.forEach(anomaly => {
      expect(anomaly).toHaveProperty('type');
      expect(['high_value', 'low_value']).toContain(anomaly.type);
    });
    
    // Verificar tipos específicos
    const decemberAnomaly = results.anomalies.find(a => a.date === mockDividendData[knownAnomalyIndices[0]].date);
    const marchAnomaly = results.anomalies.find(a => a.date === mockDividendData[knownAnomalyIndices[1]].date);
    
    expect(decemberAnomaly.type).toBe('high_value');
    expect(marchAnomaly.type).toBe('low_value');
  });

  test('deve calcular desvio percentual da média', async () => {
    const results = await detector.detectDividendAnomalies(mockDividendData);
    
    // Verificar que cada anomalia tem desvio
    results.anomalies.forEach(anomaly => {
      expect(anomaly).toHaveProperty('deviation');
      expect(typeof anomaly.deviation).toBe('number');
    });
    
    // Calcular média manualmente para verificação
    const values = mockDividendData.map(item => item.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Verificar desvio da anomalia de dezembro
    const decemberAnomaly = results.anomalies.find(a => a.date === mockDividendData[knownAnomalyIndices[0]].date);
    const expectedDeviation = ((mockDividendData[knownAnomalyIndices[0]].value - mean) / mean) * 100;
    
    expect(decemberAnomaly.deviation).toBeCloseTo(expectedDeviation, 1);
  });

  test('deve registrar métodos que detectaram cada anomalia', async () => {
    const results = await detector.detectDividendAnomalies(mockDividendData);
    
    // Verificar que cada anomalia tem lista de métodos
    results.anomalies.forEach(anomaly => {
      expect(anomaly).toHaveProperty('detectedBy');
      expect(Array.isArray(anomaly.detectedBy)).toBe(true);
      expect(anomaly.detectedBy.length).toBeGreaterThan(0);
    });
  });
});

describe('AnomalyDetector - Métodos de Detecção', () => {
  let detector;

  beforeEach(async () => {
    detector = new AnomalyDetector({
      useCache: false
    });
    
    await detector.initialize();
  });

  test('deve detectar anomalias com Z-score', () => {
    const values = mockDividendData.map(item => item.value);
    const results = detector.detectAnomaliesWithZScore(values);
    
    expect(results).toBeDefined();
    expect(results).toHaveProperty('anomalyIndices');
    expect(results).toHaveProperty('anomalyScores');
    expect(results).toHaveProperty('threshold');
    
    // Verificar que as anomalias conhecidas foram detectadas
    expect(results.anomalyIndices).toContain(knownAnomalyIndices[0]);
    expect(results.anomalyIndices).toContain(knownAnomalyIndices[1]);
  });

  test('deve detectar anomalias com IQR', () => {
    const values = mockDividendData.map(item => item.value);
    const results = detector.detectAnomaliesWithIQR(values);
    
    expect(results).toBeDefined();
    expect(results).toHaveProperty('anomalyIndices');
    expect(results).toHaveProperty('anomalyScores');
    expect(results).toHaveProperty('threshold');
    
    // Verificar que as anomalias conhecidas foram detectadas
    expect(results.anomalyIndices).toContain(knownAnomalyIndices[0]);
    expect(results.anomalyIndices).toContain(knownAnomalyIndices[1]);
  });

  test('deve detectar anomalias com Isolation Forest', async () => {
    const features = mockDividendData.map(item => [item.value, item.yield]);
    const results = await detector.detectAnomaliesWithIsolationForest(features);
    
    expect(results).toBeDefined();
    expect(results).toHaveProperty('anomalyIndices');
    expect(results).toHaveProperty('anomalyScores');
    expect(results).toHaveProperty('threshold');
    
    // Verificar que pelo menos uma das anomalias conhecidas foi detectada
    // (Isolation Forest pode ser mais seletivo)
    const detectedKnownAnomalies = results.anomalyIndices.filter(
      index => knownAnomalyIndices.includes(index)
    );
    expect(detectedKnownAnomalies.length).toBeGreaterThan(0);
  });

  test('deve detectar anomalias com Autoencoder quando configurado', async () => {
    // Criar detector com autoencoder ativado
    const detectorWithAutoencoder = new AnomalyDetector({
      useAutoencoder: true,
      useCache: false,
      epochs: 10, // Reduzir épocas para teste mais rápido
    });
    
    await detectorWithAutoencoder.initialize();
    
    const features = detector.engineerFeatures(mockDividendData);
    
    // Primeiro, criar e treinar o autoencoder
    await detectorWithAutoencoder.createAndTrainAutoencoder(features);
    
    // Depois, detectar anomalias
    const results = await detectorWithAutoencoder.detectAnomaliesWithAutoencoder(features);
    
    expect(results).toBeDefined();
    expect(results).toHaveProperty('anomalyIndices');
    expect(results).toHaveProperty('anomalyScores');
    expect(results).toHaveProperty('threshold');
  });

  test('deve combinar detecções de múltiplos métodos', () => {
    // Simular resultados de diferentes métodos
    const methods = {
      zScore: {
        anomalyIndices: [11, 14],
        anomalyScores: { 11: 0.9, 14: 0.8 }
      },
      iqr: {
        anomalyIndices: [11, 14, 5],
        anomalyScores: { 11: 0.85, 14: 0.75, 5: 0.6 }
      },
      isolationForest: {
        anomalyIndices: [11, 2],
        anomalyScores: { 11: 0.95, 2: 0.65 }
      }
    };
    
    // Testar método de ensemble "majority"
    detector.config.ensembleMethod = 'majority';
    let combinedIndices = detector.combineAnomalyDetections(methods);
    
    // Apenas índices detectados pela maioria dos métodos (11)
    expect(combinedIndices).toContain(11);
    expect(combinedIndices).not.toContain(5);
    expect(combinedIndices).not.toContain(2);
    
    // Testar método de ensemble "any"
    detector.config.ensembleMethod = 'any';
    combinedIndices = detector.combineAnomalyDetections(methods);
    
    // Todos os índices detectados por qualquer método
    expect(combinedIndices).toContain(11);
    expect(combinedIndices).toContain(14);
    expect(combinedIndices).toContain(5);
    expect(combinedIndices).toContain(2);
  });
});

describe('AnomalyDetector - Engenharia de Features', () => {
  let detector;

  beforeEach(async () => {
    detector = new AnomalyDetector({
      useCache: false
    });
    
    await detector.initialize();
  });

  test('deve extrair features relevantes dos dados', () => {
    const features = detector.engineerFeatures(mockDividendData);
    
    expect(features).toBeDefined();
    expect(Array.isArray(features)).toBe(true);
    expect(features.length).toBe(mockDividendData.length);
    
    // Verificar dimensionalidade das features
    expect(features[0].length).toBeGreaterThan(1);
  });

  test('deve normalizar features corretamente', () => {
    const rawFeatures = [
      [100, 0.5, 10],
      [200, 0.7, 20],
      [150, 0.6, 15]
    ];
    
    const normalized = detector.normalizeFeatures(rawFeatures);
    
    expect(normalized).toBeDefined();
    expect(normalized.length).toBe(rawFeatures.length);
    
    // Verificar que valores estão entre 0 e 1
    normalized.forEach(row => {
      row.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });
    
    // Verificar que a normalização preserva a ordem relativa
    expect(normalized[0][0]).toBeLessThan(normalized[1][0]); // 100 < 200
    expect(normalized[0][1]).toBeLessThan(normalized[1][1]); // 0.5 < 0.7
  });

  test('deve transpor matriz corretamente', () => {
    const matrix = [
      [1, 2, 3],
      [4, 5, 6]
    ];
    
    const transposed = detector.transposeMatrix(matrix);
    
    expect(transposed).toEqual([
      [1, 4],
      [2, 5],
      [3, 6]
    ]);
  });
});

describe('AnomalyDetectorValidator - Validação do Modelo', () => {
  let validator;
  let detector;

  beforeEach(async () => {
    detector = new AnomalyDetector({
      useCache: false
    });
    
    validator = new AnomalyDetectorValidator({
      detectorConfig: {
        useCache: false
      },
      testTickers: ['KNRI11']
    });
    
    await validator.initialize();
  });

  test('deve validar o detector com dados sintéticos', async () => {
    const results = await validator.validateWithSyntheticData();
    
    expect(results).toBeDefined();
    expect(results).toHaveProperty('byRate');
    expect(results).toHaveProperty('overall');
    expect(results.overall).toHaveProperty('precision');
    expect(results.overall).toHaveProperty('recall');
    expect(results.overall).toHaveProperty('f1Score');
    
    // Verificar que a precisão está em um intervalo razoável
    expect(results.overall.precision).toBeGreaterThan(50);
  });

  test('deve validar o detector com dados de benchmark', async () => {
    const results = await validator.validateWithBenchmarkData();
    
    expect(results).toBeDefined();
    expect(results).toHaveProperty('scenarios');
    expect(results).toHaveProperty('overall');
    
    // Verificar que todos os cenários foram processados
    expect(Object.keys(results.scenarios).length).toBeGreaterThan(0);
    
    // Verificar métricas gerais
    expect(results.overall).toHaveProperty('precision');
    expect(results.overall).toHaveProperty('recall');
    expect(results.overall).toHaveProperty('f1Score');
  });

  test('deve gerar dados sintéticos de dividendos com anomalias conhecidas', () => {
    const { data, anomalyIndices } = validator.generateSyntheticDividendData(100, 0.05);
    
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(100);
    
    expect(anomalyIndices).toBeDefined();
    expect(Array.isArray(anomalyIndices)).toBe(true);
    
    // Verificar que o número de anomalias está próximo da taxa especificada
    expect(anomalyIndices.length).toBeCloseTo(100 * 0.05, 1);
  });

  test('deve gerar cenários de benchmark realistas', () => {
    const benchmarkData = validator.generateBenchmarkData();
    
    expect(benchmarkData).toBeDefined();
    expect(Object.keys(benchmarkData).length).toBeGreaterThan(0);
    
    // Verificar estrutura de um cenário
    const firstScenario = Object.values(benchmarkData)[0];
    expect(firstScenario).toHaveProperty('name');
    expect(firstScenario).toHaveProperty('dividendData');
    expect(firstScenario).toHaveProperty('anomalyIndices');
    expect(Array.isArray(firstScenario.dividendData)).toBe(true);
    expect(Array.isArray(firstScenario.anomalyIndices)).toBe(true);
  });

  test('deve calcular métricas de detecção corretamente', () => {
    // Cenário de teste
    const actualIndices = [1, 5, 10];
    const detectedIndices = [1, 5, 15];
    const totalCount = 20;
    
    const metrics = validator.calculateDetectionMetrics(actualIndices, detectedIndices, totalCount);
    
    expect(metrics).toBeDefined();
    expect(metrics).toHaveProperty('precision');
    expect(metrics).toHaveProperty('recall');
    expect(metrics).toHaveProperty('f1Score');
    expect(metrics).toHaveProperty('accuracy');
    
    // Verificar cálculos
    // Precision = TP / (TP + FP) = 2 / 3 = 0.67
    expect(metrics.precision).toBeCloseTo(66.67, 1);
    
    // Recall = TP / (TP + FN) = 2 / 3 = 0.67
    expect(metrics.recall).toBeCloseTo(66.67, 1);
    
    // F1 = 2 * (precision * recall) / (precision + recall) = 2 * (0.67 * 0.67) / (0.67 + 0.67) = 0.67
    expect(metrics.f1Score).toBeCloseTo(66.67, 1);
  });

  test('deve avaliar consistência em dados reais', () => {
    const detectionResults = {
      anomalies: [
        { 
          date: '2024-12-15', 
          value: 1.20, 
          anomalyScore: 0.9, 
          severity: 'high', 
          type: 'high_value',
          deviation: 50,
          detectedBy: ['zScore', 'iqr']
        },
        { 
          date: '2025-03-15', 
          value: 0.40, 
          anomalyScore: 0.8, 
          severity: 'high', 
          type: 'low_value',
          deviation: -45,
          detectedBy: ['zScore', 'iqr', 'isolationForest']
        }
      ],
      stats: { count: 2, percentage: 11.11 },
      methods: {
        zScore: { anomalyCount: 2 },
        iqr: { anomalyCount: 2 },
        isolationForest: { anomalyCount: 1 }
      }
    };
    
    const consistency = validator.evaluateConsistency(detectionResults, mockDividendData);
    
    expect(consistency).toBeDefined();
    expect(consistency).toHaveProperty('overlapWithTopOutliers');
    expect(consistency).toHaveProperty('averageZScoreOfDetected');
    expect(consistency).toHaveProperty('severityConsistency');
    expect(consistency).toHaveProperty('overallConsistency');
    
    // Verificar que a consistência geral está em um intervalo razoável
    expect(consistency.overallConsistency).toBeGreaterThan(0);
    expect(consistency.overallConsistency).toBeLessThanOrEqual(100);
  });

  test('deve gerar relatório de validação completo', async () => {
    // Executar validação primeiro
    await validator.validateDetector();
    
    const report = validator.generateReport();
    
    expect(report).toBeDefined();
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('details');
    expect(report).toHaveProperty('recommendations');
    
    // Verificar que o relatório contém métricas de performance
    expect(report.summary).toHaveProperty('overallPrecision');
    expect(report.summary).toHaveProperty('overallRecall');
    
    // Verificar que há recomendações
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});

// Testes de integração
describe('Integração entre Detector e Validator', () => {
  test('deve validar detecções em pipeline completo', async () => {
    const detector = new AnomalyDetector({
      useCache: false
    });
    
    const validator = new AnomalyDetectorValidator({
      detectorConfig: {
        useCache: false
      }
    });
    
    await detector.initialize();
    
    // Gerar detecção
    const detectionResults = await detector.detectDividendAnomalies(mockDividendData);
    
    // Extrair índices detectados
    const detectedIndices = detectionResults.anomalies.map(
      anomaly => mockDividendData.findIndex(d => d.date === anomaly.date)
    );
    
    // Validar a detecção contra anomalias conhecidas
    const metrics = validator.calculateDetectionMetrics(
      knownAnomalyIndices,
      detectedIndices,
      mockDividendData.length
    );
    
    expect(metrics).toBeDefined();
    expect(metrics).toHaveProperty('precision');
    expect(metrics).toHaveProperty('recall');
    expect(metrics).toHaveProperty('f1Score');
    
    // Verificar que pelo menos uma das anomalias conhecidas foi detectada
    expect(metrics.truePositives).toBeGreaterThan(0);
  });
});

// Testes de robustez
describe('Robustez do Detector de Anomalias', () => {
  let detector;

  beforeEach(async () => {
    detector = new AnomalyDetector({
      useCache: false
    });
    
    await detector.initialize();
  });

  test('deve lidar com dados contendo valores ausentes', async () => {
    // Dados com valores ausentes
    const dataWithMissing = [...mockDividendData];
    dataWithMissing[5].value = null; // Valor ausente
    
    const results = await detector.detectDividendAnomalies(dataWithMissing);
    
    expect(results).toBeDefined();
    expect(results.anomalies.length).toBeGreaterThan(0);
  });

  test('deve lidar com conjuntos de dados pequenos', async () => {
    // Conjunto pequeno de dados
    const smallData = mockDividendData.slice(0, 6);
    
    const results = await detector.detectDividendAnomalies(smallData);
    
    expect(results).toBeDefined();
    expect(results).toHaveProperty('anomalies');
  });

  test('deve lidar com dados sazonais', async () => {
    // Dados com padrão sazonal
    const seasonalData = [];
    for (let i = 0; i < 24; i++) {
      const month = i % 12 + 1;
      const year = 2024 + Math.floor(i / 12);
      const date = `${year}-${month.toString().padStart(2, '0')}-15`;
      
      // Valor base + componente sazonal (maior em dezembro)
      let value = 0.7 + (month === 12 ? 0.3 : 0);
      
      // Adicionar ruído
      value += (Math.random() * 0.1) - 0.05;
      
      seasonalData.push({
        date,
        value,
        price: 100 + i,
        yield: value / (100 + i) * 100
      });
    }
    
    // Adicionar uma anomalia real (não sazonal)
    seasonalData[5].value = 1.5; // Anomalia em junho do primeiro ano
    
    const results = await detector.detectDividendAnomalies(seasonalData);
    
    expect(results).toBeDefined();
    expect(results.anomalies.length).toBeGreaterThan(0);
    
    // Verificar que a anomalia real foi detectada
    const anomalyDates = results.anomalies.map(a => a.date);
    expect(anomalyDates).toContain(seasonalData[5].date);
    
    // Verificar que os valores sazonais de dezembro não são todos detectados como anomalias
    const decemberDates = seasonalData
      .filter((d, i) => i % 12 === 11) // Dezembro é o mês 12, índice 11
      .map(d => d.date);
    
    // Pelo menos um dezembro não deve ser considerado anomalia
    expect(decemberDates.some(date => !anomalyDates.includes(date))).toBe(true);
  });
});

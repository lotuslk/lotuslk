// src/__tests__/models/priceForecasterTest.js
import { PriceForecaster } from '../../models/priceForecaster';
import { PriceForecasterEnhanced } from '../../models/priceForecasterEnhanced';
import { PriceForecasterValidator } from '../../validation/priceForecasterValidator';

/**
 * Testes automatizados para o modelo de previsão de preços
 * 
 * Este arquivo contém testes unitários e de integração para validar
 * o comportamento e a precisão dos modelos de previsão de preços.
 */

// Mock de dados para testes
const mockHistoricalData = [
  { date: '2024-01-01', price: 100.0, volume: 10000 },
  { date: '2024-01-02', price: 101.5, volume: 12000 },
  { date: '2024-01-03', price: 102.2, volume: 11500 },
  { date: '2024-01-04', price: 101.8, volume: 9800 },
  { date: '2024-01-05', price: 103.0, volume: 13200 },
  { date: '2024-01-08', price: 104.5, volume: 15000 },
  { date: '2024-01-09', price: 105.2, volume: 14200 },
  { date: '2024-01-10', price: 104.8, volume: 10500 },
  { date: '2024-01-11', price: 106.0, volume: 12800 },
  { date: '2024-01-12', price: 107.5, volume: 14500 },
  { date: '2024-01-15', price: 108.2, volume: 13800 },
  { date: '2024-01-16', price: 107.8, volume: 11200 },
  { date: '2024-01-17', price: 109.0, volume: 12500 },
  { date: '2024-01-18', price: 110.5, volume: 15800 },
  { date: '2024-01-19', price: 111.2, volume: 14000 },
  { date: '2024-01-22', price: 110.8, volume: 12200 },
  { date: '2024-01-23', price: 112.0, volume: 13500 },
  { date: '2024-01-24', price: 113.5, volume: 16000 },
  { date: '2024-01-25', price: 114.2, volume: 15200 },
  { date: '2024-01-26', price: 113.8, volume: 13800 },
  { date: '2024-01-29', price: 115.0, volume: 14500 },
  { date: '2024-01-30', price: 116.5, volume: 17000 },
];

// Dados para validação (não usados no treinamento)
const mockValidationData = [
  { date: '2024-01-31', price: 117.2, volume: 16200 },
  { date: '2024-02-01', price: 116.8, volume: 14800 },
  { date: '2024-02-02', price: 118.0, volume: 15500 },
  { date: '2024-02-05', price: 119.5, volume: 18000 },
  { date: '2024-02-06', price: 120.2, volume: 17200 },
];

describe('PriceForecaster - Modelo Básico', () => {
  let forecaster;

  beforeEach(() => {
    // Inicializar o forecaster antes de cada teste
    forecaster = new PriceForecaster({
      historySize: 10,
      predictionHorizon: 5,
      useCache: false
    });
  });

  test('deve inicializar corretamente', () => {
    expect(forecaster).toBeDefined();
    expect(forecaster.config.historySize).toBe(10);
    expect(forecaster.config.predictionHorizon).toBe(5);
  });

  test('deve gerar previsões com formato correto', async () => {
    const forecast = await forecaster.forecast('KNRI11', mockHistoricalData);
    
    expect(forecast).toBeDefined();
    expect(forecast.ticker).toBe('KNRI11');
    expect(forecast.predictions).toBeDefined();
    expect(Array.isArray(forecast.predictions)).toBe(true);
    expect(forecast.predictions.length).toBe(5); // predictionHorizon
    
    // Verificar estrutura das previsões
    const firstPrediction = forecast.predictions[0];
    expect(firstPrediction).toHaveProperty('date');
    expect(firstPrediction).toHaveProperty('price');
    expect(typeof firstPrediction.price).toBe('number');
  });

  test('deve gerar previsões com tendência identificada', async () => {
    const forecast = await forecaster.forecast('KNRI11', mockHistoricalData);
    
    expect(forecast).toHaveProperty('trend');
    expect(['up', 'down', 'stable', 'strong_up', 'strong_down']).toContain(forecast.trend);
  });

  test('deve calcular métricas de erro quando dados de validação são fornecidos', async () => {
    const forecast = await forecaster.forecast('KNRI11', mockHistoricalData, mockValidationData);
    
    expect(forecast).toHaveProperty('metrics');
    expect(forecast.metrics).toHaveProperty('rmse');
    expect(forecast.metrics).toHaveProperty('mape');
    expect(typeof forecast.metrics.rmse).toBe('number');
    expect(typeof forecast.metrics.mape).toBe('number');
  });

  test('deve lidar com dados históricos insuficientes', async () => {
    const insufficientData = mockHistoricalData.slice(0, 3); // Apenas 3 pontos
    
    await expect(forecaster.forecast('KNRI11', insufficientData))
      .rejects.toThrow('Dados históricos insuficientes');
  });

  test('deve usar cache quando configurado', async () => {
    // Criar forecaster com cache ativado
    const forecasterWithCache = new PriceForecaster({
      historySize: 10,
      predictionHorizon: 5,
      useCache: true
    });
    
    // Primeira chamada deve calcular
    const forecast1 = await forecasterWithCache.forecast('KNRI11', mockHistoricalData);
    
    // Espionar o método interno de previsão
    const spyOnInternalForecast = jest.spyOn(forecasterWithCache, '_generateForecast');
    
    // Segunda chamada deve usar cache
    const forecast2 = await forecasterWithCache.forecast('KNRI11', mockHistoricalData);
    
    expect(spyOnInternalForecast).not.toHaveBeenCalled();
    expect(forecast2).toEqual(forecast1);
    
    // Restaurar o spy
    spyOnInternalForecast.mockRestore();
  });
});

describe('PriceForecasterEnhanced - Modelo Avançado', () => {
  let enhancedForecaster;

  beforeEach(() => {
    // Inicializar o forecaster avançado antes de cada teste
    enhancedForecaster = new PriceForecasterEnhanced({
      historySize: 15,
      predictionHorizon: 5,
      useCache: false,
      confidenceInterval: true
    });
  });

  test('deve inicializar corretamente com configurações avançadas', () => {
    expect(enhancedForecaster).toBeDefined();
    expect(enhancedForecaster.config.historySize).toBe(15);
    expect(enhancedForecaster.config.confidenceInterval).toBe(true);
  });

  test('deve gerar previsões com intervalos de confiança', async () => {
    const forecast = await enhancedForecaster.forecast('KNRI11', mockHistoricalData);
    
    expect(forecast).toHaveProperty('lowerBounds');
    expect(forecast).toHaveProperty('upperBounds');
    expect(Array.isArray(forecast.lowerBounds)).toBe(true);
    expect(Array.isArray(forecast.upperBounds)).toBe(true);
    expect(forecast.lowerBounds.length).toBe(forecast.predictions.length);
    expect(forecast.upperBounds.length).toBe(forecast.predictions.length);
    
    // Verificar que limites inferiores são menores que previsões
    forecast.predictions.forEach((pred, i) => {
      expect(forecast.lowerBounds[i]).toBeLessThan(pred.price);
      expect(forecast.upperBounds[i]).toBeGreaterThan(pred.price);
    });
  });

  test('deve incluir features avançadas nas previsões', async () => {
    const forecast = await enhancedForecaster.forecast('KNRI11', mockHistoricalData);
    
    expect(forecast).toHaveProperty('features');
    expect(forecast.features).toHaveProperty('technicalIndicators');
    expect(forecast.features).toHaveProperty('seasonality');
  });

  test('deve calcular métricas avançadas de performance', async () => {
    const forecast = await enhancedForecaster.forecast('KNRI11', mockHistoricalData, mockValidationData);
    
    expect(forecast.metrics).toHaveProperty('rmse');
    expect(forecast.metrics).toHaveProperty('mape');
    expect(forecast.metrics).toHaveProperty('directionAccuracy');
    expect(forecast.metrics).toHaveProperty('confidence');
    
    expect(typeof forecast.metrics.directionAccuracy).toBe('number');
    expect(['high', 'medium', 'low']).toContain(forecast.metrics.confidence);
  });

  test('deve lidar com diferentes horizontes de previsão', async () => {
    // Criar forecaster com horizonte maior
    const longHorizonForecaster = new PriceForecasterEnhanced({
      historySize: 15,
      predictionHorizon: 10,
      useCache: false
    });
    
    const forecast = await longHorizonForecaster.forecast('KNRI11', mockHistoricalData);
    
    expect(forecast.predictions.length).toBe(10);
  });

  test('deve incorporar dados macroeconômicos quando disponíveis', async () => {
    // Mock de dados macroeconômicos
    const macroData = [
      { date: '2024-01-15', selic: 10.75, ipca: 4.2 },
      { date: '2024-01-22', selic: 10.75, ipca: 4.1 },
      { date: '2024-01-29', selic: 10.75, ipca: 4.0 }
    ];
    
    const forecast = await enhancedForecaster.forecast('KNRI11', mockHistoricalData, null, macroData);
    
    expect(forecast).toHaveProperty('externalFactors');
    expect(forecast.externalFactors).toHaveProperty('macroeconomic');
  });
});

describe('PriceForecasterValidator - Validação do Modelo', () => {
  let validator;
  let forecaster;

  beforeEach(() => {
    forecaster = new PriceForecasterEnhanced({
      historySize: 15,
      predictionHorizon: 5
    });
    
    validator = new PriceForecasterValidator({
      forecaster,
      validationPeriods: 3,
      benchmarks: ['naive', 'moving_average']
    });
  });

  test('deve validar o modelo com dados históricos', async () => {
    const validationResults = await validator.validateWithHistoricalData('KNRI11', mockHistoricalData);
    
    expect(validationResults).toBeDefined();
    expect(validationResults).toHaveProperty('metrics');
    expect(validationResults).toHaveProperty('benchmarkComparison');
    expect(validationResults.metrics).toHaveProperty('rmse');
    expect(validationResults.metrics).toHaveProperty('mape');
  });

  test('deve comparar com modelos benchmark', async () => {
    const validationResults = await validator.validateWithHistoricalData('KNRI11', mockHistoricalData);
    
    expect(validationResults.benchmarkComparison).toHaveProperty('naive');
    expect(validationResults.benchmarkComparison).toHaveProperty('moving_average');
    expect(validationResults.benchmarkComparison.naive).toHaveProperty('relativeImprovement');
  });

  test('deve realizar validação cruzada temporal', async () => {
    const cvResults = await validator.performTimeSeriesCrossValidation('KNRI11', mockHistoricalData);
    
    expect(cvResults).toBeDefined();
    expect(cvResults).toHaveProperty('folds');
    expect(Array.isArray(cvResults.folds)).toBe(true);
    expect(cvResults).toHaveProperty('averageMetrics');
    expect(cvResults.averageMetrics).toHaveProperty('rmse');
  });

  test('deve gerar relatório de validação', async () => {
    await validator.validateWithHistoricalData('KNRI11', mockHistoricalData);
    const report = validator.generateReport();
    
    expect(report).toBeDefined();
    expect(report).toHaveProperty('modelName');
    expect(report).toHaveProperty('ticker');
    expect(report).toHaveProperty('validationResults');
    expect(report).toHaveProperty('recommendations');
  });

  test('deve identificar pontos de falha do modelo', async () => {
    // Criar dados com padrões difíceis de prever
    const volatileData = [...mockHistoricalData];
    // Adicionar um ponto extremamente volátil
    volatileData.push({ date: '2024-01-31', price: 150.0, volume: 30000 });
    
    const validationResults = await validator.validateWithHistoricalData('KNRI11', volatileData);
    
    expect(validationResults).toHaveProperty('failurePoints');
    expect(Array.isArray(validationResults.failurePoints)).toBe(true);
    expect(validationResults.failurePoints.length).toBeGreaterThan(0);
  });
});

// Testes de integração entre componentes
describe('Integração entre Forecaster e Validator', () => {
  test('deve validar previsões em pipeline completo', async () => {
    const forecaster = new PriceForecasterEnhanced({
      historySize: 15,
      predictionHorizon: 5
    });
    
    const validator = new PriceForecasterValidator({
      forecaster,
      validationPeriods: 3
    });
    
    // Gerar previsão
    const forecast = await forecaster.forecast('KNRI11', mockHistoricalData);
    
    // Validar a previsão
    const validationResult = await validator.validateForecast(forecast, mockValidationData);
    
    expect(validationResult).toBeDefined();
    expect(validationResult).toHaveProperty('isAccurate');
    expect(typeof validationResult.isAccurate).toBe('boolean');
    expect(validationResult).toHaveProperty('errorMetrics');
  });
});

// Testes de robustez e casos extremos
describe('Robustez do Modelo de Previsão', () => {
  let forecaster;

  beforeEach(() => {
    forecaster = new PriceForecasterEnhanced({
      historySize: 10,
      predictionHorizon: 5,
      useCache: false
    });
  });

  test('deve lidar com dados contendo valores ausentes', async () => {
    // Dados com valores ausentes
    const dataWithMissing = [...mockHistoricalData];
    dataWithMissing[5].price = null; // Valor ausente
    
    const forecast = await forecaster.forecast('KNRI11', dataWithMissing);
    
    expect(forecast).toBeDefined();
    expect(forecast.predictions.length).toBe(5);
    expect(forecast).toHaveProperty('dataQualityIssues');
    expect(forecast.dataQualityIssues).toHaveProperty('missingValues');
  });

  test('deve lidar com dados contendo outliers', async () => {
    // Dados com outlier
    const dataWithOutlier = [...mockHistoricalData];
    dataWithOutlier[10].price = 500.0; // Outlier extremo
    
    const forecast = await forecaster.forecast('KNRI11', dataWithOutlier);
    
    expect(forecast).toBeDefined();
    expect(forecast.predictions.length).toBe(5);
    expect(forecast).toHaveProperty('dataQualityIssues');
    expect(forecast.dataQualityIssues).toHaveProperty('outliers');
  });

  test('deve lidar com mudanças abruptas de tendência', async () => {
    // Dados com mudança abrupta de tendência
    const dataWithTrendChange = [...mockHistoricalData];
    // Adicionar tendência de queda no final
    dataWithTrendChange.push({ date: '2024-01-31', price: 110.0, volume: 15000 });
    dataWithTrendChange.push({ date: '2024-02-01', price: 105.0, volume: 16000 });
    dataWithTrendChange.push({ date: '2024-02-02', price: 100.0, volume: 17000 });
    
    const forecast = await forecaster.forecast('KNRI11', dataWithTrendChange);
    
    expect(forecast).toBeDefined();
    expect(forecast.predictions.length).toBe(5);
    expect(forecast).toHaveProperty('detectedPatterns');
    expect(forecast.detectedPatterns).toHaveProperty('trendChanges');
  });
});

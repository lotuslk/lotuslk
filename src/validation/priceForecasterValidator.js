// src/validation/priceForecasterValidator.js
import { DataCollector } from '../services/dataCollector';
import { PriceForecaster } from '../models/priceForecaster';
import { PriceForecasterEnhanced } from '../models/priceForecasterEnhanced';

/**
 * Classe para validação dos modelos de previsão de preços
 * 
 * Esta classe implementa métodos para validar os modelos de previsão
 * usando dados reais, comparando diferentes configurações e gerando
 * relatórios de performance.
 */
export class PriceForecasterValidator {
  constructor(config = {}) {
    this.config = {
      testSplit: config.testSplit || 0.2, // 20% dos dados para teste
      validationSplit: config.validationSplit || 0.2, // 20% dos dados para validação
      benchmarkModels: config.benchmarkModels || ['naive', 'sma', 'ema'], // Modelos de benchmark
      ...config
    };
    
    this.dataCollector = new DataCollector(config.collectorConfig);
    this.results = {};
  }
  
  /**
   * Valida o modelo com dados reais de um FII específico
   * @param {String} ticker - Código do FII
   * @param {Object} options - Opções de validação
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateWithRealData(ticker, options = {}) {
    try {
      console.log(`Iniciando validação para ${ticker}...`);
      
      // Obter dados históricos
      const startDate = options.startDate || this.getDateYearsAgo(2); // 2 anos de dados
      const endDate = options.endDate || new Date().toISOString().split('T')[0];
      
      console.log(`Coletando dados de ${startDate} até ${endDate}`);
      
      const historicalData = await this.dataCollector.getHistoricalPrices(ticker, startDate, endDate);
      
      if (!historicalData || historicalData.length < 100) {
        throw new Error(`Dados insuficientes para ${ticker}. Mínimo de 100 pontos necessários.`);
      }
      
      console.log(`Coletados ${historicalData.length} pontos de dados para ${ticker}`);
      
      // Extrair preços
      const prices = historicalData.map(item => item.price);
      
      // Dividir dados em treino, validação e teste
      const splitIndices = this.splitData(prices.length);
      
      const trainPrices = prices.slice(0, splitIndices.validationStart);
      const validationPrices = prices.slice(splitIndices.validationStart, splitIndices.testStart);
      const testPrices = prices.slice(splitIndices.testStart);
      
      console.log(`Divisão de dados: Treino=${trainPrices.length}, Validação=${validationPrices.length}, Teste=${testPrices.length}`);
      
      // Validar modelo original
      const originalResults = await this.validateOriginalModel(trainPrices, validationPrices, testPrices);
      
      // Validar modelo aprimorado
      const enhancedResults = await this.validateEnhancedModel(
        trainPrices, 
        validationPrices, 
        testPrices,
        historicalData
      );
      
      // Validar modelos de benchmark
      const benchmarkResults = await this.validateBenchmarks(trainPrices, testPrices);
      
      // Comparar resultados
      const comparison = this.compareResults(originalResults, enhancedResults, benchmarkResults);
      
      // Armazenar resultados
      this.results[ticker] = {
        ticker,
        dataPoints: prices.length,
        period: { startDate, endDate },
        originalResults,
        enhancedResults,
        benchmarkResults,
        comparison
      };
      
      console.log(`Validação concluída para ${ticker}`);
      console.log(`Melhor modelo: ${comparison.bestModel} (RMSE: ${comparison.bestRMSE.toFixed(4)})`);
      
      return this.results[ticker];
    } catch (error) {
      console.error(`Erro na validação para ${ticker}:`, error);
      throw error;
    }
  }
  
  /**
   * Valida o modelo original (PriceForecaster)
   * @param {Array} trainPrices - Preços para treinamento
   * @param {Array} validationPrices - Preços para validação
   * @param {Array} testPrices - Preços para teste
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateOriginalModel(trainPrices, validationPrices, testPrices) {
    console.log('Validando modelo original (PriceForecaster)...');
    
    // Configurações a testar
    const configs = [
      { windowSize: 20, horizonDays: 30, epochs: 100 },
      { windowSize: 30, horizonDays: 30, epochs: 100 },
      { windowSize: 60, horizonDays: 30, epochs: 100 }
    ];
    
    let bestConfig = null;
    let bestModel = null;
    let bestValidationRMSE = Infinity;
    let bestTestResults = null;
    
    // Testar cada configuração
    for (const config of configs) {
      console.log(`Testando configuração: windowSize=${config.windowSize}, horizonDays=${config.horizonDays}`);
      
      const model = new PriceForecaster(config);
      
      // Treinar com dados de treino
      await model.train(trainPrices);
      
      // Avaliar com dados de validação
      const validationResults = await model.evaluate(validationPrices);
      console.log(`Validação RMSE: ${validationResults.rmse.toFixed(4)}`);
      
      // Se for o melhor modelo até agora, salvar
      if (validationResults.rmse < bestValidationRMSE) {
        bestValidationRMSE = validationResults.rmse;
        bestConfig = config;
        bestModel = model;
      }
    }
    
    // Avaliar melhor modelo com dados de teste
    console.log(`Melhor configuração: windowSize=${bestConfig.windowSize}, horizonDays=${bestConfig.horizonDays}`);
    bestTestResults = await bestModel.evaluate(testPrices);
    
    // Fazer previsões para os próximos 30 dias
    const predictions = await bestModel.predict(testPrices, 30);
    
    return {
      modelType: 'PriceForecaster',
      bestConfig,
      validationMetrics: { rmse: bestValidationRMSE },
      testMetrics: bestTestResults,
      predictions
    };
  }
  
  /**
   * Valida o modelo aprimorado (PriceForecasterEnhanced)
   * @param {Array} trainPrices - Preços para treinamento
   * @param {Array} validationPrices - Preços para validação
   * @param {Array} testPrices - Preços para teste
   * @param {Array} historicalData - Dados históricos completos
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateEnhancedModel(trainPrices, validationPrices, testPrices, historicalData) {
    console.log('Validando modelo aprimorado (PriceForecasterEnhanced)...');
    
    // Configurações a testar
    const configs = [
      { windowSize: 30, horizonDays: 30, epochs: 100, useEnsemble: false, useExogenousVariables: false },
      { windowSize: 30, horizonDays: 30, epochs: 100, useEnsemble: true, useExogenousVariables: false },
      { windowSize: 30, horizonDays: 30, epochs: 100, useEnsemble: false, useExogenousVariables: true },
      { windowSize: 30, horizonDays: 30, epochs: 100, useEnsemble: true, useExogenousVariables: true }
    ];
    
    let bestConfig = null;
    let bestModel = null;
    let bestValidationRMSE = Infinity;
    let bestTestResults = null;
    let bestPredictions = null;
    
    // Preparar variáveis exógenas (volume como exemplo)
    const volumes = historicalData.map(item => item.volume || 0);
    
    // Dividir dados em treino, validação e teste
    const splitIndices = this.splitData(trainPrices.length);
    
    const trainVolumes = volumes.slice(0, splitIndices.validationStart);
    const validationVolumes = volumes.slice(splitIndices.validationStart, splitIndices.testStart);
    const testVolumes = volumes.slice(splitIndices.testStart);
    
    // Testar cada configuração
    for (const config of configs) {
      console.log(`Testando configuração: useEnsemble=${config.useEnsemble}, useExogenousVariables=${config.useExogenousVariables}`);
      
      const model = new PriceForecasterEnhanced(config);
      
      // Treinar com dados de treino
      if (config.useExogenousVariables) {
        await model.trainEnhanced({
          prices: trainPrices,
          exogenous: {
            volume: trainVolumes
          }
        });
      } else {
        await model.trainEnhanced(trainPrices);
      }
      
      // Avaliar com dados de validação
      let validationResults;
      if (config.useExogenousVariables) {
        validationResults = await model.evaluateEnhanced({
          prices: validationPrices,
          exogenous: {
            volume: validationVolumes
          }
        });
      } else {
        validationResults = await model.evaluateEnhanced(validationPrices);
      }
      
      console.log(`Validação RMSE: ${validationResults.rmse.toFixed(4)}`);
      
      // Se for o melhor modelo até agora, salvar
      if (validationResults.rmse < bestValidationRMSE) {
        bestValidationRMSE = validationResults.rmse;
        bestConfig = config;
        bestModel = model;
      }
    }
    
    // Avaliar melhor modelo com dados de teste
    console.log(`Melhor configuração: useEnsemble=${bestConfig.useEnsemble}, useExogenousVariables=${bestConfig.useExogenousVariables}`);
    
    let bestTestResults;
    if (bestConfig.useExogenousVariables) {
      bestTestResults = await bestModel.evaluateEnhanced({
        prices: testPrices,
        exogenous: {
          volume: testVolumes
        }
      });
      
      // Fazer previsões para os próximos 30 dias
      bestPredictions = await bestModel.predictWithConfidence({
        prices: testPrices,
        exogenous: {
          volume: testVolumes
        }
      }, 30);
    } else {
      bestTestResults = await bestModel.evaluateEnhanced(testPrices);
      
      // Fazer previsões para os próximos 30 dias
      bestPredictions = await bestModel.predictWithConfidence(testPrices, 30);
    }
    
    return {
      modelType: 'PriceForecasterEnhanced',
      bestConfig,
      validationMetrics: { rmse: bestValidationRMSE },
      testMetrics: bestTestResults,
      predictions: bestPredictions
    };
  }
  
  /**
   * Valida modelos de benchmark simples
   * @param {Array} trainPrices - Preços para treinamento
   * @param {Array} testPrices - Preços para teste
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateBenchmarks(trainPrices, testPrices) {
    console.log('Validando modelos de benchmark...');
    
    const results = {};
    
    // 1. Modelo ingênuo (último valor)
    if (this.config.benchmarkModels.includes('naive')) {
      console.log('Testando modelo ingênuo (último valor)...');
      
      const predictions = [];
      const lastPrice = trainPrices[trainPrices.length - 1];
      
      // Prever mesmo valor para todos os dias
      for (let i = 0; i < 30; i++) {
        predictions.push(lastPrice);
      }
      
      // Calcular métricas com primeiros 30 dias de teste
      const metrics = this.calculateMetrics(testPrices.slice(0, 30), predictions);
      
      results.naive = {
        modelType: 'Naive',
        testMetrics: metrics,
        predictions
      };
    }
    
    // 2. Média Móvel Simples (SMA)
    if (this.config.benchmarkModels.includes('sma')) {
      console.log('Testando modelo SMA (Média Móvel Simples)...');
      
      // Testar diferentes janelas
      const windows = [5, 10, 20];
      let bestWindow = 5;
      let bestRMSE = Infinity;
      let bestPredictions = [];
      
      for (const window of windows) {
        // Calcular SMA para os últimos 'window' dias
        const sma = this.calculateSMA(trainPrices, window);
        
        // Prever mesmo valor para todos os dias
        const predictions = [];
        for (let i = 0; i < 30; i++) {
          predictions.push(sma);
        }
        
        // Calcular métricas com primeiros 30 dias de teste
        const metrics = this.calculateMetrics(testPrices.slice(0, 30), predictions);
        
        if (metrics.rmse < bestRMSE) {
          bestRMSE = metrics.rmse;
          bestWindow = window;
          bestPredictions = predictions;
        }
      }
      
      // Calcular métricas finais
      const metrics = this.calculateMetrics(testPrices.slice(0, 30), bestPredictions);
      
      results.sma = {
        modelType: 'SMA',
        config: { window: bestWindow },
        testMetrics: metrics,
        predictions: bestPredictions
      };
    }
    
    // 3. Média Móvel Exponencial (EMA)
    if (this.config.benchmarkModels.includes('ema')) {
      console.log('Testando modelo EMA (Média Móvel Exponencial)...');
      
      // Testar diferentes fatores de suavização
      const alphas = [0.1, 0.2, 0.3];
      let bestAlpha = 0.2;
      let bestRMSE = Infinity;
      let bestPredictions = [];
      
      for (const alpha of alphas) {
        // Calcular EMA
        const ema = this.calculateEMA(trainPrices, alpha);
        
        // Prever mesmo valor para todos os dias
        const predictions = [];
        for (let i = 0; i < 30; i++) {
          predictions.push(ema);
        }
        
        // Calcular métricas com primeiros 30 dias de teste
        const metrics = this.calculateMetrics(testPrices.slice(0, 30), predictions);
        
        if (metrics.rmse < bestRMSE) {
          bestRMSE = metrics.rmse;
          bestAlpha = alpha;
          bestPredictions = predictions;
        }
      }
      
      // Calcular métricas finais
      const metrics = this.calculateMetrics(testPrices.slice(0, 30), bestPredictions);
      
      results.ema = {
        modelType: 'EMA',
        config: { alpha: bestAlpha },
        testMetrics: metrics,
        predictions: bestPredictions
      };
    }
    
    return results;
  }
  
  /**
   * Compara resultados de diferentes modelos
   * @param {Object} originalResults - Resultados do modelo original
   * @param {Object} enhancedResults - Resultados do modelo aprimorado
   * @param {Object} benchmarkResults - Resultados dos modelos de benchmark
   * @returns {Object} - Comparação de resultados
   */
  compareResults(originalResults, enhancedResults, benchmarkResults) {
    console.log('Comparando resultados dos modelos...');
    
    // Coletar RMSEs de todos os modelos
    const rmses = {
      original: originalResults.testMetrics.rmse,
      enhanced: enhancedResults.testMetrics.rmse
    };
    
    // Adicionar RMSEs dos benchmarks
    Object.keys(benchmarkResults).forEach(key => {
      rmses[key] = benchmarkResults[key].testMetrics.rmse;
    });
    
    // Encontrar melhor modelo (menor RMSE)
    let bestModel = 'original';
    let bestRMSE = rmses.original;
    
    Object.keys(rmses).forEach(model => {
      if (rmses[model] < bestRMSE) {
        bestRMSE = rmses[model];
        bestModel = model;
      }
    });
    
    // Calcular melhoria percentual em relação ao melhor benchmark
    const benchmarkRMSEs = { ...rmses };
    delete benchmarkRMSEs.original;
    delete benchmarkRMSEs.enhanced;
    
    const bestBenchmarkRMSE = Math.min(...Object.values(benchmarkRMSEs));
    
    const improvementOverBenchmark = {
      original: ((bestBenchmarkRMSE - rmses.original) / bestBenchmarkRMSE) * 100,
      enhanced: ((bestBenchmarkRMSE - rmses.enhanced) / bestBenchmarkRMSE) * 100
    };
    
    // Comparar original vs enhanced
    const enhancedImprovement = ((rmses.original - rmses.enhanced) / rmses.original) * 100;
    
    return {
      rmses,
      bestModel,
      bestRMSE,
      enhancedImprovement,
      improvementOverBenchmark
    };
  }
  
  /**
   * Calcula métricas de avaliação
   * @param {Array} actual - Valores reais
   * @param {Array} predicted - Valores previstos
   * @returns {Object} - Métricas calculadas
   */
  calculateMetrics(actual, predicted) {
    // Garantir que os arrays têm o mesmo tamanho
    const length = Math.min(actual.length, predicted.length);
    
    let mse = 0;
    let mae = 0;
    let mape = 0;
    
    for (let i = 0; i < length; i++) {
      // MSE
      mse += Math.pow(actual[i] - predicted[i], 2);
      
      // MAE
      mae += Math.abs(actual[i] - predicted[i]);
      
      // MAPE
      if (actual[i] !== 0) {
        mape += Math.abs((actual[i] - predicted[i]) / actual[i]);
      }
    }
    
    mse /= length;
    mae /= length;
    mape = (mape / length) * 100;
    
    // RMSE
    const rmse = Math.sqrt(mse);
    
    return {
      mse,
      rmse,
      mae,
      mape
    };
  }
  
  /**
   * Calcula Média Móvel Simples (SMA)
   * @param {Array} prices - Array de preços
   * @param {Number} window - Tamanho da janela
   * @returns {Number} - Valor da SMA
   */
  calculateSMA(prices, window) {
    const lastPrices = prices.slice(-window);
    return lastPrices.reduce((sum, price) => sum + price, 0) / window;
  }
  
  /**
   * Calcula Média Móvel Exponencial (EMA)
   * @param {Array} prices - Array de preços
   * @param {Number} alpha - Fator de suavização (0-1)
   * @returns {Number} - Valor da EMA
   */
  calculateEMA(prices, alpha) {
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = alpha * prices[i] + (1 - alpha) * ema;
    }
    
    return ema;
  }
  
  /**
   * Divide os dados em conjuntos de treino, validação e teste
   * @param {Number} length - Tamanho total dos dados
   * @returns {Object} - Índices de início para cada conjunto
   */
  splitData(length) {
    const testStart = Math.floor(length * (1 - this.config.testSplit));
    const validationStart = Math.floor(testStart * (1 - this.config.validationSplit));
    
    return {
      validationStart,
      testStart
    };
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
   * Gera relatório de validação
   * @returns {Object} - Relatório completo
   */
  generateReport() {
    if (Object.keys(this.results).length === 0) {
      return { error: 'Nenhuma validação realizada ainda' };
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {},
      details: this.results
    };
    
    // Calcular estatísticas gerais
    let totalTickers = 0;
    let enhancedWins = 0;
    let originalWins = 0;
    let benchmarkWins = 0;
    let totalEnhancedImprovement = 0;
    
    Object.values(this.results).forEach(result => {
      totalTickers++;
      
      if (result.comparison.bestModel === 'enhanced') {
        enhancedWins++;
      } else if (result.comparison.bestModel === 'original') {
        originalWins++;
      } else {
        benchmarkWins++;
      }
      
      totalEnhancedImprovement += result.comparison.enhancedImprovement;
    });
    
    report.summary = {
      totalTickers,
      enhancedWins,
      originalWins,
      benchmarkWins,
      averageEnhancedImprovement: totalEnhancedImprovement / totalTickers
    };
    
    return report;
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

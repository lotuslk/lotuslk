// src/models/priceForecasterEnhanced.js
import * as tf from '@tensorflow/tfjs';
import { PriceForecaster } from './priceForecaster';

/**
 * Versão aprimorada do PriceForecaster com recursos adicionais
 * 
 * Esta classe estende o PriceForecaster original, adicionando:
 * - Suporte a variáveis exógenas (volume, sentimento, índices de mercado)
 * - Ensemble de modelos para maior robustez
 * - Intervalos de confiança para previsões
 * - Métricas de avaliação adicionais
 */
export class PriceForecasterEnhanced extends PriceForecaster {
  constructor(config = {}) {
    // Configurações padrão estendidas
    const enhancedConfig = {
      // Parâmetros herdados
      windowSize: config.windowSize || 30,
      horizonDays: config.horizonDays || 30,
      epochs: config.epochs || 100,
      batchSize: config.batchSize || 32,
      learningRate: config.learningRate || 0.001,
      
      // Novos parâmetros
      useEnsemble: config.useEnsemble !== undefined ? config.useEnsemble : true,
      ensembleSize: config.ensembleSize || 3,
      useExogenousVariables: config.useExogenousVariables !== undefined ? config.useExogenousVariables : true,
      confidenceInterval: config.confidenceInterval || 0.95, // 95% por padrão
      ...config
    };
    
    super(enhancedConfig);
    
    this.config = enhancedConfig;
    this.ensembleModels = [];
    this.exogenousNormalizers = {};
  }
  
  /**
   * Prepara os dados para treinamento, incluindo variáveis exógenas
   * @param {Object} data - Objeto com preços e variáveis exógenas
   * @returns {Object} - Dados de treinamento formatados
   */
  prepareEnhancedData(data) {
    // Extrair preços e normalizar
    const prices = data.prices || data;
    const normalizedPrices = this.normalize(prices);
    
    // Inicializar arrays
    const X = [];
    const y = [];
    
    // Preparar variáveis exógenas, se disponíveis
    let exogenousData = {};
    
    if (this.config.useExogenousVariables && data.exogenous) {
      exogenousData = this.normalizeExogenousVariables(data.exogenous);
    }
    
    // Criar janelas deslizantes
    for (let i = 0; i < normalizedPrices.length - this.config.windowSize - this.config.horizonDays; i++) {
      // Janela de preços
      const priceWindow = normalizedPrices.slice(i, i + this.config.windowSize);
      
      // Adicionar variáveis exógenas, se disponíveis
      if (this.config.useExogenousVariables && Object.keys(exogenousData).length > 0) {
        const windowWithExogenous = [];
        
        for (let j = 0; j < this.config.windowSize; j++) {
          const dataPoint = [priceWindow[j]];
          
          // Adicionar cada variável exógena disponível
          Object.keys(exogenousData).forEach(varName => {
            if (exogenousData[varName][i + j] !== undefined) {
              dataPoint.push(exogenousData[varName][i + j]);
            } else {
              dataPoint.push(0); // Valor padrão se não disponível
            }
          });
          
          windowWithExogenous.push(dataPoint);
        }
        
        X.push(windowWithExogenous);
      } else {
        // Usar apenas preços
        X.push(priceWindow.map(price => [price]));
      }
      
      // Alvo é o preço após horizonDays
      y.push(normalizedPrices[i + this.config.windowSize + this.config.horizonDays - 1]);
    }
    
    // Calcular dimensão de entrada
    const inputDim = this.config.useExogenousVariables && Object.keys(exogenousData).length > 0 
      ? 1 + Object.keys(exogenousData).length 
      : 1;
    
    // Converter para tensores
    const inputTensor = tf.tensor3d(X, [X.length, this.config.windowSize, inputDim]);
    const outputTensor = tf.tensor2d(y, [y.length, 1]);
    
    return { 
      inputTensor, 
      outputTensor,
      inputDim
    };
  }
  
  /**
   * Normaliza variáveis exógenas
   * @param {Object} exogenous - Objeto com variáveis exógenas
   * @returns {Object} - Variáveis exógenas normalizadas
   */
  normalizeExogenousVariables(exogenous) {
    const normalized = {};
    
    Object.keys(exogenous).forEach(varName => {
      const values = exogenous[varName];
      
      // Calcular média e desvio padrão
      const tensor = tf.tensor1d(values);
      const mean = tf.mean(tensor);
      const std = tf.moments(tensor).variance.sqrt();
      
      // Armazenar para desnormalização posterior
      this.exogenousNormalizers[varName] = {
        mean: mean.dataSync()[0],
        std: std.dataSync()[0]
      };
      
      // Normalizar
      normalized[varName] = values.map(x => 
        (x - this.exogenousNormalizers[varName].mean) / this.exogenousNormalizers[varName].std
      );
      
      // Liberar tensores
      tensor.dispose();
      mean.dispose();
      std.dispose();
    });
    
    return normalized;
  }
  
  /**
   * Cria um modelo LSTM aprimorado
   * @param {Number} inputDim - Dimensão de entrada (preço + variáveis exógenas)
   * @returns {tf.Sequential} - Modelo TensorFlow.js
   */
  createEnhancedModel(inputDim = 1) {
    const model = tf.sequential();
    
    // Camada LSTM com suporte a múltiplas variáveis de entrada
    model.add(tf.layers.lstm({
      units: 64, // Aumentado de 50 para 64
      returnSequences: true,
      inputShape: [this.config.windowSize, inputDim]
    }));
    
    // Dropout para reduzir overfitting
    model.add(tf.layers.dropout({ rate: 0.2 }));
    
    // Segunda camada LSTM
    model.add(tf.layers.lstm({
      units: 32,
      returnSequences: false
    }));
    
    // Dropout
    model.add(tf.layers.dropout({ rate: 0.1 }));
    
    // Camada densa intermediária
    model.add(tf.layers.dense({ 
      units: 16,
      activation: 'relu'
    }));
    
    // Camada densa para saída
    model.add(tf.layers.dense({ units: 1 }));
    
    // Compilar modelo com otimizador Adam e taxa de aprendizado personalizada
    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'meanSquaredError'
    });
    
    return model;
  }
  
  /**
   * Treina o modelo com dados históricos e variáveis exógenas
   * @param {Object} data - Objeto com preços e variáveis exógenas
   * @returns {Promise} - Promessa que resolve após o treinamento
   */
  async trainEnhanced(data) {
    try {
      // Preparar dados
      const { inputTensor, outputTensor, inputDim } = this.prepareEnhancedData(data);
      
      // Se usando ensemble, treinar múltiplos modelos
      if (this.config.useEnsemble) {
        this.ensembleModels = [];
        const histories = [];
        
        for (let i = 0; i < this.config.ensembleSize; i++) {
          console.log(`Treinando modelo ${i + 1}/${this.config.ensembleSize} do ensemble`);
          
          // Criar modelo
          const model = this.createEnhancedModel(inputDim);
          
          // Treinar modelo com early stopping
          const history = await model.fit(inputTensor, outputTensor, {
            epochs: this.config.epochs,
            batchSize: this.config.batchSize,
            validationSplit: 0.2,
            callbacks: {
              onEpochEnd: (epoch, logs) => {
                if (epoch % 10 === 0) {
                  console.log(`Modelo ${i + 1}, Epoch ${epoch + 1}/${this.config.epochs}, Loss: ${logs.loss.toFixed(4)}, Val Loss: ${logs.val_loss.toFixed(4)}`);
                }
              }
            }
          });
          
          this.ensembleModels.push(model);
          histories.push(history);
        }
        
        // Usar o primeiro modelo como modelo principal
        this.model = this.ensembleModels[0];
        this.trained = true;
        
        return histories;
      } else {
        // Treinar um único modelo
        this.model = this.createEnhancedModel(inputDim);
        
        const history = await this.model.fit(inputTensor, outputTensor, {
          epochs: this.config.epochs,
          batchSize: this.config.batchSize,
          validationSplit: 0.2,
          callbacks: {
            onEpochEnd: (epoch, logs) => {
              if (epoch % 10 === 0) {
                console.log(`Epoch ${epoch + 1}/${this.config.epochs}, Loss: ${logs.loss.toFixed(4)}, Val Loss: ${logs.val_loss.toFixed(4)}`);
              }
            }
          }
        });
        
        this.trained = true;
        return history;
      }
    } catch (error) {
      console.error('Erro ao treinar modelo:', error);
      throw error;
    } finally {
      // Liberar tensores
      tf.disposeVariables();
    }
  }
  
  /**
   * Faz previsões com intervalos de confiança
   * @param {Object} data - Objeto com preços recentes e variáveis exógenas
   * @param {Number} days - Número de dias a prever
   * @returns {Object} - Previsões com intervalos de confiança
   */
  async predictWithConfidence(data, days = 30) {
    if (!this.trained) {
      throw new Error('Modelo não treinado. Execute trainEnhanced() primeiro.');
    }
    
    try {
      // Extrair preços
      const recentPrices = data.prices || data;
      
      // Garantir que temos dados suficientes
      if (recentPrices.length < this.config.windowSize) {
        throw new Error(`São necessários pelo menos ${this.config.windowSize} pontos de dados para previsão.`);
      }
      
      // Pegar os últimos windowSize preços
      let lastWindow = recentPrices.slice(-this.config.windowSize);
      
      // Normalizar preços
      lastWindow = lastWindow.map(x => (x - this.meanStd.mean) / this.meanStd.std);
      
      // Preparar variáveis exógenas, se disponíveis
      let lastExogenous = {};
      
      if (this.config.useExogenousVariables && data.exogenous) {
        Object.keys(data.exogenous).forEach(varName => {
          const values = data.exogenous[varName];
          const lastValues = values.slice(-this.config.windowSize);
          
          // Normalizar
          if (this.exogenousNormalizers[varName]) {
            lastExogenous[varName] = lastValues.map(x => 
              (x - this.exogenousNormalizers[varName].mean) / this.exogenousNormalizers[varName].std
            );
          } else {
            // Se não tiver normalizador, usar valores brutos
            lastExogenous[varName] = lastValues;
          }
        });
      }
      
      // Arrays para armazenar previsões
      const predictions = [];
      const lowerBounds = [];
      const upperBounds = [];
      
      // Fazer previsões recursivas
      for (let i = 0; i < days; i++) {
        // Se usando ensemble, obter previsões de todos os modelos
        if (this.config.useEnsemble && this.ensembleModels.length > 0) {
          const modelPredictions = [];
          
          // Obter previsão de cada modelo
          for (const model of this.ensembleModels) {
            // Preparar entrada
            let input;
            
            if (this.config.useExogenousVariables && Object.keys(lastExogenous).length > 0) {
              // Combinar preço com variáveis exógenas
              const inputData = [];
              
              for (let j = 0; j < this.config.windowSize; j++) {
                const dataPoint = [lastWindow[j]];
                
                // Adicionar cada variável exógena
                Object.keys(lastExogenous).forEach(varName => {
                  if (lastExogenous[varName][j] !== undefined) {
                    dataPoint.push(lastExogenous[varName][j]);
                  } else {
                    dataPoint.push(0);
                  }
                });
                
                inputData.push(dataPoint);
              }
              
              input = tf.tensor3d([inputData], [1, this.config.windowSize, 1 + Object.keys(lastExogenous).length]);
            } else {
              // Usar apenas preços
              input = tf.tensor3d([lastWindow.map(price => [price])], [1, this.config.windowSize, 1]);
            }
            
            // Fazer previsão
            const predictionTensor = model.predict(input);
            const predictionValue = predictionTensor.dataSync()[0];
            
            modelPredictions.push(predictionValue);
            
            // Liberar tensores
            input.dispose();
            predictionTensor.dispose();
          }
          
          // Calcular média e desvio padrão das previsões do ensemble
          const meanPrediction = modelPredictions.reduce((sum, val) => sum + val, 0) / modelPredictions.length;
          
          const squaredDiffs = modelPredictions.map(val => Math.pow(val - meanPrediction, 2));
          const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / modelPredictions.length;
          const stdDev = Math.sqrt(variance);
          
          // Calcular intervalos de confiança
          const zScore = this.getZScore(this.config.confidenceInterval);
          const lowerBound = meanPrediction - zScore * stdDev;
          const upperBound = meanPrediction + zScore * stdDev;
          
          // Adicionar à lista de previsões
          predictions.push(meanPrediction);
          lowerBounds.push(lowerBound);
          upperBounds.push(upperBound);
          
          // Atualizar janela para próxima previsão
          lastWindow.shift();
          lastWindow.push(meanPrediction);
          
          // Atualizar variáveis exógenas (simplificado - repetir último valor)
          if (this.config.useExogenousVariables && Object.keys(lastExogenous).length > 0) {
            Object.keys(lastExogenous).forEach(varName => {
              const values = lastExogenous[varName];
              values.shift();
              values.push(values[values.length - 1]);
            });
          }
        } else {
          // Usar apenas o modelo principal
          // Preparar entrada
          let input;
          
          if (this.config.useExogenousVariables && Object.keys(lastExogenous).length > 0) {
            // Combinar preço com variáveis exógenas
            const inputData = [];
            
            for (let j = 0; j < this.config.windowSize; j++) {
              const dataPoint = [lastWindow[j]];
              
              // Adicionar cada variável exógena
              Object.keys(lastExogenous).forEach(varName => {
                if (lastExogenous[varName][j] !== undefined) {
                  dataPoint.push(lastExogenous[varName][j]);
                } else {
                  dataPoint.push(0);
                }
              });
              
              inputData.push(dataPoint);
            }
            
            input = tf.tensor3d([inputData], [1, this.config.windowSize, 1 + Object.keys(lastExogenous).length]);
          } else {
            // Usar apenas preços
            input = tf.tensor3d([lastWindow.map(price => [price])], [1, this.config.windowSize, 1]);
          }
          
          // Fazer previsão
          const predictionTensor = this.model.predict(input);
          const predictionValue = predictionTensor.dataSync()[0];
          
          // Adicionar à lista de previsões
          predictions.push(predictionValue);
          
          // Sem ensemble, usar erro histórico para intervalos de confiança
          const historicalError = 0.05; // 5% de erro (simplificado)
          lowerBounds.push(predictionValue * (1 - historicalError));
          upperBounds.push(predictionValue * (1 + historicalError));
          
          // Atualizar janela para próxima previsão
          lastWindow.shift();
          lastWindow.push(predictionValue);
          
          // Atualizar variáveis exógenas (simplificado - repetir último valor)
          if (this.config.useExogenousVariables && Object.keys(lastExogenous).length > 0) {
            Object.keys(lastExogenous).forEach(varName => {
              const values = lastExogenous[varName];
              values.shift();
              values.push(values[values.length - 1]);
            });
          }
          
          // Liberar tensores
          input.dispose();
          predictionTensor.dispose();
        }
      }
      
      // Desnormalizar resultados
      const denormalizedPredictions = this.denormalize(predictions);
      const denormalizedLowerBounds = this.denormalize(lowerBounds);
      const denormalizedUpperBounds = this.denormalize(upperBounds);
      
      return {
        predictions: denormalizedPredictions,
        lowerBounds: denormalizedLowerBounds,
        upperBounds: denormalizedUpperBounds,
        confidenceInterval: this.config.confidenceInterval
      };
    } catch (error) {
      console.error('Erro ao fazer previsão:', error);
      throw error;
    } finally {
      // Liberar tensores
      tf.disposeVariables();
    }
  }
  
  /**
   * Obtém o valor Z para um determinado intervalo de confiança
   * @param {Number} confidenceInterval - Intervalo de confiança (0-1)
   * @returns {Number} - Valor Z
   */
  getZScore(confidenceInterval) {
    // Valores comuns de Z para intervalos de confiança
    const zScores = {
      0.50: 0.67,
      0.80: 1.28,
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    
    return zScores[confidenceInterval] || 1.96; // Padrão para 95%
  }
  
  /**
   * Avalia o modelo com métricas adicionais
   * @param {Array} testData - Dados de teste
   * @returns {Object} - Métricas de avaliação
   */
  async evaluateEnhanced(testData) {
    if (!this.trained) {
      throw new Error('Modelo não treinado. Execute trainEnhanced() primeiro.');
    }
    
    try {
      // Extrair preços
      const testPrices = testData.prices || testData;
      
      // Preparar dados de teste
      const { inputTensor, outputTensor } = this.prepareEnhancedData(testData);
      
      // Avaliar modelo
      const evaluation = await this.model.evaluate(inputTensor, outputTensor);
      const mse = evaluation.dataSync()[0];
      
      // Calcular RMSE (Root Mean Squared Error)
      const rmse = Math.sqrt(mse);
      
      // Fazer previsões para calcular outras métricas
      const predictions = this.model.predict(inputTensor);
      const predValues = predictions.dataSync();
      const actualValues = outputTensor.dataSync();
      
      // Desnormalizar valores
      const denormPred = this.denormalize(Array.from(predValues));
      const denormActual = this.denormalize(Array.from(actualValues));
      
      // Calcular MAPE (Mean Absolute Percentage Error)
      let mape = 0;
      let mae = 0;
      let r2Numerator = 0;
      let r2Denominator = 0;
      
      // Calcular média dos valores reais
      const meanActual = denormActual.reduce((sum, val) => sum + val, 0) / denormActual.length;
      
      for (let i = 0; i < denormActual.length; i++) {
        // MAPE
        mape += Math.abs((denormActual[i] - denormPred[i]) / denormActual[i]);
        
        // MAE (Mean Absolute Error)
        mae += Math.abs(denormActual[i] - denormPred[i]);
        
        // Para R² (Coeficiente de determinação)
        r2Numerator += Math.pow(denormActual[i] - denormPred[i], 2);
        r2Denominator += Math.pow(denormActual[i] - meanActual, 2);
      }
      
      mape = (mape / denormActual.length) * 100;
      mae = mae / denormActual.length;
      
      // Calcular R² (1 - SSres/SStot)
      const r2 = 1 - (r2Numerator / r2Denominator);
      
      // Calcular direção correta (acerto na tendência de alta/baixa)
      let correctDirection = 0;
      for (let i = 1; i < denormActual.length; i++) {
        const actualDirection = denormActual[i] > denormActual[i-1];
        const predDirection = denormPred[i] > denormPred[i-1];
        
        if (actualDirection === predDirection) {
          correctDirection++;
        }
      }
      
      const directionAccuracy = (correctDirection / (denormActual.length - 1)) * 100;
      
      // Liberar tensores
      inputTensor.dispose();
      outputTensor.dispose();
      predictions.dispose();
      evaluation.dispose();
      
      return {
        mse,
        rmse,
        mape,
        mae,
        r2,
        directionAccuracy,
        normalizedRMSE: rmse * this.meanStd.std,
        sampleSize: denormActual.length
      };
    } catch (error) {
      console.error('Erro ao avaliar modelo:', error);
      throw error;
    } finally {
      // Liberar tensores
      tf.disposeVariables();
    }
  }
  
  /**
   * Salva o modelo treinado e seus metadados
   * @returns {Promise} - Promessa que resolve após o salvamento
   */
  async saveEnhancedModel() {
    if (!this.trained) {
      throw new Error('Modelo não treinado. Execute trainEnhanced() primeiro.');
    }
    
    try {
      // Salvar modelo principal
      await this.model.save('localstorage://lotus-invest-price-forecaster-enhanced');
      
      // Salvar modelos do ensemble, se existirem
      if (this.config.useEnsemble && this.ensembleModels.length > 0) {
        for (let i = 0; i < this.ensembleModels.length; i++) {
          await this.ensembleModels[i].save(`localstorage://lotus-invest-price-forecaster-ensemble-${i}`);
        }
      }
      
      // Salvar parâmetros de normalização e configuração
      localStorage.setItem('lotus-invest-price-forecaster-enhanced-params', JSON.stringify({
        meanStd: this.meanStd,
        exogenousNormalizers: this.exogenousNormalizers,
        config: this.config
      }));
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar modelo:', error);
      return false;
    }
  }
  
  /**
   * Carrega um modelo previamente treinado e seus metadados
   * @returns {Promise} - Promessa que resolve após o carregamento
   */
  async loadEnhancedModel() {
    try {
      // Carregar modelo principal
      this.model = await tf.loadLayersModel('localstorage://lotus-invest-price-forecaster-enhanced');
      
      // Carregar parâmetros
      const params = JSON.parse(localStorage.getItem('lotus-invest-price-forecaster-enhanced-params'));
      
      if (!params) {
        throw new Error('Parâmetros do modelo não encontrados');
      }
      
      this.meanStd = params.meanStd;
      this.exogenousNormalizers = params.exogenousNormalizers || {};
      this.config = params.config;
      
      // Carregar modelos do ensemble, se configurado
      if (this.config.useEnsemble) {
        this.ensembleModels = [];
        
        for (let i = 0; i < this.config.ensembleSize; i++) {
          try {
            const model = await tf.loadLayersModel(`localstorage://lotus-invest-price-forecaster-ensemble-${i}`);
            this.ensembleModels.push(model);
          } catch (error) {
            console.warn(`Não foi possível carregar modelo ${i} do ensemble:`, error);
          }
        }
        
        console.log(`Carregados ${this.ensembleModels.length}/${this.config.ensembleSize} modelos do ensemble`);
      }
      
      this.trained = true;
      return true;
    } catch (error) {
      console.error('Erro ao carregar modelo:', error);
      return false;
    }
  }
  
  /**
   * Exporta o modelo para formato JSON
   * @returns {Object} - Modelo e parâmetros em formato JSON
   */
  async exportModel() {
    if (!this.trained) {
      throw new Error('Modelo não treinado. Execute trainEnhanced() primeiro.');
    }
    
    try {
      // Exportar modelo principal
      const modelJSON = await this.model.toJSON();
      
      // Exportar parâmetros
      const params = {
        meanStd: this.meanStd,
        exogenousNormalizers: this.exogenousNormalizers,
        config: this.config
      };
      
      return {
        model: modelJSON,
        params
      };
    } catch (error) {
      console.error('Erro ao exportar modelo:', error);
      throw error;
    }
  }
  
  /**
   * Importa o modelo a partir de formato JSON
   * @param {Object} modelData - Modelo e parâmetros em formato JSON
   * @returns {Boolean} - Sucesso da importação
   */
  async importModel(modelData) {
    try {
      // Importar modelo
      this.model = await tf.models.modelFromJSON(modelData.model);
      
      // Importar parâmetros
      this.meanStd = modelData.params.meanStd;
      this.exogenousNormalizers = modelData.params.exogenousNormalizers || {};
      this.config = modelData.params.config;
      
      this.trained = true;
      return true;
    } catch (error) {
      console.error('Erro ao importar modelo:', error);
      return false;
    }
  }
}

// src/models/priceForecaster.js
import * as tf from '@tensorflow/tfjs';

/**
 * Classe para previsão de preços de FIIs usando TensorFlow.js
 * 
 * Esta implementação usa uma rede LSTM (Long Short-Term Memory)
 * para prever preços futuros com base em dados históricos.
 */
export class PriceForecaster {
  constructor(config = {}) {
    this.config = {
      windowSize: config.windowSize || 30, // Janela de dias para previsão
      horizonDays: config.horizonDays || 30, // Horizonte de previsão em dias
      epochs: config.epochs || 100, // Épocas de treinamento
      batchSize: config.batchSize || 32, // Tamanho do batch
      learningRate: config.learningRate || 0.001, // Taxa de aprendizado
      ...config
    };
    
    this.model = null;
    this.meanStd = { mean: 0, std: 1 }; // Para normalização
    this.trained = false;
  }
  
  /**
   * Normaliza os dados para melhorar o treinamento
   * @param {Array} data - Array de preços
   * @returns {Array} - Dados normalizados
   */
  normalize(data) {
    const mean = tf.mean(data);
    const std = tf.moments(data).variance.sqrt();
    
    this.meanStd = {
      mean: mean.dataSync()[0],
      std: std.dataSync()[0]
    };
    
    return data.map(x => (x - this.meanStd.mean) / this.meanStd.std);
  }
  
  /**
   * Desnormaliza os dados para obter preços reais
   * @param {Array} data - Array de preços normalizados
   * @returns {Array} - Dados desnormalizados
   */
  denormalize(data) {
    return data.map(x => x * this.meanStd.std + this.meanStd.mean);
  }
  
  /**
   * Prepara os dados para treinamento, criando janelas deslizantes
   * @param {Array} data - Array de preços históricos
   * @returns {Object} - Dados de treinamento formatados
   */
  prepareData(data) {
    const normalizedData = this.normalize(data);
    const X = [];
    const y = [];
    
    // Criar janelas deslizantes
    for (let i = 0; i < normalizedData.length - this.config.windowSize - this.config.horizonDays; i++) {
      X.push(normalizedData.slice(i, i + this.config.windowSize));
      y.push(normalizedData[i + this.config.windowSize + this.config.horizonDays - 1]);
    }
    
    // Converter para tensores
    const inputTensor = tf.tensor3d(X, [X.length, this.config.windowSize, 1]);
    const outputTensor = tf.tensor2d(y, [y.length, 1]);
    
    return { inputTensor, outputTensor };
  }
  
  /**
   * Cria o modelo LSTM
   * @returns {tf.Sequential} - Modelo TensorFlow.js
   */
  createModel() {
    const model = tf.sequential();
    
    // Camada LSTM
    model.add(tf.layers.lstm({
      units: 50,
      returnSequences: true,
      inputShape: [this.config.windowSize, 1]
    }));
    
    // Segunda camada LSTM
    model.add(tf.layers.lstm({
      units: 50,
      returnSequences: false
    }));
    
    // Camada densa para saída
    model.add(tf.layers.dense({ units: 1 }));
    
    // Compilar modelo
    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'meanSquaredError'
    });
    
    return model;
  }
  
  /**
   * Treina o modelo com dados históricos
   * @param {Array} historicalPrices - Array de preços históricos
   * @returns {Promise} - Promessa que resolve após o treinamento
   */
  async train(historicalPrices) {
    // Preparar dados
    const { inputTensor, outputTensor } = this.prepareData(historicalPrices);
    
    // Criar modelo
    this.model = this.createModel();
    
    // Treinar modelo
    const history = await this.model.fit(inputTensor, outputTensor, {
      epochs: this.config.epochs,
      batchSize: this.config.batchSize,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch + 1}/${this.config.epochs}, Loss: ${logs.loss.toFixed(4)}, Val Loss: ${logs.val_loss.toFixed(4)}`);
        }
      }
    });
    
    this.trained = true;
    return history;
  }
  
  /**
   * Faz previsões para os próximos dias
   * @param {Array} recentPrices - Preços recentes para base da previsão
   * @param {Number} days - Número de dias a prever
   * @returns {Array} - Array com previsões
   */
  async predict(recentPrices, days = 30) {
    if (!this.trained || !this.model) {
      throw new Error('Modelo não treinado. Execute train() primeiro.');
    }
    
    // Garantir que temos dados suficientes
    if (recentPrices.length < this.config.windowSize) {
      throw new Error(`São necessários pelo menos ${this.config.windowSize} pontos de dados para previsão.`);
    }
    
    // Pegar os últimos windowSize preços
    let lastWindow = recentPrices.slice(-this.config.windowSize);
    
    // Normalizar
    lastWindow = lastWindow.map(x => (x - this.meanStd.mean) / this.meanStd.std);
    
    const predictions = [];
    
    // Fazer previsões recursivas
    for (let i = 0; i < days; i++) {
      // Preparar entrada
      const input = tf.tensor3d([lastWindow], [1, this.config.windowSize, 1]);
      
      // Fazer previsão
      const predictionTensor = this.model.predict(input);
      const predictionValue = predictionTensor.dataSync()[0];
      
      // Adicionar à lista de previsões
      predictions.push(predictionValue);
      
      // Atualizar janela para próxima previsão
      lastWindow.shift();
      lastWindow.push(predictionValue);
    }
    
    // Desnormalizar resultados
    return this.denormalize(predictions);
  }
  
  /**
   * Salva o modelo treinado
   * @returns {Promise} - Promessa que resolve após o salvamento
   */
  async saveModel() {
    if (!this.trained || !this.model) {
      throw new Error('Modelo não treinado. Execute train() primeiro.');
    }
    
    await this.model.save('localstorage://lotus-invest-price-forecaster');
    
    // Salvar também os parâmetros de normalização
    localStorage.setItem('lotus-invest-price-forecaster-params', JSON.stringify({
      meanStd: this.meanStd,
      config: this.config
    }));
    
    return true;
  }
  
  /**
   * Carrega um modelo previamente treinado
   * @returns {Promise} - Promessa que resolve após o carregamento
   */
  async loadModel() {
    try {
      this.model = await tf.loadLayersModel('localstorage://lotus-invest-price-forecaster');
      
      // Carregar parâmetros de normalização
      const params = JSON.parse(localStorage.getItem('lotus-invest-price-forecaster-params'));
      this.meanStd = params.meanStd;
      this.config = params.config;
      
      this.trained = true;
      return true;
    } catch (error) {
      console.error('Erro ao carregar modelo:', error);
      return false;
    }
  }
  
  /**
   * Avalia o modelo com dados de teste
   * @param {Array} testPrices - Preços para teste
   * @returns {Object} - Métricas de avaliação
   */
  async evaluate(testPrices) {
    if (!this.trained || !this.model) {
      throw new Error('Modelo não treinado. Execute train() primeiro.');
    }
    
    // Preparar dados de teste
    const { inputTensor, outputTensor } = this.prepareData(testPrices);
    
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
    for (let i = 0; i < denormActual.length; i++) {
      mape += Math.abs((denormActual[i] - denormPred[i]) / denormActual[i]);
    }
    mape = (mape / denormActual.length) * 100;
    
    return {
      mse,
      rmse,
      mape,
      normalizedRMSE: rmse * this.meanStd.std
    };
  }
}

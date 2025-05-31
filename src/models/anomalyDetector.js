// src/models/anomalyDetector.js
import * as tf from '@tensorflow/tfjs';

/**
 * Classe para detecção de anomalias em dividendos de FIIs
 * 
 * Esta implementação utiliza uma combinação de técnicas estatísticas e
 * aprendizado de máquina para identificar padrões anômalos em distribuições
 * de dividendos, auxiliando na análise de risco.
 */
export class AnomalyDetector {
  constructor(config = {}) {
    this.config = {
      // Configurações para métodos estatísticos
      zScoreThreshold: config.zScoreThreshold || 2.5, // Limiar para Z-score
      iqrMultiplier: config.iqrMultiplier || 1.5, // Multiplicador para IQR
      
      // Configurações para Isolation Forest
      contamination: config.contamination || 0.05, // Taxa esperada de anomalias (5%)
      nEstimators: config.nEstimators || 100, // Número de árvores
      maxSamples: config.maxSamples || 'auto', // Número máximo de amostras por árvore
      
      // Configurações para autoencoder
      useAutoencoder: config.useAutoencoder !== undefined ? config.useAutoencoder : true,
      encodingDim: config.encodingDim || 3, // Dimensão do encoding
      epochs: config.epochs || 50, // Épocas de treinamento
      batchSize: config.batchSize || 32, // Tamanho do batch
      
      // Configurações gerais
      ensembleMethod: config.ensembleMethod || 'majority', // majority, weighted, or any
      featureEngineering: config.featureEngineering !== undefined ? config.featureEngineering : true,
      useCache: config.useCache !== undefined ? config.useCache : true,
      cacheExpiration: config.cacheExpiration || 24 * 60 * 60 * 1000, // 24 horas em ms
      ...config
    };
    
    this.model = null;
    this.autoencoder = null;
    this.cache = {};
    this.initialized = false;
  }
  
  /**
   * Inicializa o detector de anomalias
   * @returns {Promise<boolean>} - Sucesso da inicialização
   */
  async initialize() {
    try {
      if (this.initialized) return true;
      
      if (this.config.useAutoencoder) {
        // Carregar ou criar autoencoder
        const autoencoderLoaded = await this.loadModel();
        
        if (!autoencoderLoaded) {
          console.warn('Autoencoder não disponível, será criado quando necessário');
        }
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Erro ao inicializar detector de anomalias:', error);
      return false;
    }
  }
  
  /**
   * Carrega modelo pré-treinado
   * @returns {Promise<boolean>} - Sucesso do carregamento
   */
  async loadModel() {
    try {
      // Tentar carregar do localStorage primeiro
      try {
        this.autoencoder = await tf.loadLayersModel('localstorage://lotus-invest-anomaly-detector');
        console.log('Modelo de detecção de anomalias carregado do localStorage');
        return true;
      } catch (e) {
        console.log('Modelo não encontrado no localStorage');
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao carregar modelo:', error);
      return false;
    }
  }
  
  /**
   * Detecta anomalias em dados de dividendos
   * @param {Array} dividendData - Dados históricos de dividendos
   * @returns {Promise<Object>} - Resultados da detecção de anomalias
   */
  async detectDividendAnomalies(dividendData) {
    try {
      // Verificar inicialização
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Verificar cache
      const cacheKey = `anomalies-${JSON.stringify(dividendData.map(d => d.date + d.value))}`;
      if (this.config.useCache && this.cache[cacheKey] && this.isCacheValid(this.cache[cacheKey].timestamp)) {
        return this.cache[cacheKey].data;
      }
      
      // Verificar dados
      if (!dividendData || dividendData.length < 5) {
        console.warn('Dados insuficientes para detecção de anomalias');
        return {
          anomalies: [],
          stats: { count: 0, percentage: 0 },
          methods: {}
        };
      }
      
      console.log(`Analisando ${dividendData.length} pontos de dados de dividendos`);
      
      // Extrair valores e datas
      const values = dividendData.map(item => item.value);
      const dates = dividendData.map(item => item.date);
      
      // Engenharia de features
      let features;
      if (this.config.featureEngineering) {
        features = this.engineerFeatures(dividendData);
      } else {
        features = values.map(value => [value]);
      }
      
      // Detectar anomalias usando múltiplos métodos
      const methods = {};
      
      // 1. Método estatístico: Z-score
      methods.zScore = this.detectAnomaliesWithZScore(values);
      
      // 2. Método estatístico: IQR (Intervalo Interquartil)
      methods.iqr = this.detectAnomaliesWithIQR(values);
      
      // 3. Método de machine learning: Isolation Forest
      methods.isolationForest = await this.detectAnomaliesWithIsolationForest(features);
      
      // 4. Método de machine learning: Autoencoder (se configurado)
      if (this.config.useAutoencoder) {
        methods.autoencoder = await this.detectAnomaliesWithAutoencoder(features);
      }
      
      // Combinar resultados usando método de ensemble
      const anomalyIndices = this.combineAnomalyDetections(methods);
      
      // Mapear índices para objetos de anomalia
      const anomalies = anomalyIndices.map(index => {
        // Calcular score de anomalia (média dos scores dos métodos)
        let anomalyScore = 0;
        let methodCount = 0;
        
        Object.values(methods).forEach(method => {
          if (method.anomalyIndices.includes(index)) {
            anomalyScore += method.anomalyScores[index] || 1;
            methodCount++;
          }
        });
        
        anomalyScore = methodCount > 0 ? anomalyScore / methodCount : 0;
        
        // Determinar severidade
        let severity;
        if (anomalyScore > 0.8) severity = 'high';
        else if (anomalyScore > 0.5) severity = 'medium';
        else severity = 'low';
        
        // Determinar tipo de anomalia
        const value = values[index];
        const avg = this.calculateMean(values);
        const type = value > avg ? 'high_value' : 'low_value';
        
        // Calcular desvio percentual da média
        const deviation = ((value - avg) / avg) * 100;
        
        return {
          date: dates[index],
          value: value,
          anomalyScore,
          severity,
          type,
          deviation: parseFloat(deviation.toFixed(2)),
          detectedBy: Object.keys(methods).filter(
            method => methods[method].anomalyIndices.includes(index)
          )
        };
      });
      
      // Ordenar anomalias por score (maior para menor)
      anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore);
      
      // Calcular estatísticas
      const stats = {
        count: anomalies.length,
        percentage: parseFloat(((anomalies.length / dividendData.length) * 100).toFixed(2))
      };
      
      // Formatar resultado
      const result = {
        anomalies,
        stats,
        methods: Object.keys(methods).reduce((acc, method) => {
          acc[method] = {
            anomalyCount: methods[method].anomalyIndices.length,
            threshold: methods[method].threshold
          };
          return acc;
        }, {})
      };
      
      // Atualizar cache
      if (this.config.useCache) {
        this.cache[cacheKey] = {
          data: result,
          timestamp: Date.now()
        };
      }
      
      return result;
    } catch (error) {
      console.error('Erro ao detectar anomalias:', error);
      return {
        anomalies: [],
        stats: { count: 0, percentage: 0 },
        methods: {},
        error: error.message
      };
    }
  }
  
  /**
   * Engenharia de features para melhorar detecção
   * @param {Array} dividendData - Dados de dividendos
   * @returns {Array} - Features extraídas
   */
  engineerFeatures(dividendData) {
    const features = [];
    
    for (let i = 0; i < dividendData.length; i++) {
      const item = dividendData[i];
      
      // Feature 1: Valor do dividendo
      const value = item.value;
      
      // Feature 2: Yield (se disponível)
      const yield_value = item.yield || (item.price ? (item.value / item.price) * 100 : 0);
      
      // Feature 3: Variação em relação ao anterior
      const prevValue = i > 0 ? dividendData[i - 1].value : value;
      const variation = ((value - prevValue) / prevValue) * 100;
      
      // Feature 4: Média móvel de 3 períodos
      let movingAvg = value;
      if (i >= 2) {
        movingAvg = (dividendData[i].value + dividendData[i - 1].value + dividendData[i - 2].value) / 3;
      }
      
      // Feature 5: Desvio da média móvel
      const deviationFromMA = ((value - movingAvg) / movingAvg) * 100;
      
      // Adicionar features
      features.push([
        value,
        yield_value,
        variation,
        movingAvg,
        deviationFromMA
      ]);
    }
    
    // Normalizar features
    return this.normalizeFeatures(features);
  }
  
  /**
   * Normaliza features para melhorar performance dos algoritmos
   * @param {Array} features - Array de features
   * @returns {Array} - Features normalizadas
   */
  normalizeFeatures(features) {
    // Transpor matriz para normalizar por coluna
    const transposed = this.transposeMatrix(features);
    
    // Normalizar cada coluna
    const normalizedTransposed = transposed.map(column => {
      const min = Math.min(...column);
      const max = Math.max(...column);
      
      // Evitar divisão por zero
      const range = max - min > 0 ? max - min : 1;
      
      return column.map(value => (value - min) / range);
    });
    
    // Transpor de volta
    return this.transposeMatrix(normalizedTransposed);
  }
  
  /**
   * Transpõe uma matriz
   * @param {Array} matrix - Matriz a ser transposta
   * @returns {Array} - Matriz transposta
   */
  transposeMatrix(matrix) {
    if (matrix.length === 0) return [];
    
    return matrix[0].map((_, colIndex) => 
      matrix.map(row => row[colIndex])
    );
  }
  
  /**
   * Detecta anomalias usando Z-score
   * @param {Array} values - Array de valores
   * @returns {Object} - Índices e scores de anomalias
   */
  detectAnomaliesWithZScore(values) {
    // Calcular média e desvio padrão
    const mean = this.calculateMean(values);
    const stdDev = this.calculateStdDev(values, mean);
    
    // Calcular Z-score para cada valor
    const zScores = values.map(value => Math.abs((value - mean) / stdDev));
    
    // Identificar anomalias
    const anomalyIndices = [];
    const anomalyScores = {};
    
    zScores.forEach((zScore, index) => {
      // Normalizar score para 0-1
      const normalizedScore = Math.min(zScore / (this.config.zScoreThreshold * 2), 1);
      anomalyScores[index] = normalizedScore;
      
      if (zScore > this.config.zScoreThreshold) {
        anomalyIndices.push(index);
      }
    });
    
    return {
      anomalyIndices,
      anomalyScores,
      threshold: this.config.zScoreThreshold
    };
  }
  
  /**
   * Detecta anomalias usando IQR (Intervalo Interquartil)
   * @param {Array} values - Array de valores
   * @returns {Object} - Índices e scores de anomalias
   */
  detectAnomaliesWithIQR(values) {
    // Ordenar valores
    const sortedValues = [...values].sort((a, b) => a - b);
    
    // Calcular quartis
    const q1Index = Math.floor(sortedValues.length * 0.25);
    const q3Index = Math.floor(sortedValues.length * 0.75);
    
    const q1 = sortedValues[q1Index];
    const q3 = sortedValues[q3Index];
    
    // Calcular IQR e limites
    const iqr = q3 - q1;
    const lowerBound = q1 - (iqr * this.config.iqrMultiplier);
    const upperBound = q3 + (iqr * this.config.iqrMultiplier);
    
    // Identificar anomalias
    const anomalyIndices = [];
    const anomalyScores = {};
    
    values.forEach((value, index) => {
      if (value < lowerBound || value > upperBound) {
        anomalyIndices.push(index);
        
        // Calcular score baseado na distância dos limites
        const distance = value < lowerBound 
          ? (lowerBound - value) / (lowerBound || 1) 
          : (value - upperBound) / (upperBound || 1);
        
        // Normalizar score para 0-1
        anomalyScores[index] = Math.min(distance, 1);
      } else {
        // Valores dentro dos limites têm score baixo
        const range = upperBound - lowerBound;
        const distanceFromCenter = Math.abs(value - (lowerBound + range / 2));
        anomalyScores[index] = (distanceFromCenter / range) * 0.5; // Máximo 0.5 para valores normais
      }
    });
    
    return {
      anomalyIndices,
      anomalyScores,
      threshold: this.config.iqrMultiplier
    };
  }
  
  /**
   * Detecta anomalias usando Isolation Forest
   * @param {Array} features - Array de features
   * @returns {Promise<Object>} - Índices e scores de anomalias
   */
  async detectAnomaliesWithIsolationForest(features) {
    try {
      // Implementação simplificada de Isolation Forest
      // Em produção, seria ideal usar uma biblioteca como sklearn via TensorFlow.js ou WebAssembly
      
      // Simular scores de anomalia baseados em distância da média
      const anomalyScores = {};
      const anomalyIndices = [];
      
      // Transpor features para calcular médias por coluna
      const transposed = this.transposeMatrix(features);
      const means = transposed.map(column => this.calculateMean(column));
      
      // Calcular distância euclidiana de cada ponto à média
      features.forEach((feature, index) => {
        let sumSquaredDiff = 0;
        
        for (let i = 0; i < feature.length; i++) {
          sumSquaredDiff += Math.pow(feature[i] - means[i], 2);
        }
        
        const distance = Math.sqrt(sumSquaredDiff);
        
        // Normalizar score para 0-1 usando sigmoid
        const score = 1 / (1 + Math.exp(-distance + 3));
        anomalyScores[index] = score;
        
        // Determinar anomalias baseado no threshold de contaminação
        if (score > 1 - this.config.contamination) {
          anomalyIndices.push(index);
        }
      });
      
      return {
        anomalyIndices,
        anomalyScores,
        threshold: 1 - this.config.contamination
      };
    } catch (error) {
      console.error('Erro ao detectar anomalias com Isolation Forest:', error);
      
      // Fallback para método estatístico
      const values = features.map(f => f[0]); // Usar primeira feature
      return this.detectAnomaliesWithZScore(values);
    }
  }
  
  /**
   * Detecta anomalias usando Autoencoder
   * @param {Array} features - Array de features
   * @returns {Promise<Object>} - Índices e scores de anomalias
   */
  async detectAnomaliesWithAutoencoder(features) {
    try {
      // Verificar se temos autoencoder
      if (!this.autoencoder) {
        // Criar e treinar autoencoder
        await this.createAndTrainAutoencoder(features);
      }
      
      // Converter features para tensor
      const inputTensor = tf.tensor2d(features);
      
      // Fazer previsão (reconstrução)
      const outputTensor = this.autoencoder.predict(inputTensor);
      
      // Calcular erro de reconstrução
      const inputArray = inputTensor.arraySync();
      const outputArray = outputTensor.arraySync();
      
      const reconstructionErrors = inputArray.map((input, i) => {
        const output = outputArray[i];
        
        // Calcular erro quadrático médio
        let sumSquaredError = 0;
        for (let j = 0; j < input.length; j++) {
          sumSquaredError += Math.pow(input[j] - output[j], 2);
        }
        
        return Math.sqrt(sumSquaredError / input.length);
      });
      
      // Calcular threshold baseado na distribuição dos erros
      const mean = this.calculateMean(reconstructionErrors);
      const stdDev = this.calculateStdDev(reconstructionErrors, mean);
      const threshold = mean + (stdDev * 2);
      
      // Identificar anomalias
      const anomalyIndices = [];
      const anomalyScores = {};
      
      reconstructionErrors.forEach((error, index) => {
        // Normalizar score para 0-1
        const normalizedScore = Math.min(error / (threshold * 1.5), 1);
        anomalyScores[index] = normalizedScore;
        
        if (error > threshold) {
          anomalyIndices.push(index);
        }
      });
      
      // Liberar tensores
      inputTensor.dispose();
      outputTensor.dispose();
      
      return {
        anomalyIndices,
        anomalyScores,
        threshold
      };
    } catch (error) {
      console.error('Erro ao detectar anomalias com Autoencoder:', error);
      
      // Fallback para método estatístico
      const values = features.map(f => f[0]); // Usar primeira feature
      return this.detectAnomaliesWithZScore(values);
    }
  }
  
  /**
   * Cria e treina um autoencoder para detecção de anomalias
   * @param {Array} features - Array de features para treinamento
   * @returns {Promise<boolean>} - Sucesso do treinamento
   */
  async createAndTrainAutoencoder(features) {
    try {
      console.log('Criando e treinando autoencoder...');
      
      // Obter dimensões
      const inputDim = features[0].length;
      const encodingDim = Math.min(this.config.encodingDim, inputDim - 1);
      
      // Criar modelo
      const input = tf.input({ shape: [inputDim] });
      
      // Encoder
      const encoded = tf.layers.dense({
        units: encodingDim,
        activation: 'relu'
      }).apply(input);
      
      // Decoder
      const decoded = tf.layers.dense({
        units: inputDim,
        activation: 'sigmoid'
      }).apply(encoded);
      
      // Criar modelo
      this.autoencoder = tf.model({ inputs: input, outputs: decoded });
      
      // Compilar modelo
      this.autoencoder.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError'
      });
      
      // Converter features para tensor
      const inputTensor = tf.tensor2d(features);
      
      // Treinar modelo
      await this.autoencoder.fit(inputTensor, inputTensor, {
        epochs: this.config.epochs,
        batchSize: Math.min(this.config.batchSize, features.length),
        shuffle: true,
        verbose: 0
      });
      
      // Salvar modelo
      await this.autoencoder.save('localstorage://lotus-invest-anomaly-detector');
      
      // Liberar tensor
      inputTensor.dispose();
      
      console.log('Autoencoder treinado com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao treinar autoencoder:', error);
      return false;
    }
  }
  
  /**
   * Combina detecções de anomalias de múltiplos métodos
   * @param {Object} methods - Resultados de diferentes métodos
   * @returns {Array} - Índices de anomalias combinados
   */
  combineAnomalyDetections(methods) {
    const allIndices = new Set();
    const indexCounts = {};
    const indexScores = {};
    
    // Coletar todos os índices e contar ocorrências
    Object.values(methods).forEach(method => {
      method.anomalyIndices.forEach(index => {
        allIndices.add(index);
        
        if (indexCounts[index]) {
          indexCounts[index]++;
          indexScores[index] += method.anomalyScores[index] || 0;
        } else {
          indexCounts[index] = 1;
          indexScores[index] = method.anomalyScores[index] || 0;
        }
      });
    });
    
    // Calcular média de scores
    Object.keys(indexScores).forEach(index => {
      indexScores[index] /= indexCounts[index];
    });
    
    // Aplicar método de ensemble
    const methodCount = Object.keys(methods).length;
    const combinedIndices = [];
    
    if (this.config.ensembleMethod === 'majority') {
      // Maioria dos métodos deve detectar
      const threshold = Math.ceil(methodCount / 2);
      
      allIndices.forEach(index => {
        if (indexCounts[index] >= threshold) {
          combinedIndices.push(index);
        }
      });
    } else if (this.config.ensembleMethod === 'weighted') {
      // Ponderado por score
      const threshold = 0.6; // Score médio mínimo
      
      allIndices.forEach(index => {
        if (indexScores[index] >= threshold) {
          combinedIndices.push(index);
        }
      });
    } else {
      // Qualquer método pode detectar
      combinedIndices.push(...allIndices);
    }
    
    return combinedIndices;
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
   * @param {Number} mean - Média (opcional)
   * @returns {Number} - Desvio padrão
   */
  calculateStdDev(values, mean = null) {
    if (!values || values.length <= 1) return 0;
    
    const avg = mean !== null ? mean : this.calculateMean(values);
    
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Verifica se um item em cache ainda é válido
   * @param {Number} timestamp - Timestamp do item em cache
   * @returns {Boolean} - Validade do cache
   */
  isCacheValid(timestamp) {
    const now = Date.now();
    return (now - timestamp) < this.config.cacheExpiration;
  }
  
  /**
   * Limpa o cache de resultados
   * @returns {Boolean} - Sucesso da operação
   */
  clearCache() {
    try {
      this.cache = {};
      return true;
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      return false;
    }
  }
  
  /**
   * Salva o modelo treinado
   * @returns {Promise<boolean>} - Sucesso do salvamento
   */
  async saveModel() {
    if (!this.autoencoder) {
      console.warn('Nenhum modelo para salvar');
      return false;
    }
    
    try {
      await this.autoencoder.save('localstorage://lotus-invest-anomaly-detector');
      return true;
    } catch (error) {
      console.error('Erro ao salvar modelo:', error);
      return false;
    }
  }
  
  /**
   * Gera dados sintéticos para testes
   * @param {Number} count - Número de pontos a gerar
   * @param {Number} anomalyRate - Taxa de anomalias (0-1)
   * @returns {Array} - Dados sintéticos
   */
  generateSyntheticData(count = 100, anomalyRate = 0.05) {
    const data = [];
    const anomalyCount = Math.round(count * anomalyRate);
    
    // Parâmetros para distribuição normal
    const mean = 0.5;
    const stdDev = 0.1;
    
    // Gerar dados normais
    for (let i = 0; i < count - anomalyCount; i++) {
      // Gerar valor da distribuição normal
      let value = this.generateNormalRandom(mean, stdDev);
      
      // Garantir que está entre 0 e 1
      value = Math.max(0.1, Math.min(0.9, value));
      
      data.push(value);
    }
    
    // Gerar anomalias
    for (let i = 0; i < anomalyCount; i++) {
      // 50% de chance de ser anomalia alta ou baixa
      const isHigh = Math.random() > 0.5;
      
      let value;
      if (isHigh) {
        // Anomalia alta (entre 0.9 e 1.5)
        value = 0.9 + Math.random() * 0.6;
      } else {
        // Anomalia baixa (entre 0 e 0.1)
        value = Math.random() * 0.1;
      }
      
      data.push(value);
    }
    
    // Embaralhar dados
    this.shuffleArray(data);
    
    return data;
  }
  
  /**
   * Gera um número aleatório com distribuição normal
   * @param {Number} mean - Média
   * @param {Number} stdDev - Desvio padrão
   * @returns {Number} - Número aleatório
   */
  generateNormalRandom(mean, stdDev) {
    // Método Box-Muller
    const u1 = Math.random();
    const u2 = Math.random();
    
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    
    return z0 * stdDev + mean;
  }
  
  /**
   * Embaralha um array in-place
   * @param {Array} array - Array a ser embaralhado
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

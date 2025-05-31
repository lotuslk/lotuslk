// src/pipeline/dataPipeline.js
import { DataCollector } from '../services/dataCollector';
import { PriceForecaster } from '../models/priceForecaster';
import { SentimentAnalyzer } from '../models/sentimentAnalyzer';
import { AnomalyDetector } from '../models/anomalyDetector';

/**
 * Pipeline de dados para integração de modelos de ML
 * 
 * Esta classe coordena o fluxo de dados entre coleta, processamento,
 * análise e visualização, integrando os diferentes modelos de ML.
 */
export class DataPipeline {
  constructor(config = {}) {
    this.config = {
      forecastHorizon: config.forecastHorizon || 30, // Dias para previsão
      sentimentLookback: config.sentimentLookback || 14, // Dias para análise de sentimento
      anomalyThreshold: config.anomalyThreshold || 0.8, // Limiar para detecção de anomalias
      ...config
    };
    
    // Inicializar componentes do pipeline
    this.dataCollector = new DataCollector(config.collectorConfig);
    this.priceForecaster = new PriceForecaster(config.forecasterConfig);
    this.sentimentAnalyzer = new SentimentAnalyzer(config.sentimentConfig);
    this.anomalyDetector = new AnomalyDetector(config.anomalyConfig);
    
    // Cache para resultados processados
    this.cache = {
      forecasts: {},
      sentiments: {},
      anomalies: {}
    };
  }
  
  /**
   * Inicializa o pipeline carregando modelos e dados necessários
   * @returns {Promise<boolean>} - Sucesso da inicialização
   */
  async initialize() {
    try {
      // Carregar modelos pré-treinados
      const forecastLoaded = await this.priceForecaster.loadModel()
        .catch(() => false);
      
      const sentimentLoaded = await this.sentimentAnalyzer.loadModel()
        .catch(() => false);
      
      const anomalyLoaded = await this.anomalyDetector.loadModel()
        .catch(() => false);
      
      console.log('Pipeline inicializado:', {
        forecastLoaded,
        sentimentLoaded,
        anomalyLoaded
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao inicializar pipeline:', error);
      return false;
    }
  }
  
  /**
   * Processa um FII específico, gerando previsões, análise de sentimento e detecção de anomalias
   * @param {String} ticker - Código do FII
   * @param {Object} options - Opções de processamento
   * @returns {Promise<Object>} - Resultados do processamento
   */
  async processFii(ticker, options = {}) {
    const startDate = options.startDate || this.getDefaultStartDate();
    const endDate = options.endDate || new Date().toISOString().split('T')[0];
    
    try {
      // 1. Coletar dados históricos
      const historicalData = await this.dataCollector.getHistoricalPrices(ticker, startDate, endDate);
      const dividendData = await this.dataCollector.getHistoricalDividends(ticker, startDate, endDate);
      
      // 2. Gerar previsões de preço
      const priceForecast = await this.generatePriceForecast(ticker, historicalData);
      
      // 3. Analisar sentimento de notícias
      const sentimentAnalysis = await this.analyzeSentiment(ticker);
      
      // 4. Detectar anomalias em dividendos
      const anomalies = await this.detectAnomalies(ticker, dividendData);
      
      // 5. Gerar recomendações personalizadas
      const recommendations = this.generateRecommendations(ticker, {
        historicalData,
        dividendData,
        priceForecast,
        sentimentAnalysis,
        anomalies
      });
      
      // 6. Armazenar resultados em cache
      this.updateCache(ticker, {
        priceForecast,
        sentimentAnalysis,
        anomalies,
        recommendations,
        lastUpdated: new Date().toISOString()
      });
      
      return {
        ticker,
        historicalData: historicalData.slice(-30), // Últimos 30 dias
        priceForecast,
        sentimentAnalysis,
        anomalies,
        recommendations
      };
    } catch (error) {
      console.error(`Erro ao processar ${ticker}:`, error);
      throw new Error(`Falha ao processar dados para ${ticker}`);
    }
  }
  
  /**
   * Gera previsões de preço para um FII
   * @param {String} ticker - Código do FII
   * @param {Array} historicalData - Dados históricos de preço
   * @returns {Promise<Object>} - Previsões de preço
   */
  async generatePriceForecast(ticker, historicalData) {
    try {
      // Verificar cache
      if (this.cache.forecasts[ticker] && this.isCacheValid(this.cache.forecasts[ticker].timestamp)) {
        return this.cache.forecasts[ticker].data;
      }
      
      // Extrair preços para treinamento
      const prices = historicalData.map(item => item.price);
      
      // Se o modelo não estiver treinado, treinar com dados históricos
      if (!this.priceForecaster.trained) {
        await this.priceForecaster.train(prices);
      }
      
      // Gerar previsões
      const forecastDays = this.config.forecastHorizon;
      const predictions = await this.priceForecaster.predict(prices, forecastDays);
      
      // Calcular métricas de confiança
      const evaluation = await this.priceForecaster.evaluate(prices.slice(-Math.floor(prices.length * 0.2)));
      
      // Gerar datas para as previsões
      const lastDate = new Date(historicalData[historicalData.length - 1].date);
      const forecastDates = [];
      
      for (let i = 1; i <= forecastDays; i++) {
        const date = new Date(lastDate);
        date.setDate(date.getDate() + i);
        
        // Pular fins de semana
        while (date.getDay() === 0 || date.getDay() === 6) {
          date.setDate(date.getDate() + 1);
        }
        
        forecastDates.push(date.toISOString().split('T')[0]);
      }
      
      // Formatar resultado
      const forecast = {
        ticker,
        predictions: predictions.map((price, index) => ({
          date: forecastDates[index],
          price: parseFloat(price.toFixed(2))
        })),
        metrics: {
          rmse: evaluation.rmse.toFixed(4),
          mape: evaluation.mape.toFixed(2) + '%',
          confidence: this.calculateConfidenceLevel(evaluation.mape)
        },
        trend: this.calculateTrend(predictions)
      };
      
      // Atualizar cache
      this.cache.forecasts[ticker] = {
        data: forecast,
        timestamp: Date.now()
      };
      
      return forecast;
    } catch (error) {
      console.error(`Erro ao gerar previsão para ${ticker}:`, error);
      return {
        ticker,
        predictions: [],
        metrics: { error: error.message },
        trend: 'neutral'
      };
    }
  }
  
  /**
   * Analisa o sentimento de notícias relacionadas a um FII
   * @param {String} ticker - Código do FII
   * @returns {Promise<Object>} - Análise de sentimento
   */
  async analyzeSentiment(ticker) {
    try {
      // Verificar cache
      if (this.cache.sentiments[ticker] && this.isCacheValid(this.cache.sentiments[ticker].timestamp)) {
        return this.cache.sentiments[ticker].data;
      }
      
      // Buscar notícias recentes
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = this.getDateDaysAgo(this.config.sentimentLookback);
      
      // Esta função será implementada no modelo SentimentAnalyzer
      const sentimentResults = await this.sentimentAnalyzer.analyzeNewsSentiment(ticker, startDate, endDate);
      
      // Calcular sentimento agregado
      const aggregatedSentiment = this.calculateAggregatedSentiment(sentimentResults.articles);
      
      // Formatar resultado
      const sentiment = {
        ticker,
        aggregated: aggregatedSentiment,
        articles: sentimentResults.articles.slice(0, 5), // Top 5 notícias mais relevantes
        wordcloud: sentimentResults.wordcloud,
        trend: this.mapSentimentToTrend(aggregatedSentiment.score)
      };
      
      // Atualizar cache
      this.cache.sentiments[ticker] = {
        data: sentiment,
        timestamp: Date.now()
      };
      
      return sentiment;
    } catch (error) {
      console.error(`Erro ao analisar sentimento para ${ticker}:`, error);
      return {
        ticker,
        aggregated: { score: 0, label: 'neutral', confidence: 0 },
        articles: [],
        wordcloud: [],
        trend: 'neutral'
      };
    }
  }
  
  /**
   * Detecta anomalias em dados de dividendos
   * @param {String} ticker - Código do FII
   * @param {Array} dividendData - Dados históricos de dividendos
   * @returns {Promise<Object>} - Anomalias detectadas
   */
  async detectAnomalies(ticker, dividendData) {
    try {
      // Verificar cache
      if (this.cache.anomalies[ticker] && this.isCacheValid(this.cache.anomalies[ticker].timestamp)) {
        return this.cache.anomalies[ticker].data;
      }
      
      // Esta função será implementada no modelo AnomalyDetector
      const anomalyResults = await this.anomalyDetector.detectDividendAnomalies(dividendData);
      
      // Calcular estatísticas
      const stats = this.calculateAnomalyStats(anomalyResults.anomalies, dividendData);
      
      // Formatar resultado
      const anomalies = {
        ticker,
        anomalies: anomalyResults.anomalies,
        stats,
        riskLevel: this.calculateRiskLevel(stats)
      };
      
      // Atualizar cache
      this.cache.anomalies[ticker] = {
        data: anomalies,
        timestamp: Date.now()
      };
      
      return anomalies;
    } catch (error) {
      console.error(`Erro ao detectar anomalias para ${ticker}:`, error);
      return {
        ticker,
        anomalies: [],
        stats: { count: 0, percentage: 0 },
        riskLevel: 'unknown'
      };
    }
  }
  
  /**
   * Gera recomendações personalizadas com base em todos os dados analisados
   * @param {String} ticker - Código do FII
   * @param {Object} data - Dados analisados
   * @returns {Object} - Recomendações personalizadas
   */
  generateRecommendations(ticker, data) {
    try {
      // Extrair sinais dos diferentes modelos
      const priceTrend = data.priceForecast?.trend || 'neutral';
      const sentimentTrend = data.sentimentAnalysis?.trend || 'neutral';
      const riskLevel = data.anomalies?.riskLevel || 'medium';
      
      // Calcular pontuação combinada
      let score = 0;
      
      // Pontuação baseada na tendência de preço
      if (priceTrend === 'strong_up') score += 2;
      else if (priceTrend === 'up') score += 1;
      else if (priceTrend === 'down') score -= 1;
      else if (priceTrend === 'strong_down') score -= 2;
      
      // Pontuação baseada no sentimento
      if (sentimentTrend === 'very_positive') score += 2;
      else if (sentimentTrend === 'positive') score += 1;
      else if (sentimentTrend === 'negative') score -= 1;
      else if (sentimentTrend === 'very_negative') score -= 2;
      
      // Ajuste baseado no risco
      if (riskLevel === 'high') score -= 1;
      else if (riskLevel === 'low') score += 1;
      
      // Determinar recomendação
      let recommendation;
      if (score >= 3) recommendation = 'strong_buy';
      else if (score >= 1) recommendation = 'buy';
      else if (score <= -3) recommendation = 'strong_sell';
      else if (score <= -1) recommendation = 'sell';
      else recommendation = 'hold';
      
      // Gerar justificativas
      const reasons = [];
      
      if (priceTrend.includes('up')) {
        reasons.push(`Previsão de alta de preço nos próximos ${this.config.forecastHorizon} dias`);
      } else if (priceTrend.includes('down')) {
        reasons.push(`Previsão de queda de preço nos próximos ${this.config.forecastHorizon} dias`);
      }
      
      if (sentimentTrend.includes('positive')) {
        reasons.push('Sentimento positivo nas notícias recentes');
      } else if (sentimentTrend.includes('negative')) {
        reasons.push('Sentimento negativo nas notícias recentes');
      }
      
      if (riskLevel === 'high') {
        reasons.push('Anomalias detectadas nos dividendos recentes');
      } else if (riskLevel === 'low') {
        reasons.push('Padrão estável de dividendos sem anomalias');
      }
      
      return {
        ticker,
        recommendation,
        score,
        reasons,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Erro ao gerar recomendações para ${ticker}:`, error);
      return {
        ticker,
        recommendation: 'hold',
        score: 0,
        reasons: ['Dados insuficientes para recomendação precisa'],
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Processa múltiplos FIIs em paralelo
   * @param {Array} tickers - Lista de códigos de FIIs
   * @param {Object} options - Opções de processamento
   * @returns {Promise<Object>} - Resultados do processamento por ticker
   */
  async processBatch(tickers, options = {}) {
    const results = {};
    const errors = [];
    
    // Processar em paralelo com Promise.all
    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          results[ticker] = await this.processFii(ticker, options);
        } catch (error) {
          console.error(`Erro ao processar ${ticker}:`, error);
          errors.push({ ticker, error: error.message });
          results[ticker] = null;
        }
      })
    );
    
    return { results, errors };
  }
  
  /**
   * Atualiza o cache de resultados
   * @param {String} ticker - Código do FII
   * @param {Object} data - Dados a serem armazenados
   */
  updateCache(ticker, data) {
    const timestamp = Date.now();
    
    if (data.priceForecast) {
      this.cache.forecasts[ticker] = {
        data: data.priceForecast,
        timestamp
      };
    }
    
    if (data.sentimentAnalysis) {
      this.cache.sentiments[ticker] = {
        data: data.sentimentAnalysis,
        timestamp
      };
    }
    
    if (data.anomalies) {
      this.cache.anomalies[ticker] = {
        data: data.anomalies,
        timestamp
      };
    }
  }
  
  /**
   * Verifica se um item em cache ainda é válido
   * @param {Number} timestamp - Timestamp do item em cache
   * @returns {Boolean} - Validade do cache
   */
  isCacheValid(timestamp) {
    const now = Date.now();
    const maxAge = 4 * 60 * 60 * 1000; // 4 horas em ms
    return (now - timestamp) < maxAge;
  }
  
  /**
   * Calcula a tendência com base nas previsões de preço
   * @param {Array} predictions - Array de preços previstos
   * @returns {String} - Tendência (strong_up, up, neutral, down, strong_down)
   */
  calculateTrend(predictions) {
    if (!predictions || predictions.length < 2) return 'neutral';
    
    const first = predictions[0];
    const last = predictions[predictions.length - 1];
    const change = (last - first) / first;
    
    if (change > 0.05) return 'strong_up';
    if (change > 0.01) return 'up';
    if (change < -0.05) return 'strong_down';
    if (change < -0.01) return 'down';
    return 'neutral';
  }
  
  /**
   * Calcula o nível de confiança com base no MAPE
   * @param {Number} mape - Mean Absolute Percentage Error
   * @returns {String} - Nível de confiança (high, medium, low)
   */
  calculateConfidenceLevel(mape) {
    if (mape < 3) return 'high';
    if (mape < 8) return 'medium';
    return 'low';
  }
  
  /**
   * Calcula o sentimento agregado a partir de múltiplos artigos
   * @param {Array} articles - Array de artigos com análise de sentimento
   * @returns {Object} - Sentimento agregado
   */
  calculateAggregatedSentiment(articles) {
    if (!articles || articles.length === 0) {
      return { score: 0, label: 'neutral', confidence: 0 };
    }
    
    // Calcular média ponderada por relevância
    let totalScore = 0;
    let totalWeight = 0;
    
    articles.forEach(article => {
      const weight = article.relevance || 1;
      totalScore += article.sentiment.score * weight;
      totalWeight += weight;
    });
    
    const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    
    // Determinar label
    let label;
    if (avgScore > 0.6) label = 'very_positive';
    else if (avgScore > 0.2) label = 'positive';
    else if (avgScore < -0.6) label = 'very_negative';
    else if (avgScore < -0.2) label = 'negative';
    else label = 'neutral';
    
    // Calcular confiança
    const confidence = Math.min(0.5 + (articles.length / 20), 0.95);
    
    return {
      score: parseFloat(avgScore.toFixed(2)),
      label,
      confidence: parseFloat(confidence.toFixed(2))
    };
  }
  
  /**
   * Mapeia score de sentimento para tendência
   * @param {Number} score - Score de sentimento (-1 a 1)
   * @returns {String} - Tendência
   */
  mapSentimentToTrend(score) {
    if (score > 0.6) return 'very_positive';
    if (score > 0.2) return 'positive';
    if (score < -0.6) return 'very_negative';
    if (score < -0.2) return 'negative';
    return 'neutral';
  }
  
  /**
   * Calcula estatísticas de anomalias
   * @param {Array} anomalies - Array de anomalias detectadas
   * @param {Array} dividendData - Dados completos de dividendos
   * @returns {Object} - Estatísticas
   */
  calculateAnomalyStats(anomalies, dividendData) {
    if (!anomalies || !dividendData || dividendData.length === 0) {
      return { count: 0, percentage: 0 };
    }
    
    const count = anomalies.length;
    const percentage = (count / dividendData.length) * 100;
    
    return {
      count,
      percentage: parseFloat(percentage.toFixed(2))
    };
  }
  
  /**
   * Calcula nível de risco com base nas estatísticas de anomalias
   * @param {Object} stats - Estatísticas de anomalias
   * @returns {String} - Nível de risco (low, medium, high)
   */
  calculateRiskLevel(stats) {
    if (!stats) return 'unknown';
    
    if (stats.percentage > 15) return 'high';
    if (stats.percentage > 5) return 'medium';
    return 'low';
  }
  
  /**
   * Obtém data padrão para início da análise (1 ano atrás)
   * @returns {String} - Data no formato YYYY-MM-DD
   */
  getDefaultStartDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return date.toISOString().split('T')[0];
  }
  
  /**
   * Obtém data há X dias atrás
   * @param {Number} days - Número de dias
   * @returns {String} - Data no formato YYYY-MM-DD
   */
  getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
  
  /**
   * Limpa o cache de resultados
   * @param {String} type - Tipo de cache (forecasts, sentiments, anomalies, all)
   * @returns {Boolean} - Sucesso da operação
   */
  clearCache(type = 'all') {
    try {
      if (type === 'all' || type === 'forecasts') {
        this.cache.forecasts = {};
      }
      
      if (type === 'all' || type === 'sentiments') {
        this.cache.sentiments = {};
      }
      
      if (type === 'all' || type === 'anomalies') {
        this.cache.anomalies = {};
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      return false;
    }
  }
}

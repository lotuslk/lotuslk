// src/models/recommendationEngine.js
import * as tf from '@tensorflow/tfjs';

/**
 * Classe para geração de recomendações personalizadas de investimento
 * 
 * Esta implementação integra os resultados dos modelos de previsão de preços,
 * análise de sentimento e detecção de anomalias para gerar recomendações
 * de investimento personalizadas para FIIs.
 */
export class RecommendationEngine {
  constructor(config = {}) {
    this.config = {
      // Pesos para diferentes fatores na recomendação
      weights: {
        priceForecasting: config.weights?.priceForecasting || 0.4,
        sentiment: config.weights?.sentiment || 0.3,
        anomalies: config.weights?.anomalies || 0.2,
        fundamentals: config.weights?.fundamentals || 0.1
      },
      
      // Limiares para recomendações
      thresholds: {
        strongBuy: config.thresholds?.strongBuy || 0.7,
        buy: config.thresholds?.buy || 0.55,
        sell: config.thresholds?.sell || -0.55,
        strongSell: config.thresholds?.strongSell || -0.7
      },
      
      // Configurações de personalização
      personalization: {
        riskTolerance: config.personalization?.riskTolerance || 'moderate', // low, moderate, high
        investmentHorizon: config.personalization?.investmentHorizon || 'medium', // short, medium, long
        incomePreference: config.personalization?.incomePreference || 0.5, // 0-1 (dividendos vs. valorização)
        sectorPreferences: config.personalization?.sectorPreferences || {}
      },
      
      // Configurações gerais
      useCache: config.useCache !== undefined ? config.useCache : true,
      cacheExpiration: config.cacheExpiration || 24 * 60 * 60 * 1000, // 24 horas em ms
      ...config
    };
    
    this.cache = {};
    this.initialized = false;
  }
  
  /**
   * Inicializa o motor de recomendações
   * @returns {Promise<boolean>} - Sucesso da inicialização
   */
  async initialize() {
    try {
      if (this.initialized) return true;
      
      // Carregar modelos auxiliares se necessário
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Erro ao inicializar motor de recomendações:', error);
      return false;
    }
  }
  
  /**
   * Gera recomendações personalizadas para um FII
   * @param {String} ticker - Código do FII
   * @param {Object} mlResults - Resultados dos modelos de ML
   * @param {Object} fundamentalData - Dados fundamentalistas
   * @param {Object} userPreferences - Preferências do usuário
   * @returns {Promise<Object>} - Recomendação personalizada
   */
  async generateRecommendation(ticker, mlResults, fundamentalData, userPreferences = {}) {
    try {
      // Verificar inicialização
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Verificar cache
      const cacheKey = `recommendation-${ticker}-${JSON.stringify(userPreferences)}`;
      if (this.config.useCache && this.cache[cacheKey] && this.isCacheValid(this.cache[cacheKey].timestamp)) {
        return this.cache[cacheKey].data;
      }
      
      // Verificar dados
      if (!mlResults) {
        throw new Error('Resultados de ML não fornecidos');
      }
      
      // Aplicar preferências do usuário
      const effectivePreferences = this.mergePreferences(userPreferences);
      
      // Calcular scores individuais
      const priceScore = this.calculatePriceScore(mlResults.priceForecast);
      const sentimentScore = this.calculateSentimentScore(mlResults.sentimentAnalysis);
      const anomalyScore = this.calculateAnomalyScore(mlResults.anomalies);
      const fundamentalScore = this.calculateFundamentalScore(fundamentalData);
      
      // Calcular score combinado com pesos ajustados por preferências
      const weights = this.adjustWeightsByPreferences(effectivePreferences);
      
      const combinedScore = (
        priceScore * weights.priceForecasting +
        sentimentScore * weights.sentiment +
        anomalyScore * weights.anomalies +
        fundamentalScore * weights.fundamentals
      );
      
      // Determinar recomendação
      const recommendation = this.determineRecommendation(combinedScore);
      
      // Gerar justificativas
      const reasons = this.generateReasons(
        ticker,
        recommendation,
        priceScore,
        sentimentScore,
        anomalyScore,
        fundamentalScore,
        mlResults
      );
      
      // Formatar resultado
      const result = {
        ticker,
        recommendation,
        score: parseFloat(combinedScore.toFixed(2)),
        confidence: this.calculateConfidence(mlResults),
        reasons,
        components: {
          priceScore: parseFloat(priceScore.toFixed(2)),
          sentimentScore: parseFloat(sentimentScore.toFixed(2)),
          anomalyScore: parseFloat(anomalyScore.toFixed(2)),
          fundamentalScore: parseFloat(fundamentalScore.toFixed(2))
        },
        appliedPreferences: effectivePreferences,
        timestamp: new Date().toISOString()
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
      console.error(`Erro ao gerar recomendação para ${ticker}:`, error);
      return {
        ticker,
        recommendation: 'hold',
        score: 0,
        confidence: 'low',
        reasons: ['Não foi possível gerar uma recomendação devido a um erro.'],
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Mescla preferências do usuário com padrões
   * @param {Object} userPreferences - Preferências do usuário
   * @returns {Object} - Preferências efetivas
   */
  mergePreferences(userPreferences) {
    return {
      riskTolerance: userPreferences.riskTolerance || this.config.personalization.riskTolerance,
      investmentHorizon: userPreferences.investmentHorizon || this.config.personalization.investmentHorizon,
      incomePreference: userPreferences.incomePreference !== undefined ? 
        userPreferences.incomePreference : this.config.personalization.incomePreference,
      sectorPreferences: {
        ...this.config.personalization.sectorPreferences,
        ...(userPreferences.sectorPreferences || {})
      }
    };
  }
  
  /**
   * Ajusta pesos com base nas preferências
   * @param {Object} preferences - Preferências do usuário
   * @returns {Object} - Pesos ajustados
   */
  adjustWeightsByPreferences(preferences) {
    const weights = { ...this.config.weights };
    
    // Ajustar com base na tolerância a risco
    if (preferences.riskTolerance === 'low') {
      weights.anomalies *= 1.5; // Maior peso para anomalias (risco)
      weights.fundamentals *= 1.3; // Maior peso para fundamentos
      weights.priceForecasting *= 0.8; // Menor peso para previsões (mais voláteis)
    } else if (preferences.riskTolerance === 'high') {
      weights.priceForecasting *= 1.3; // Maior peso para previsões
      weights.sentiment *= 1.2; // Maior peso para sentimento
      weights.anomalies *= 0.7; // Menor peso para anomalias
    }
    
    // Ajustar com base no horizonte de investimento
    if (preferences.investmentHorizon === 'short') {
      weights.sentiment *= 1.3; // Maior peso para sentimento (curto prazo)
      weights.priceForecasting *= 1.2; // Maior peso para previsões de preço
      weights.fundamentals *= 0.7; // Menor peso para fundamentos
    } else if (preferences.investmentHorizon === 'long') {
      weights.fundamentals *= 1.5; // Maior peso para fundamentos
      weights.anomalies *= 1.2; // Maior peso para anomalias
      weights.sentiment *= 0.8; // Menor peso para sentimento
    }
    
    // Ajustar com base na preferência por renda
    if (preferences.incomePreference > 0.7) {
      // Preferência por dividendos
      weights.anomalies *= 1.3; // Maior peso para anomalias em dividendos
    } else if (preferences.incomePreference < 0.3) {
      // Preferência por valorização
      weights.priceForecasting *= 1.3; // Maior peso para previsões de preço
    }
    
    // Normalizar pesos para somar 1
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    Object.keys(weights).forEach(key => {
      weights[key] = weights[key] / sum;
    });
    
    return weights;
  }
  
  /**
   * Calcula score com base na previsão de preços
   * @param {Object} forecast - Previsão de preços
   * @returns {Number} - Score (-1 a 1)
   */
  calculatePriceScore(forecast) {
    if (!forecast || !forecast.predictions || forecast.predictions.length === 0) {
      return 0;
    }
    
    // Calcular variação percentual prevista
    const firstPrice = forecast.predictions[0].price;
    const lastPrice = forecast.predictions[forecast.predictions.length - 1].price;
    const percentChange = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    // Normalizar para score entre -1 e 1
    // Variação de -10% a +10% mapeada para -1 a 1
    let score = percentChange / 10;
    
    // Limitar entre -1 e 1
    score = Math.max(-1, Math.min(1, score));
    
    // Ajustar com base na confiança da previsão
    if (forecast.metrics && forecast.metrics.confidence) {
      const confidenceMultiplier = 
        forecast.metrics.confidence === 'high' ? 1.0 :
        forecast.metrics.confidence === 'medium' ? 0.8 : 0.6;
      
      score *= confidenceMultiplier;
    }
    
    return score;
  }
  
  /**
   * Calcula score com base na análise de sentimento
   * @param {Object} sentiment - Análise de sentimento
   * @returns {Number} - Score (-1 a 1)
   */
  calculateSentimentScore(sentiment) {
    if (!sentiment || !sentiment.aggregated) {
      return 0;
    }
    
    // Usar score de sentimento diretamente se disponível
    if (sentiment.aggregated.score !== undefined) {
      return sentiment.aggregated.score;
    }
    
    // Caso contrário, mapear label para score
    const labelScores = {
      'very_positive': 0.8,
      'positive': 0.5,
      'neutral': 0,
      'negative': -0.5,
      'very_negative': -0.8
    };
    
    const score = labelScores[sentiment.aggregated.label] || 0;
    
    // Ajustar com base na confiança
    return score * (sentiment.aggregated.confidence || 0.7);
  }
  
  /**
   * Calcula score com base na detecção de anomalias
   * @param {Object} anomalies - Detecção de anomalias
   * @returns {Number} - Score (-1 a 1)
   */
  calculateAnomalyScore(anomalies) {
    if (!anomalies || !anomalies.anomalies) {
      return 0;
    }
    
    // Se não há anomalias, score neutro
    if (anomalies.anomalies.length === 0) {
      return 0.1; // Ligeiramente positivo (ausência de anomalias é bom)
    }
    
    // Calcular score baseado nas anomalias detectadas
    let totalScore = 0;
    
    anomalies.anomalies.forEach(anomaly => {
      // Determinar impacto da anomalia
      let anomalyImpact = 0;
      
      // Anomalias de valor alto são positivas, baixo são negativas
      if (anomaly.type === 'high_value') {
        anomalyImpact = 0.5; // Impacto positivo
      } else if (anomaly.type === 'low_value') {
        anomalyImpact = -0.5; // Impacto negativo
      }
      
      // Ajustar pelo desvio percentual
      anomalyImpact *= Math.min(1, Math.abs(anomaly.deviation) / 50);
      
      // Ajustar pela severidade
      const severityMultiplier = 
        anomaly.severity === 'high' ? 1.0 :
        anomaly.severity === 'medium' ? 0.7 : 0.4;
      
      anomalyImpact *= severityMultiplier;
      
      // Adicionar ao total
      totalScore += anomalyImpact;
    });
    
    // Normalizar pelo número de anomalias e limitar entre -1 e 1
    if (anomalies.anomalies.length > 0) {
      totalScore = totalScore / anomalies.anomalies.length;
    }
    
    return Math.max(-1, Math.min(1, totalScore));
  }
  
  /**
   * Calcula score com base em dados fundamentalistas
   * @param {Object} fundamentals - Dados fundamentalistas
   * @returns {Number} - Score (-1 a 1)
   */
  calculateFundamentalScore(fundamentals) {
    if (!fundamentals) {
      return 0;
    }
    
    let score = 0;
    let factorsCount = 0;
    
    // P/VP (Price to Book Value)
    if (fundamentals.pvp !== undefined) {
      // P/VP ideal entre 0.7 e 1.1
      // Abaixo de 0.7 pode indicar problemas, acima de 1.1 pode estar caro
      if (fundamentals.pvp < 0.7) {
        score += (fundamentals.pvp / 0.7) - 1; // Negativo se muito baixo
      } else if (fundamentals.pvp <= 1.1) {
        score += 0.5; // Positivo na faixa ideal
      } else {
        score += 0.5 - Math.min(0.5, (fundamentals.pvp - 1.1) / 0.5); // Reduz conforme aumenta
      }
      factorsCount++;
    }
    
    // Dividend Yield
    if (fundamentals.dividendYield !== undefined) {
      // Yield acima de 8% é muito bom, abaixo de 4% é fraco para FIIs
      if (fundamentals.dividendYield >= 8) {
        score += 0.8;
      } else if (fundamentals.dividendYield >= 6) {
        score += 0.5;
      } else if (fundamentals.dividendYield >= 4) {
        score += 0.2;
      } else {
        score -= 0.2;
      }
      factorsCount++;
    }
    
    // Vacância
    if (fundamentals.vacancy !== undefined) {
      // Vacância abaixo de 5% é excelente, acima de 15% é preocupante
      if (fundamentals.vacancy <= 5) {
        score += 0.7;
      } else if (fundamentals.vacancy <= 10) {
        score += 0.3;
      } else if (fundamentals.vacancy <= 15) {
        score -= 0.2;
      } else {
        score -= 0.6;
      }
      factorsCount++;
    }
    
    // Liquidez
    if (fundamentals.liquidity !== undefined) {
      // Liquidez alta é positiva
      if (fundamentals.liquidity === 'high') {
        score += 0.4;
      } else if (fundamentals.liquidity === 'medium') {
        score += 0.2;
      } else {
        score -= 0.2; // Baixa liquidez é negativa
      }
      factorsCount++;
    }
    
    // Calcular média e limitar entre -1 e 1
    if (factorsCount > 0) {
      score = score / factorsCount;
    }
    
    return Math.max(-1, Math.min(1, score));
  }
  
  /**
   * Determina recomendação com base no score combinado
   * @param {Number} score - Score combinado
   * @returns {String} - Recomendação
   */
  determineRecommendation(score) {
    if (score >= this.config.thresholds.strongBuy) {
      return 'strong_buy';
    } else if (score >= this.config.thresholds.buy) {
      return 'buy';
    } else if (score <= this.config.thresholds.strongSell) {
      return 'strong_sell';
    } else if (score <= this.config.thresholds.sell) {
      return 'sell';
    } else {
      return 'hold';
    }
  }
  
  /**
   * Calcula nível de confiança da recomendação
   * @param {Object} mlResults - Resultados dos modelos de ML
   * @returns {String} - Nível de confiança (high, medium, low)
   */
  calculateConfidence(mlResults) {
    let confidenceScore = 0;
    let factorsCount = 0;
    
    // Confiança da previsão de preços
    if (mlResults.priceForecast && mlResults.priceForecast.metrics) {
      if (mlResults.priceForecast.metrics.confidence === 'high') {
        confidenceScore += 1;
      } else if (mlResults.priceForecast.metrics.confidence === 'medium') {
        confidenceScore += 0.6;
      } else {
        confidenceScore += 0.3;
      }
      factorsCount++;
    }
    
    // Confiança da análise de sentimento
    if (mlResults.sentimentAnalysis && mlResults.sentimentAnalysis.aggregated) {
      confidenceScore += mlResults.sentimentAnalysis.aggregated.confidence || 0.5;
      factorsCount++;
    }
    
    // Qualidade dos dados de anomalias
    if (mlResults.anomalies) {
      // Mais métodos de detecção = maior confiança
      const methodCount = Object.keys(mlResults.anomalies.methods || {}).length;
      confidenceScore += Math.min(1, methodCount / 3);
      factorsCount++;
    }
    
    // Calcular média
    const avgConfidence = factorsCount > 0 ? confidenceScore / factorsCount : 0.5;
    
    // Mapear para níveis
    if (avgConfidence >= 0.7) {
      return 'high';
    } else if (avgConfidence >= 0.4) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  /**
   * Gera justificativas para a recomendação
   * @param {String} ticker - Código do FII
   * @param {String} recommendation - Recomendação
   * @param {Number} priceScore - Score de previsão de preços
   * @param {Number} sentimentScore - Score de sentimento
   * @param {Number} anomalyScore - Score de anomalias
   * @param {Number} fundamentalScore - Score fundamental
   * @param {Object} mlResults - Resultados completos dos modelos
   * @returns {Array} - Lista de justificativas
   */
  generateReasons(ticker, recommendation, priceScore, sentimentScore, anomalyScore, fundamentalScore, mlResults) {
    const reasons = [];
    
    // Justificativas baseadas na previsão de preços
    if (mlResults.priceForecast && mlResults.priceForecast.predictions) {
      const firstPrice = mlResults.priceForecast.predictions[0].price;
      const lastPrice = mlResults.priceForecast.predictions[mlResults.priceForecast.predictions.length - 1].price;
      const percentChange = ((lastPrice - firstPrice) / firstPrice) * 100;
      const horizon = mlResults.priceForecast.predictions.length;
      
      if (Math.abs(percentChange) >= 1) {
        const direction = percentChange > 0 ? 'alta' : 'queda';
        reasons.push(
          `Previsão de ${direction} de ${Math.abs(percentChange).toFixed(2)}% nos próximos ${horizon} dias.`
        );
      } else {
        reasons.push(`Previsão de estabilidade de preço nos próximos ${horizon} dias.`);
      }
      
      if (mlResults.priceForecast.trend) {
        const trendMap = {
          'strong_up': 'forte alta',
          'up': 'alta',
          'stable': 'estabilidade',
          'down': 'queda',
          'strong_down': 'forte queda'
        };
        
        reasons.push(`Tendência de ${trendMap[mlResults.priceForecast.trend] || mlResults.priceForecast.trend} identificada.`);
      }
    }
    
    // Justificativas baseadas na análise de sentimento
    if (mlResults.sentimentAnalysis && mlResults.sentimentAnalysis.aggregated) {
      const sentimentMap = {
        'very_positive': 'muito positivo',
        'positive': 'positivo',
        'neutral': 'neutro',
        'negative': 'negativo',
        'very_negative': 'muito negativo'
      };
      
      const sentiment = sentimentMap[mlResults.sentimentAnalysis.aggregated.label] || 'neutro';
      
      if (mlResults.sentimentAnalysis.articles && mlResults.sentimentAnalysis.articles.length > 0) {
        reasons.push(
          `Sentimento de mercado ${sentiment} baseado em ${mlResults.sentimentAnalysis.articles.length} notícias recentes.`
        );
      } else {
        reasons.push(`Sentimento de mercado ${sentiment}.`);
      }
      
      // Adicionar tópicos relevantes se disponíveis
      if (mlResults.sentimentAnalysis.topTopics && mlResults.sentimentAnalysis.topTopics.length > 0) {
        const topics = mlResults.sentimentAnalysis.topTopics.slice(0, 2).join(' e ');
        reasons.push(`Tópicos em destaque nas notícias: ${topics}.`);
      }
    }
    
    // Justificativas baseadas na detecção de anomalias
    if (mlResults.anomalies && mlResults.anomalies.anomalies) {
      if (mlResults.anomalies.anomalies.length > 0) {
        const recentAnomalies = mlResults.anomalies.anomalies
          .filter(a => new Date(a.date) >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
        
        if (recentAnomalies.length > 0) {
          const highValueAnomalies = recentAnomalies.filter(a => a.type === 'high_value').length;
          const lowValueAnomalies = recentAnomalies.filter(a => a.type === 'low_value').length;
          
          if (highValueAnomalies > 0 && lowValueAnomalies === 0) {
            reasons.push(`Detectados ${highValueAnomalies} picos positivos nos dividendos recentes.`);
          } else if (lowValueAnomalies > 0 && highValueAnomalies === 0) {
            reasons.push(`Detectados ${lowValueAnomalies} valores anormalmente baixos nos dividendos recentes.`);
          } else if (highValueAnomalies > 0 && lowValueAnomalies > 0) {
            reasons.push(`Detectada volatilidade anormal nos dividendos recentes.`);
          }
        } else {
          reasons.push('Padrão estável de dividendos sem anomalias recentes.');
        }
      } else {
        reasons.push('Padrão consistente de dividendos sem anomalias detectadas.');
      }
    }
    
    // Justificativas baseadas em dados fundamentalistas
    if (mlResults.fundamentals) {
      const fundamentals = mlResults.fundamentals;
      
      if (fundamentals.dividendYield !== undefined) {
        if (fundamentals.dividendYield >= 8) {
          reasons.push(`Dividend yield atrativo de ${fundamentals.dividendYield.toFixed(2)}%.`);
        } else if (fundamentals.dividendYield < 4) {
          reasons.push(`Dividend yield abaixo da média do setor (${fundamentals.dividendYield.toFixed(2)}%).`);
        }
      }
      
      if (fundamentals.pvp !== undefined) {
        if (fundamentals.pvp < 0.9) {
          reasons.push(`FII negociado com desconto em relação ao valor patrimonial (P/VP: ${fundamentals.pvp.toFixed(2)}).`);
        } else if (fundamentals.pvp > 1.2) {
          reasons.push(`FII negociado com prêmio significativo sobre o valor patrimonial (P/VP: ${fundamentals.pvp.toFixed(2)}).`);
        }
      }
      
      if (fundamentals.vacancy !== undefined) {
        if (fundamentals.vacancy > 15) {
          reasons.push(`Taxa de vacância elevada (${fundamentals.vacancy.toFixed(1)}%).`);
        } else if (fundamentals.vacancy < 5) {
          reasons.push(`Taxa de vacância baixa (${fundamentals.vacancy.toFixed(1)}%).`);
        }
      }
    }
    
    // Adicionar justificativa baseada na recomendação final
    const recommendationMap = {
      'strong_buy': 'compra forte',
      'buy': 'compra',
      'hold': 'manutenção',
      'sell': 'venda',
      'strong_sell': 'venda forte'
    };
    
    const recommendationText = recommendationMap[recommendation] || recommendation;
    
    // Determinar os fatores mais influentes
    const scores = [
      { name: 'previsão de preços', value: Math.abs(priceScore) },
      { name: 'sentimento de mercado', value: Math.abs(sentimentScore) },
      { name: 'análise de dividendos', value: Math.abs(anomalyScore) },
      { name: 'indicadores fundamentalistas', value: Math.abs(fundamentalScore) }
    ];
    
    scores.sort((a, b) => b.value - a.value);
    const topFactors = scores.slice(0, 2).map(s => s.name).join(' e ');
    
    reasons.push(`Recomendação de ${recommendationText} baseada principalmente em ${topFactors}.`);
    
    return reasons;
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
   * Gera recomendações para múltiplos FIIs
   * @param {Array} tickers - Lista de códigos de FIIs
   * @param {Object} mlResultsMap - Mapa de resultados de ML por ticker
   * @param {Object} fundamentalsMap - Mapa de dados fundamentalistas por ticker
   * @param {Object} userPreferences - Preferências do usuário
   * @returns {Promise<Array>} - Lista de recomendações
   */
  async generateBatchRecommendations(tickers, mlResultsMap, fundamentalsMap, userPreferences = {}) {
    const recommendations = [];
    
    for (const ticker of tickers) {
      const mlResults = mlResultsMap[ticker];
      const fundamentals = fundamentalsMap[ticker];
      
      if (mlResults) {
        const recommendation = await this.generateRecommendation(
          ticker,
          mlResults,
          fundamentals,
          userPreferences
        );
        
        recommendations.push(recommendation);
      }
    }
    
    // Ordenar por score (do mais alto para o mais baixo)
    recommendations.sort((a, b) => b.score - a.score);
    
    return recommendations;
  }
  
  /**
   * Gera um portfólio recomendado com base em múltiplos FIIs
   * @param {Array} recommendations - Lista de recomendações
   * @param {Object} constraints - Restrições do portfólio
   * @returns {Object} - Portfólio recomendado
   */
  generatePortfolioRecommendation(recommendations, constraints = {}) {
    // Implementação básica - em produção seria mais sofisticado
    const portfolio = {
      recommendations: [],
      allocation: {},
      expectedReturn: 0,
      riskLevel: 'moderate',
      timestamp: new Date().toISOString()
    };
    
    // Filtrar apenas recomendações positivas
    const positiveRecs = recommendations.filter(
      rec => rec.recommendation === 'strong_buy' || rec.recommendation === 'buy'
    );
    
    if (positiveRecs.length === 0) {
      return {
        ...portfolio,
        recommendations: [],
        message: 'Nenhuma recomendação de compra encontrada.'
      };
    }
    
    // Limitar número de recomendações
    const maxRecs = constraints.maxRecommendations || 5;
    const selectedRecs = positiveRecs.slice(0, maxRecs);
    
    // Calcular alocação simples
    const totalScore = selectedRecs.reduce((sum, rec) => sum + Math.max(0, rec.score), 0);
    
    selectedRecs.forEach(rec => {
      const weight = totalScore > 0 ? Math.max(0, rec.score) / totalScore : 1 / selectedRecs.length;
      portfolio.allocation[rec.ticker] = parseFloat((weight * 100).toFixed(1));
    });
    
    // Estimar retorno esperado (simplificado)
    portfolio.expectedReturn = selectedRecs.reduce(
      (sum, rec) => sum + (rec.score * 5), // Estimativa simplificada
      0
    ) / selectedRecs.length;
    
    // Determinar nível de risco
    const avgConfidence = selectedRecs.reduce(
      (sum, rec) => sum + (rec.confidence === 'high' ? 1 : rec.confidence === 'medium' ? 0.5 : 0.2),
      0
    ) / selectedRecs.length;
    
    portfolio.riskLevel = avgConfidence > 0.7 ? 'low' : avgConfidence > 0.4 ? 'moderate' : 'high';
    
    // Adicionar recomendações
    portfolio.recommendations = selectedRecs;
    
    return portfolio;
  }
}

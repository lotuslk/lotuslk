// src/validation/recommendationEngineValidator.js
import { RecommendationEngine } from '../models/recommendationEngine';

/**
 * Classe para validação do motor de recomendações
 * 
 * Esta classe implementa métodos para validar as recomendações geradas
 * pelo motor de recomendações, usando casos de uso reais e sintéticos.
 */
export class RecommendationEngineValidator {
  constructor(config = {}) {
    this.config = {
      testCases: config.testCases || [],
      benchmarkCases: config.benchmarkCases || [],
      userProfiles: config.userProfiles || this.getDefaultUserProfiles(),
      ...config
    };
    
    this.engine = new RecommendationEngine(config.engineConfig);
    this.results = {};
  }
  
  /**
   * Inicializa o validador
   * @returns {Promise<boolean>} - Sucesso da inicialização
   */
  async initialize() {
    return await this.engine.initialize();
  }
  
  /**
   * Valida o motor de recomendações com casos de teste
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateEngine() {
    try {
      console.log('Iniciando validação do motor de recomendações...');
      
      // Inicializar motor
      await this.initialize();
      
      // Validar com casos de teste sintéticos
      const syntheticResults = await this.validateWithSyntheticCases();
      
      // Validar com casos de benchmark
      const benchmarkResults = await this.validateWithBenchmarkCases();
      
      // Validar com diferentes perfis de usuário
      const profileResults = await this.validateWithUserProfiles();
      
      // Consolidar resultados
      this.results = {
        synthetic: syntheticResults,
        benchmark: benchmarkResults,
        profiles: profileResults,
        summary: this.generateSummary(syntheticResults, benchmarkResults, profileResults)
      };
      
      console.log('Validação concluída com sucesso');
      console.log(`Acurácia geral: ${this.results.summary.overallAccuracy.toFixed(2)}%`);
      
      return this.results;
    } catch (error) {
      console.error('Erro na validação do motor de recomendações:', error);
      throw error;
    }
  }
  
  /**
   * Valida o motor com casos de teste sintéticos
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateWithSyntheticCases() {
    console.log('Validando com casos sintéticos...');
    
    // Gerar casos de teste se não fornecidos
    const testCases = this.config.testCases.length > 0 ? 
      this.config.testCases : this.generateSyntheticTestCases();
    
    const results = {
      cases: [],
      metrics: {}
    };
    
    // Processar cada caso de teste
    for (const testCase of testCases) {
      try {
        // Gerar recomendação
        const recommendation = await this.engine.generateRecommendation(
          testCase.ticker,
          testCase.mlResults,
          testCase.fundamentalData,
          testCase.userPreferences
        );
        
        // Comparar com recomendação esperada
        const match = this.compareRecommendations(testCase.expectedRecommendation, recommendation);
        
        results.cases.push({
          ticker: testCase.ticker,
          scenario: testCase.scenario,
          expected: testCase.expectedRecommendation,
          actual: recommendation,
          match
        });
      } catch (error) {
        console.error(`Erro ao processar caso de teste para ${testCase.ticker}:`, error);
        results.cases.push({
          ticker: testCase.ticker,
          scenario: testCase.scenario,
          error: error.message
        });
      }
    }
    
    // Calcular métricas
    results.metrics = this.calculateMetrics(results.cases);
    
    console.log(`Validação sintética concluída: ${results.metrics.accuracy.toFixed(2)}% de acurácia`);
    
    return results;
  }
  
  /**
   * Valida o motor com casos de benchmark
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateWithBenchmarkCases() {
    console.log('Validando com casos de benchmark...');
    
    // Usar casos de benchmark predefinidos
    const benchmarkCases = this.config.benchmarkCases.length > 0 ? 
      this.config.benchmarkCases : this.generateBenchmarkCases();
    
    const results = {
      cases: [],
      metrics: {}
    };
    
    // Processar cada caso de benchmark
    for (const benchCase of benchmarkCases) {
      try {
        // Gerar recomendação
        const recommendation = await this.engine.generateRecommendation(
          benchCase.ticker,
          benchCase.mlResults,
          benchCase.fundamentalData,
          benchCase.userPreferences
        );
        
        // Comparar com recomendação esperada
        const match = this.compareRecommendations(benchCase.expectedRecommendation, recommendation);
        
        results.cases.push({
          ticker: benchCase.ticker,
          scenario: benchCase.scenario,
          expected: benchCase.expectedRecommendation,
          actual: recommendation,
          match
        });
      } catch (error) {
        console.error(`Erro ao processar caso de benchmark para ${benchCase.ticker}:`, error);
        results.cases.push({
          ticker: benchCase.ticker,
          scenario: benchCase.scenario,
          error: error.message
        });
      }
    }
    
    // Calcular métricas
    results.metrics = this.calculateMetrics(results.cases);
    
    console.log(`Validação benchmark concluída: ${results.metrics.accuracy.toFixed(2)}% de acurácia`);
    
    return results;
  }
  
  /**
   * Valida o motor com diferentes perfis de usuário
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateWithUserProfiles() {
    console.log('Validando com diferentes perfis de usuário...');
    
    // Usar perfis de usuário predefinidos
    const userProfiles = this.config.userProfiles;
    
    // Usar um caso de teste padrão
    const standardCase = this.generateStandardTestCase();
    
    const results = {
      profiles: {},
      consistency: {}
    };
    
    // Processar cada perfil de usuário
    for (const [profileName, profile] of Object.entries(userProfiles)) {
      try {
        // Gerar recomendação para este perfil
        const recommendation = await this.engine.generateRecommendation(
          standardCase.ticker,
          standardCase.mlResults,
          standardCase.fundamentalData,
          profile
        );
        
        results.profiles[profileName] = {
          profile,
          recommendation
        };
      } catch (error) {
        console.error(`Erro ao processar perfil ${profileName}:`, error);
        results.profiles[profileName] = {
          profile,
          error: error.message
        };
      }
    }
    
    // Calcular consistência entre perfis
    results.consistency = this.calculateProfileConsistency(results.profiles);
    
    console.log(`Validação de perfis concluída: ${results.consistency.differentiationScore.toFixed(2)}% de diferenciação`);
    
    return results;
  }
  
  /**
   * Gera casos de teste sintéticos
   * @returns {Array} - Casos de teste
   */
  generateSyntheticTestCases() {
    const testCases = [];
    
    // Caso 1: Forte tendência de alta
    testCases.push({
      ticker: 'TEST01',
      scenario: 'strong_uptrend',
      mlResults: {
        priceForecast: {
          predictions: [
            { date: '2025-06-01', price: 100.0 },
            { date: '2025-06-02', price: 102.0 },
            { date: '2025-06-03', price: 104.0 },
            { date: '2025-06-04', price: 106.0 },
            { date: '2025-06-05', price: 108.0 }
          ],
          trend: 'strong_up',
          metrics: {
            confidence: 'high',
            rmse: 0.5,
            mape: 0.8
          }
        },
        sentimentAnalysis: {
          aggregated: {
            label: 'positive',
            score: 0.6,
            confidence: 0.8
          },
          articles: [
            { title: 'Artigo positivo', sentiment: { label: 'positive', score: 0.7 } },
            { title: 'Outro artigo positivo', sentiment: { label: 'positive', score: 0.5 } }
          ]
        },
        anomalies: {
          anomalies: [],
          stats: { count: 0, percentage: 0 },
          riskLevel: 'low'
        }
      },
      fundamentalData: {
        pvp: 0.9,
        dividendYield: 7.5,
        vacancy: 3.0,
        liquidity: 'high'
      },
      userPreferences: {},
      expectedRecommendation: {
        recommendation: 'strong_buy',
        confidence: 'high'
      }
    });
    
    // Caso 2: Forte tendência de queda
    testCases.push({
      ticker: 'TEST02',
      scenario: 'strong_downtrend',
      mlResults: {
        priceForecast: {
          predictions: [
            { date: '2025-06-01', price: 100.0 },
            { date: '2025-06-02', price: 97.0 },
            { date: '2025-06-03', price: 94.0 },
            { date: '2025-06-04', price: 91.0 },
            { date: '2025-06-05', price: 88.0 }
          ],
          trend: 'strong_down',
          metrics: {
            confidence: 'high',
            rmse: 0.6,
            mape: 0.9
          }
        },
        sentimentAnalysis: {
          aggregated: {
            label: 'negative',
            score: -0.7,
            confidence: 0.8
          },
          articles: [
            { title: 'Artigo negativo', sentiment: { label: 'negative', score: -0.8 } },
            { title: 'Outro artigo negativo', sentiment: { label: 'negative', score: -0.6 } }
          ]
        },
        anomalies: {
          anomalies: [
            { 
              date: '2025-05-15', 
              value: 0.3, 
              type: 'low_value', 
              severity: 'high',
              deviation: -50,
              detectedBy: ['zScore', 'iqr']
            }
          ],
          stats: { count: 1, percentage: 10 },
          riskLevel: 'high'
        }
      },
      fundamentalData: {
        pvp: 1.3,
        dividendYield: 3.5,
        vacancy: 18.0,
        liquidity: 'medium'
      },
      userPreferences: {},
      expectedRecommendation: {
        recommendation: 'strong_sell',
        confidence: 'high'
      }
    });
    
    // Caso 3: Cenário misto/neutro
    testCases.push({
      ticker: 'TEST03',
      scenario: 'mixed_signals',
      mlResults: {
        priceForecast: {
          predictions: [
            { date: '2025-06-01', price: 100.0 },
            { date: '2025-06-02', price: 101.0 },
            { date: '2025-06-03', price: 99.5 },
            { date: '2025-06-04', price: 100.5 },
            { date: '2025-06-05', price: 100.0 }
          ],
          trend: 'stable',
          metrics: {
            confidence: 'medium',
            rmse: 1.2,
            mape: 1.5
          }
        },
        sentimentAnalysis: {
          aggregated: {
            label: 'neutral',
            score: 0.1,
            confidence: 0.6
          },
          articles: [
            { title: 'Artigo positivo', sentiment: { label: 'positive', score: 0.4 } },
            { title: 'Artigo negativo', sentiment: { label: 'negative', score: -0.3 } }
          ]
        },
        anomalies: {
          anomalies: [],
          stats: { count: 0, percentage: 0 },
          riskLevel: 'low'
        }
      },
      fundamentalData: {
        pvp: 1.0,
        dividendYield: 6.0,
        vacancy: 8.0,
        liquidity: 'high'
      },
      userPreferences: {},
      expectedRecommendation: {
        recommendation: 'hold',
        confidence: 'medium'
      }
    });
    
    // Caso 4: Bons fundamentos, mas sentimento negativo
    testCases.push({
      ticker: 'TEST04',
      scenario: 'good_fundamentals_bad_sentiment',
      mlResults: {
        priceForecast: {
          predictions: [
            { date: '2025-06-01', price: 100.0 },
            { date: '2025-06-02', price: 99.0 },
            { date: '2025-06-03', price: 98.0 },
            { date: '2025-06-04', price: 97.0 },
            { date: '2025-06-05', price: 96.0 }
          ],
          trend: 'down',
          metrics: {
            confidence: 'medium',
            rmse: 0.8,
            mape: 1.0
          }
        },
        sentimentAnalysis: {
          aggregated: {
            label: 'negative',
            score: -0.5,
            confidence: 0.7
          },
          articles: [
            { title: 'Artigo negativo', sentiment: { label: 'negative', score: -0.5 } }
          ]
        },
        anomalies: {
          anomalies: [],
          stats: { count: 0, percentage: 0 },
          riskLevel: 'low'
        }
      },
      fundamentalData: {
        pvp: 0.8,
        dividendYield: 8.5,
        vacancy: 4.0,
        liquidity: 'high'
      },
      userPreferences: {},
      expectedRecommendation: {
        recommendation: 'hold',
        confidence: 'medium'
      }
    });
    
    // Caso 5: Fundamentos fracos, mas tendência de alta
    testCases.push({
      ticker: 'TEST05',
      scenario: 'weak_fundamentals_uptrend',
      mlResults: {
        priceForecast: {
          predictions: [
            { date: '2025-06-01', price: 100.0 },
            { date: '2025-06-02', price: 102.0 },
            { date: '2025-06-03', price: 104.0 },
            { date: '2025-06-04', price: 106.0 },
            { date: '2025-06-05', price: 108.0 }
          ],
          trend: 'up',
          metrics: {
            confidence: 'medium',
            rmse: 0.9,
            mape: 1.1
          }
        },
        sentimentAnalysis: {
          aggregated: {
            label: 'positive',
            score: 0.4,
            confidence: 0.6
          },
          articles: [
            { title: 'Artigo positivo', sentiment: { label: 'positive', score: 0.4 } }
          ]
        },
        anomalies: {
          anomalies: [],
          stats: { count: 0, percentage: 0 },
          riskLevel: 'medium'
        }
      },
      fundamentalData: {
        pvp: 1.4,
        dividendYield: 4.0,
        vacancy: 12.0,
        liquidity: 'medium'
      },
      userPreferences: {},
      expectedRecommendation: {
        recommendation: 'buy',
        confidence: 'medium'
      }
    });
    
    return testCases;
  }
  
  /**
   * Gera casos de benchmark
   * @returns {Array} - Casos de benchmark
   */
  generateBenchmarkCases() {
    const benchmarkCases = [];
    
    // Caso 1: Alta clara com anomalia positiva
    benchmarkCases.push({
      ticker: 'BENCH01',
      scenario: 'clear_uptrend_with_positive_anomaly',
      mlResults: {
        priceForecast: {
          predictions: [
            { date: '2025-06-01', price: 100.0 },
            { date: '2025-06-05', price: 110.0 }
          ],
          trend: 'strong_up',
          metrics: { confidence: 'high' }
        },
        sentimentAnalysis: {
          aggregated: { label: 'positive', score: 0.7, confidence: 0.8 }
        },
        anomalies: {
          anomalies: [
            { date: '2025-05-15', value: 1.2, type: 'high_value', severity: 'high', deviation: 50 }
          ],
          riskLevel: 'low'
        }
      },
      fundamentalData: {
        pvp: 0.9,
        dividendYield: 8.0,
        vacancy: 3.0
      },
      userPreferences: {},
      expectedRecommendation: {
        recommendation: 'strong_buy'
      }
    });
    
    // Caso 2: Queda clara com anomalia negativa
    benchmarkCases.push({
      ticker: 'BENCH02',
      scenario: 'clear_downtrend_with_negative_anomaly',
      mlResults: {
        priceForecast: {
          predictions: [
            { date: '2025-06-01', price: 100.0 },
            { date: '2025-06-05', price: 90.0 }
          ],
          trend: 'strong_down',
          metrics: { confidence: 'high' }
        },
        sentimentAnalysis: {
          aggregated: { label: 'negative', score: -0.7, confidence: 0.8 }
        },
        anomalies: {
          anomalies: [
            { date: '2025-05-15', value: 0.3, type: 'low_value', severity: 'high', deviation: -50 }
          ],
          riskLevel: 'high'
        }
      },
      fundamentalData: {
        pvp: 1.3,
        dividendYield: 3.0,
        vacancy: 18.0
      },
      userPreferences: {},
      expectedRecommendation: {
        recommendation: 'strong_sell'
      }
    });
    
    // Caso 3: Sinais conflitantes
    benchmarkCases.push({
      ticker: 'BENCH03',
      scenario: 'conflicting_signals',
      mlResults: {
        priceForecast: {
          predictions: [
            { date: '2025-06-01', price: 100.0 },
            { date: '2025-06-05', price: 105.0 }
          ],
          trend: 'up',
          metrics: { confidence: 'medium' }
        },
        sentimentAnalysis: {
          aggregated: { label: 'negative', score: -0.4, confidence: 0.6 }
        },
        anomalies: {
          anomalies: [],
          riskLevel: 'medium'
        }
      },
      fundamentalData: {
        pvp: 1.1,
        dividendYield: 6.0,
        vacancy: 8.0
      },
      userPreferences: {},
      expectedRecommendation: {
        recommendation: 'hold'
      }
    });
    
    return benchmarkCases;
  }
  
  /**
   * Gera um caso de teste padrão para validação de perfis
   * @returns {Object} - Caso de teste padrão
   */
  generateStandardTestCase() {
    return {
      ticker: 'STANDARD',
      mlResults: {
        priceForecast: {
          predictions: [
            { date: '2025-06-01', price: 100.0 },
            { date: '2025-06-02', price: 102.0 },
            { date: '2025-06-03', price: 103.0 },
            { date: '2025-06-04', price: 104.0 },
            { date: '2025-06-05', price: 105.0 }
          ],
          trend: 'up',
          metrics: {
            confidence: 'medium',
            rmse: 0.7,
            mape: 0.9
          }
        },
        sentimentAnalysis: {
          aggregated: {
            label: 'positive',
            score: 0.4,
            confidence: 0.7
          },
          articles: [
            { title: 'Artigo positivo', sentiment: { label: 'positive', score: 0.4 } }
          ]
        },
        anomalies: {
          anomalies: [
            { 
              date: '2025-05-15', 
              value: 0.9, 
              type: 'high_value', 
              severity: 'medium',
              deviation: 20,
              detectedBy: ['zScore', 'iqr']
            }
          ],
          stats: { count: 1, percentage: 10 },
          riskLevel: 'medium'
        },
        fundamentals: {
          pvp: 1.05,
          dividendYield: 6.5,
          vacancy: 7.0,
          liquidity: 'high'
        }
      },
      fundamentalData: {
        pvp: 1.05,
        dividendYield: 6.5,
        vacancy: 7.0,
        liquidity: 'high'
      }
    };
  }
  
  /**
   * Retorna perfis de usuário padrão
   * @returns {Object} - Perfis de usuário
   */
  getDefaultUserProfiles() {
    return {
      conservative: {
        riskTolerance: 'low',
        investmentHorizon: 'long',
        incomePreference: 0.8, // Forte preferência por dividendos
        sectorPreferences: {
          'lajes_corporativas': 0.4,
          'shopping': 0.2,
          'logistica': 0.2,
          'residencial': 0.2
        }
      },
      moderate: {
        riskTolerance: 'moderate',
        investmentHorizon: 'medium',
        incomePreference: 0.5, // Equilíbrio entre dividendos e valorização
        sectorPreferences: {
          'lajes_corporativas': 0.3,
          'shopping': 0.3,
          'logistica': 0.3,
          'residencial': 0.1
        }
      },
      aggressive: {
        riskTolerance: 'high',
        investmentHorizon: 'short',
        incomePreference: 0.2, // Forte preferência por valorização
        sectorPreferences: {
          'lajes_corporativas': 0.2,
          'shopping': 0.4,
          'logistica': 0.3,
          'residencial': 0.1
        }
      },
      income_focused: {
        riskTolerance: 'moderate',
        investmentHorizon: 'long',
        incomePreference: 0.9, // Foco quase exclusivo em dividendos
        sectorPreferences: {}
      },
      growth_focused: {
        riskTolerance: 'moderate',
        investmentHorizon: 'medium',
        incomePreference: 0.1, // Foco quase exclusivo em valorização
        sectorPreferences: {}
      }
    };
  }
  
  /**
   * Compara recomendações esperadas e reais
   * @param {Object} expected - Recomendação esperada
   * @param {Object} actual - Recomendação real
   * @returns {Object} - Resultado da comparação
   */
  compareRecommendations(expected, actual) {
    if (!expected || !actual) {
      return { match: false };
    }
    
    // Verificar correspondência de recomendação
    const recommendationMatch = expected.recommendation === actual.recommendation;
    
    // Verificar correspondência de confiança (se especificada)
    const confidenceMatch = !expected.confidence || expected.confidence === actual.confidence;
    
    // Verificar correspondência aproximada de recomendação
    const similarRecommendation = this.areSimilarRecommendations(expected.recommendation, actual.recommendation);
    
    // Calcular similaridade geral
    const similarity = recommendationMatch ? 1.0 : (similarRecommendation ? 0.5 : 0);
    
    return {
      recommendationMatch,
      confidenceMatch,
      similarRecommendation,
      similarity
    };
  }
  
  /**
   * Verifica se duas recomendações são similares
   * @param {String} rec1 - Primeira recomendação
   * @param {String} rec2 - Segunda recomendação
   * @returns {Boolean} - Se são similares
   */
  areSimilarRecommendations(rec1, rec2) {
    const buyGroup = ['strong_buy', 'buy'];
    const sellGroup = ['strong_sell', 'sell'];
    
    if (buyGroup.includes(rec1) && buyGroup.includes(rec2)) {
      return true;
    }
    
    if (sellGroup.includes(rec1) && sellGroup.includes(rec2)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Calcula métricas de avaliação
   * @param {Array} cases - Casos de teste
   * @returns {Object} - Métricas calculadas
   */
  calculateMetrics(cases) {
    if (!cases || cases.length === 0) {
      return {
        accuracy: 0,
        exactMatch: 0,
        similarMatch: 0
      };
    }
    
    // Filtrar casos com erro
    const validCases = cases.filter(c => !c.error);
    
    if (validCases.length === 0) {
      return {
        accuracy: 0,
        exactMatch: 0,
        similarMatch: 0
      };
    }
    
    // Contar correspondências exatas e similares
    let exactMatches = 0;
    let similarMatches = 0;
    
    validCases.forEach(c => {
      if (c.match && c.match.recommendationMatch) {
        exactMatches++;
      } else if (c.match && c.match.similarRecommendation) {
        similarMatches++;
      }
    });
    
    // Calcular métricas
    const exactMatchRate = (exactMatches / validCases.length) * 100;
    const similarMatchRate = (similarMatches / validCases.length) * 100;
    const accuracy = ((exactMatches + similarMatches * 0.5) / validCases.length) * 100;
    
    return {
      accuracy,
      exactMatch: exactMatchRate,
      similarMatch: similarMatchRate,
      totalCases: validCases.length,
      exactMatches,
      similarMatches
    };
  }
  
  /**
   * Calcula consistência entre perfis de usuário
   * @param {Object} profileResults - Resultados por perfil
   * @returns {Object} - Métricas de consistência
   */
  calculateProfileConsistency(profileResults) {
    const profiles = Object.keys(profileResults);
    
    if (profiles.length <= 1) {
      return {
        differentiationScore: 0,
        pairwiseDifferences: {}
      };
    }
    
    // Calcular diferenças par a par
    const pairwiseDifferences = {};
    let totalDifference = 0;
    let pairCount = 0;
    
    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const profile1 = profiles[i];
        const profile2 = profiles[j];
        
        const result1 = profileResults[profile1];
        const result2 = profileResults[profile2];
        
        // Pular se algum resultado tem erro
        if (result1.error || result2.error) continue;
        
        // Calcular diferença
        const difference = this.calculateRecommendationDifference(
          result1.recommendation,
          result2.recommendation
        );
        
        pairwiseDifferences[`${profile1}_${profile2}`] = difference;
        totalDifference += difference;
        pairCount++;
      }
    }
    
    // Calcular score de diferenciação
    const differentiationScore = pairCount > 0 ? (totalDifference / pairCount) * 100 : 0;
    
    return {
      differentiationScore,
      pairwiseDifferences
    };
  }
  
  /**
   * Calcula diferença entre duas recomendações
   * @param {Object} rec1 - Primeira recomendação
   * @param {Object} rec2 - Segunda recomendação
   * @returns {Number} - Diferença (0-1)
   */
  calculateRecommendationDifference(rec1, rec2) {
    if (!rec1 || !rec2) return 0;
    
    // Mapear recomendações para valores numéricos
    const recValues = {
      'strong_buy': 2,
      'buy': 1,
      'hold': 0,
      'sell': -1,
      'strong_sell': -2
    };
    
    const value1 = recValues[rec1.recommendation] || 0;
    const value2 = recValues[rec2.recommendation] || 0;
    
    // Calcular diferença absoluta normalizada (0-1)
    const maxDiff = 4; // Diferença máxima possível (strong_buy vs strong_sell)
    const diff = Math.abs(value1 - value2) / maxDiff;
    
    return diff;
  }
  
  /**
   * Gera resumo dos resultados de validação
   * @param {Object} syntheticResults - Resultados de casos sintéticos
   * @param {Object} benchmarkResults - Resultados de casos de benchmark
   * @param {Object} profileResults - Resultados de perfis de usuário
   * @returns {Object} - Resumo consolidado
   */
  generateSummary(syntheticResults, benchmarkResults, profileResults) {
    // Calcular acurácia geral
    const syntheticAccuracy = syntheticResults ? syntheticResults.metrics.accuracy : 0;
    const benchmarkAccuracy = benchmarkResults ? benchmarkResults.metrics.accuracy : 0;
    
    // Média ponderada (mais peso para benchmark)
    const overallAccuracy = (syntheticAccuracy * 0.4 + benchmarkAccuracy * 0.6);
    
    // Calcular diferenciação de perfis
    const profileDifferentiation = profileResults ? profileResults.consistency.differentiationScore : 0;
    
    // Identificar pontos fortes e fracos
    const strengths = [];
    const weaknesses = [];
    
    // Analisar acurácia
    if (overallAccuracy >= 80) {
      strengths.push(`Alta acurácia geral (${overallAccuracy.toFixed(1)}%)`);
    } else if (overallAccuracy < 60) {
      weaknesses.push(`Baixa acurácia geral (${overallAccuracy.toFixed(1)}%)`);
    }
    
    // Analisar diferenciação de perfis
    if (profileDifferentiation >= 50) {
      strengths.push(`Boa diferenciação entre perfis de usuário (${profileDifferentiation.toFixed(1)}%)`);
    } else if (profileDifferentiation < 20) {
      weaknesses.push(`Baixa diferenciação entre perfis de usuário (${profileDifferentiation.toFixed(1)}%)`);
    }
    
    // Analisar casos específicos
    if (syntheticResults && syntheticResults.cases) {
      // Verificar casos problemáticos
      const failedCases = syntheticResults.cases.filter(c => 
        !c.error && (!c.match || !c.match.recommendationMatch && !c.match.similarRecommendation)
      );
      
      if (failedCases.length > 0) {
        const scenarios = failedCases.map(c => c.scenario).join(', ');
        weaknesses.push(`Dificuldade em cenários específicos: ${scenarios}`);
      }
    }
    
    return {
      overallAccuracy,
      syntheticAccuracy,
      benchmarkAccuracy,
      profileDifferentiation,
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
          accuracy: this.results.synthetic.metrics.accuracy,
          exactMatch: this.results.synthetic.metrics.exactMatch,
          totalCases: this.results.synthetic.metrics.totalCases
        } : null,
        benchmark: this.results.benchmark ? {
          accuracy: this.results.benchmark.metrics.accuracy,
          exactMatch: this.results.benchmark.metrics.exactMatch,
          totalCases: this.results.benchmark.metrics.totalCases
        } : null,
        profiles: this.results.profiles ? {
          differentiationScore: this.results.profiles.consistency.differentiationScore,
          profileCount: Object.keys(this.results.profiles.profiles).length
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
    
    // Verificar acurácia geral
    if (this.results.summary.overallAccuracy < 70) {
      recommendations.push('Ajustar pesos dos componentes para melhorar a acurácia geral');
    }
    
    // Verificar diferenciação de perfis
    if (this.results.summary.profileDifferentiation < 30) {
      recommendations.push('Aumentar o impacto das preferências do usuário nas recomendações');
    }
    
    // Verificar pontos fracos
    if (this.results.summary.weaknesses.length > 0) {
      this.results.summary.weaknesses.forEach(weakness => {
        if (weakness.includes('cenários específicos')) {
          recommendations.push('Revisar a lógica de recomendação para cenários com sinais conflitantes');
        }
      });
    }
    
    // Recomendações gerais
    recommendations.push('Implementar validação contínua com dados reais de mercado');
    recommendations.push('Considerar feedback dos usuários para ajustar os parâmetros do motor');
    
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

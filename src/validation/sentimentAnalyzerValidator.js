// src/validation/sentimentAnalyzerValidator.js
import { SentimentAnalyzer } from '../models/sentimentAnalyzer';

/**
 * Classe para validação do analisador de sentimento
 * 
 * Esta classe implementa métodos para validar o analisador de sentimento
 * usando amostras de notícias reais e sintéticas, gerando relatórios
 * de performance e acurácia.
 */
export class SentimentAnalyzerValidator {
  constructor(config = {}) {
    this.config = {
      sampleSize: config.sampleSize || 20, // Número de amostras para validação
      testTickers: config.testTickers || ['KNRI11', 'HGLG11', 'MXRF11', 'XPLG11', 'VISC11'],
      validateWithHuman: config.validateWithHuman || false, // Validação manual (não implementada)
      ...config
    };
    
    this.analyzer = new SentimentAnalyzer(config.analyzerConfig);
    this.results = {};
  }
  
  /**
   * Inicializa o validador
   * @returns {Promise<boolean>} - Sucesso da inicialização
   */
  async initialize() {
    return await this.analyzer.initialize();
  }
  
  /**
   * Valida o analisador com amostras de notícias
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateWithSamples() {
    try {
      console.log('Iniciando validação do analisador de sentimento...');
      
      // Inicializar analisador
      await this.initialize();
      
      // Validar com amostras sintéticas
      const syntheticResults = await this.validateWithSyntheticSamples();
      
      // Validar com amostras reais (se disponíveis)
      let realResults = null;
      try {
        realResults = await this.validateWithRealSamples();
      } catch (error) {
        console.warn('Não foi possível validar com amostras reais:', error);
      }
      
      // Validar com amostras de benchmark
      const benchmarkResults = await this.validateWithBenchmarkSamples();
      
      // Consolidar resultados
      this.results = {
        synthetic: syntheticResults,
        real: realResults,
        benchmark: benchmarkResults,
        summary: this.generateSummary(syntheticResults, realResults, benchmarkResults)
      };
      
      console.log('Validação concluída com sucesso');
      console.log(`Acurácia geral: ${this.results.summary.overallAccuracy.toFixed(2)}%`);
      
      return this.results;
    } catch (error) {
      console.error('Erro na validação do analisador de sentimento:', error);
      throw error;
    }
  }
  
  /**
   * Valida o analisador com amostras sintéticas
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateWithSyntheticSamples() {
    console.log('Validando com amostras sintéticas...');
    
    const results = {
      samples: [],
      metrics: {}
    };
    
    // Gerar amostras sintéticas
    const samples = this.generateSyntheticSamples();
    
    // Analisar cada amostra
    for (const sample of samples) {
      const analysis = await this.analyzer.analyzeArticle(sample.article, sample.ticker);
      
      // Comparar com sentimento esperado
      const expected = sample.expectedSentiment;
      const actual = analysis.sentiment;
      
      const match = this.compareSentiment(expected, actual);
      
      results.samples.push({
        ticker: sample.ticker,
        title: sample.article.title,
        expected,
        actual,
        match
      });
    }
    
    // Calcular métricas
    results.metrics = this.calculateMetrics(results.samples);
    
    console.log(`Validação sintética concluída: ${results.metrics.accuracy.toFixed(2)}% de acurácia`);
    
    return results;
  }
  
  /**
   * Valida o analisador com amostras reais
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateWithRealSamples() {
    console.log('Validando com amostras reais...');
    
    const results = {
      samples: [],
      metrics: {}
    };
    
    // Buscar notícias reais para cada ticker
    for (const ticker of this.config.testTickers) {
      try {
        // Definir período de busca (últimos 30 dias)
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // Buscar notícias
        const news = await this.analyzer.fetchNews(ticker, startDate, endDate);
        
        if (!news || news.length === 0) {
          console.warn(`Nenhuma notícia encontrada para ${ticker}`);
          continue;
        }
        
        // Limitar número de notícias por ticker
        const tickerSamples = news.slice(0, Math.min(news.length, 5));
        
        // Analisar cada notícia
        for (const article of tickerSamples) {
          const analysis = await this.analyzer.analyzeArticle(article, ticker);
          
          // Como não temos sentimento esperado para notícias reais,
          // vamos usar uma abordagem de consistência
          
          // Analisar com regras simples para comparação
          const ruleBasedSentiment = this.analyzer.analyzeSentimentWithRules(
            [article.title, article.description, article.content].filter(Boolean).join(' ').toLowerCase()
          );
          
          const match = this.compareSentiment(ruleBasedSentiment, analysis.sentiment);
          
          results.samples.push({
            ticker,
            title: article.title,
            expected: ruleBasedSentiment,
            actual: analysis.sentiment,
            match,
            isReal: true
          });
        }
      } catch (error) {
        console.error(`Erro ao validar ${ticker} com amostras reais:`, error);
      }
    }
    
    // Calcular métricas
    if (results.samples.length > 0) {
      results.metrics = this.calculateMetrics(results.samples);
      console.log(`Validação real concluída: ${results.metrics.consistency.toFixed(2)}% de consistência`);
    } else {
      results.metrics = { accuracy: 0, precision: 0, recall: 0, consistency: 0 };
      console.warn('Não foi possível realizar validação com amostras reais');
    }
    
    return results;
  }
  
  /**
   * Valida o analisador com amostras de benchmark
   * @returns {Promise<Object>} - Resultados da validação
   */
  async validateWithBenchmarkSamples() {
    console.log('Validando com amostras de benchmark...');
    
    const results = {
      samples: [],
      metrics: {}
    };
    
    // Amostras de benchmark com sentimento conhecido
    const benchmarkSamples = [
      {
        title: "Resultados do KNRI11 superam expectativas com aumento de 15% nos dividendos",
        content: "O fundo imobiliário KNRI11 divulgou resultados trimestrais acima das expectativas do mercado, com aumento de 15% nos dividendos distribuídos aos cotistas. A taxa de ocupação dos imóveis atingiu 98%, o maior nível dos últimos três anos.",
        expectedSentiment: { label: "positive", score: 0.7 },
        ticker: "KNRI11"
      },
      {
        title: "HGLG11 anuncia nova aquisição estratégica de galpão logístico",
        content: "O HGLG11 comunicou hoje a aquisição de um novo galpão logístico em localização estratégica, que deve aumentar a receita imobiliária do fundo em aproximadamente 8% nos próximos meses. O cap rate da operação ficou em 9.5%, acima da média do mercado.",
        expectedSentiment: { label: "positive", score: 0.6 },
        ticker: "HGLG11"
      },
      {
        title: "MXRF11 reporta aumento na inadimplência e queda nos rendimentos",
        content: "O fundo imobiliário MXRF11 divulgou aumento na taxa de inadimplência para 5.8%, impactando negativamente os rendimentos distribuídos no mês. A gestão informou que está tomando medidas para reverter a situação, mas o cenário de curto prazo permanece desafiador.",
        expectedSentiment: { label: "negative", score: -0.5 },
        ticker: "MXRF11"
      },
      {
        title: "XPLG11 mantém distribuição de dividendos estável pelo terceiro mês consecutivo",
        content: "O XPLG11 anunciou a manutenção do valor de dividendos pelo terceiro mês consecutivo, em linha com as expectativas do mercado. A gestão destacou a estabilidade dos contratos de locação como fator positivo em meio ao cenário econômico atual.",
        expectedSentiment: { label: "neutral", score: 0.1 },
        ticker: "XPLG11"
      },
      {
        title: "Vacância em shopping centers impacta resultados do VISC11",
        content: "O fundo VISC11, especializado em shopping centers, reportou aumento na taxa de vacância em seus empreendimentos, refletindo a dificuldade do setor de varejo. Os dividendos distribuídos sofreram redução de 12% em comparação ao trimestre anterior.",
        expectedSentiment: { label: "negative", score: -0.6 },
        ticker: "VISC11"
      },
      {
        title: "Analistas recomendam KNRI11 como melhor opção de FII para 2025",
        content: "Um relatório publicado por importante casa de análise destacou o KNRI11 como a melhor opção de investimento em fundos imobiliários para 2025, citando a qualidade dos ativos e a gestão profissional como diferenciais competitivos.",
        expectedSentiment: { label: "positive", score: 0.8 },
        ticker: "KNRI11"
      },
      {
        title: "HGLG11 divulga relatório gerencial sem grandes novidades",
        content: "O fundo HGLG11 divulgou seu relatório gerencial mensal sem apresentar grandes novidades. A taxa de ocupação e os valores de locação permaneceram estáveis, assim como a previsão de dividendos para os próximos meses.",
        expectedSentiment: { label: "neutral", score: 0 },
        ticker: "HGLG11"
      },
      {
        title: "MXRF11 anuncia nova emissão de cotas com potencial diluição",
        content: "O MXRF11 comunicou ao mercado uma nova emissão de cotas que pode resultar em diluição para os atuais cotistas. Embora a captação vise novas aquisições, analistas apontam preocupação com o timing da oferta em momento de spreads comprimidos.",
        expectedSentiment: { label: "negative", score: -0.4 },
        ticker: "MXRF11"
      },
      {
        title: "XPLG11 conclui renegociação de contratos com principais inquilinos",
        content: "O fundo XPLG11 concluiu com sucesso a renegociação de contratos com seus principais inquilinos, garantindo previsibilidade de receita para os próximos 5 anos. Os novos contratos incluem cláusulas de reajuste acima da inflação.",
        expectedSentiment: { label: "positive", score: 0.5 },
        ticker: "XPLG11"
      },
      {
        title: "Recuperação do setor de shopping centers beneficia VISC11",
        content: "Dados recentes mostram recuperação consistente no fluxo de visitantes e nas vendas dos shopping centers, o que deve beneficiar o VISC11 nos próximos trimestres. A gestão projeta retorno gradual aos níveis de dividendos pré-pandemia.",
        expectedSentiment: { label: "positive", score: 0.6 },
        ticker: "VISC11"
      }
    ];
    
    // Analisar cada amostra
    for (const sample of benchmarkSamples) {
      const article = {
        title: sample.title,
        description: "",
        content: sample.content,
        url: `https://example.com/benchmark/${sample.ticker}`,
        publishedAt: new Date().toISOString(),
        source: "Benchmark"
      };
      
      const analysis = await this.analyzer.analyzeArticle(article, sample.ticker);
      
      const match = this.compareSentiment(sample.expectedSentiment, analysis.sentiment);
      
      results.samples.push({
        ticker: sample.ticker,
        title: sample.title,
        expected: sample.expectedSentiment,
        actual: analysis.sentiment,
        match,
        isBenchmark: true
      });
    }
    
    // Calcular métricas
    results.metrics = this.calculateMetrics(results.samples);
    
    console.log(`Validação benchmark concluída: ${results.metrics.accuracy.toFixed(2)}% de acurácia`);
    
    return results;
  }
  
  /**
   * Gera amostras sintéticas para validação
   * @returns {Array} - Array de amostras sintéticas
   */
  generateSyntheticSamples() {
    const samples = [];
    
    // Gerar amostras para cada ticker
    for (const ticker of this.config.testTickers) {
      // Gerar notícias sintéticas
      const syntheticNews = this.analyzer.generateSyntheticNews(
        ticker,
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      );
      
      // Selecionar algumas notícias aleatórias
      const selectedNews = this.selectRandomSamples(syntheticNews, 4);
      
      // Para cada notícia, definir sentimento esperado com base no título e conteúdo
      selectedNews.forEach(article => {
        // Palavras-chave positivas e negativas para determinar sentimento esperado
        const positiveKeywords = [
          'crescimento', 'aumento', 'alta', 'valorização', 'lucro',
          'positivo', 'oportunidade', 'sucesso', 'excelente'
        ];
        
        const negativeKeywords = [
          'queda', 'redução', 'baixa', 'desvalorização', 'prejuízo',
          'negativo', 'risco', 'fracasso', 'problema'
        ];
        
        // Combinar título e conteúdo
        const text = [article.title, article.content].join(' ').toLowerCase();
        
        // Contar ocorrências
        let positiveCount = 0;
        let negativeCount = 0;
        
        positiveKeywords.forEach(word => {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          const matches = text.match(regex);
          if (matches) positiveCount += matches.length;
        });
        
        negativeKeywords.forEach(word => {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          const matches = text.match(regex);
          if (matches) negativeCount += matches.length;
        });
        
        // Determinar sentimento esperado
        let expectedSentiment;
        
        if (positiveCount > negativeCount + 1) {
          const score = Math.min(0.3 + (positiveCount - negativeCount) * 0.1, 0.9);
          expectedSentiment = { label: 'positive', score };
        } else if (negativeCount > positiveCount + 1) {
          const score = Math.max(-0.3 - (negativeCount - positiveCount) * 0.1, -0.9);
          expectedSentiment = { label: 'negative', score };
        } else {
          const score = (positiveCount - negativeCount) * 0.1;
          expectedSentiment = { label: 'neutral', score };
        }
        
        samples.push({
          ticker,
          article,
          expectedSentiment
        });
      });
    }
    
    return samples;
  }
  
  /**
   * Seleciona amostras aleatórias de um array
   * @param {Array} array - Array de itens
   * @param {Number} count - Número de itens a selecionar
   * @returns {Array} - Itens selecionados
   */
  selectRandomSamples(array, count) {
    if (!array || array.length === 0) return [];
    
    const result = [];
    const maxCount = Math.min(count, array.length);
    const indices = new Set();
    
    while (indices.size < maxCount) {
      const index = Math.floor(Math.random() * array.length);
      if (!indices.has(index)) {
        indices.add(index);
        result.push(array[index]);
      }
    }
    
    return result;
  }
  
  /**
   * Compara dois resultados de sentimento
   * @param {Object} expected - Sentimento esperado
   * @param {Object} actual - Sentimento obtido
   * @returns {Object} - Resultado da comparação
   */
  compareSentiment(expected, actual) {
    // Verificar se os labels correspondem
    const labelMatch = this.compareLabels(expected.label, actual.label);
    
    // Verificar se os scores estão próximos
    const scoreThreshold = 0.3; // Diferença máxima aceitável
    const scoreDiff = Math.abs(expected.score - actual.score);
    const scoreMatch = scoreDiff <= scoreThreshold;
    
    // Calcular pontuação de similaridade (0-1)
    const similarity = Math.max(0, 1 - (scoreDiff / 2));
    
    return {
      labelMatch,
      scoreMatch,
      similarity,
      scoreDiff
    };
  }
  
  /**
   * Compara labels de sentimento
   * @param {String} expected - Label esperado
   * @param {String} actual - Label obtido
   * @returns {Boolean} - Se os labels são compatíveis
   */
  compareLabels(expected, actual) {
    // Mapeamento de labels para comparação
    const labelMap = {
      'very_positive': ['very_positive', 'positive'],
      'positive': ['very_positive', 'positive'],
      'neutral': ['neutral'],
      'negative': ['negative', 'very_negative'],
      'very_negative': ['negative', 'very_negative']
    };
    
    // Se o label esperado não estiver no mapa, comparar diretamente
    if (!labelMap[expected]) {
      return expected === actual;
    }
    
    // Verificar se o label obtido está entre os compatíveis
    return labelMap[expected].includes(actual);
  }
  
  /**
   * Calcula métricas de avaliação
   * @param {Array} samples - Amostras analisadas
   * @returns {Object} - Métricas calculadas
   */
  calculateMetrics(samples) {
    if (!samples || samples.length === 0) {
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        consistency: 0
      };
    }
    
    // Contadores para métricas
    let correctLabels = 0;
    let correctScores = 0;
    
    // Contadores para precision/recall
    const confusionMatrix = {
      positive: { truePositive: 0, falsePositive: 0, falseNegative: 0 },
      negative: { truePositive: 0, falsePositive: 0, falseNegative: 0 },
      neutral: { truePositive: 0, falsePositive: 0, falseNegative: 0 }
    };
    
    // Processar cada amostra
    samples.forEach(sample => {
      // Contar acertos de label e score
      if (sample.match.labelMatch) correctLabels++;
      if (sample.match.scoreMatch) correctScores++;
      
      // Atualizar matriz de confusão
      const expected = this.normalizeLabel(sample.expected.label);
      const actual = this.normalizeLabel(sample.actual.label);
      
      if (expected === actual) {
        confusionMatrix[expected].truePositive++;
      } else {
        confusionMatrix[expected].falseNegative++;
        confusionMatrix[actual].falsePositive++;
      }
    });
    
    // Calcular métricas
    const accuracy = (correctLabels / samples.length) * 100;
    const scoreAccuracy = (correctScores / samples.length) * 100;
    
    // Calcular precision e recall para cada classe
    const metrics = {};
    
    Object.keys(confusionMatrix).forEach(label => {
      const cm = confusionMatrix[label];
      
      const precision = cm.truePositive / (cm.truePositive + cm.falsePositive) || 0;
      const recall = cm.truePositive / (cm.truePositive + cm.falseNegative) || 0;
      const f1 = 2 * (precision * recall) / (precision + recall) || 0;
      
      metrics[label] = { precision, recall, f1 };
    });
    
    // Calcular médias
    const avgPrecision = Object.values(metrics).reduce((sum, m) => sum + m.precision, 0) / 3;
    const avgRecall = Object.values(metrics).reduce((sum, m) => sum + m.recall, 0) / 3;
    const avgF1 = Object.values(metrics).reduce((sum, m) => sum + m.f1, 0) / 3;
    
    // Calcular consistência (média de similaridade)
    const consistency = samples.reduce((sum, sample) => sum + sample.match.similarity, 0) / samples.length * 100;
    
    return {
      accuracy,
      scoreAccuracy,
      precision: avgPrecision * 100,
      recall: avgRecall * 100,
      f1Score: avgF1 * 100,
      consistency,
      byLabel: metrics,
      confusionMatrix
    };
  }
  
  /**
   * Normaliza label de sentimento para cálculo de métricas
   * @param {String} label - Label original
   * @returns {String} - Label normalizado
   */
  normalizeLabel(label) {
    if (label === 'very_positive') return 'positive';
    if (label === 'very_negative') return 'negative';
    if (label === 'neutral') return 'neutral';
    return label;
  }
  
  /**
   * Gera resumo dos resultados de validação
   * @param {Object} syntheticResults - Resultados de amostras sintéticas
   * @param {Object} realResults - Resultados de amostras reais
   * @param {Object} benchmarkResults - Resultados de amostras de benchmark
   * @returns {Object} - Resumo consolidado
   */
  generateSummary(syntheticResults, realResults, benchmarkResults) {
    // Calcular acurácia geral
    let totalSamples = 0;
    let totalCorrect = 0;
    
    // Adicionar resultados sintéticos
    if (syntheticResults && syntheticResults.samples) {
      totalSamples += syntheticResults.samples.length;
      totalCorrect += syntheticResults.samples.filter(s => s.match.labelMatch).length;
    }
    
    // Adicionar resultados de benchmark
    if (benchmarkResults && benchmarkResults.samples) {
      totalSamples += benchmarkResults.samples.length;
      totalCorrect += benchmarkResults.samples.filter(s => s.match.labelMatch).length;
    }
    
    // Calcular acurácia geral
    const overallAccuracy = totalSamples > 0 ? (totalCorrect / totalSamples) * 100 : 0;
    
    // Calcular consistência com amostras reais
    const realConsistency = realResults && realResults.metrics ? realResults.metrics.consistency : 0;
    
    // Identificar pontos fortes e fracos
    const strengths = [];
    const weaknesses = [];
    
    // Analisar acurácia por label
    if (benchmarkResults && benchmarkResults.metrics && benchmarkResults.metrics.byLabel) {
      const byLabel = benchmarkResults.metrics.byLabel;
      
      // Identificar melhor e pior label
      let bestLabel = null;
      let worstLabel = null;
      let bestF1 = -1;
      let worstF1 = 2;
      
      Object.entries(byLabel).forEach(([label, metrics]) => {
        if (metrics.f1 > bestF1) {
          bestF1 = metrics.f1;
          bestLabel = label;
        }
        
        if (metrics.f1 < worstF1) {
          worstF1 = metrics.f1;
          worstLabel = label;
        }
      });
      
      if (bestLabel) {
        strengths.push(`Melhor desempenho em sentimentos ${bestLabel} (F1: ${(bestF1 * 100).toFixed(1)}%)`);
      }
      
      if (worstLabel) {
        weaknesses.push(`Desempenho mais fraco em sentimentos ${worstLabel} (F1: ${(worstF1 * 100).toFixed(1)}%)`);
      }
    }
    
    // Analisar consistência
    if (realConsistency > 80) {
      strengths.push(`Alta consistência com amostras reais (${realConsistency.toFixed(1)}%)`);
    } else if (realConsistency < 60) {
      weaknesses.push(`Baixa consistência com amostras reais (${realConsistency.toFixed(1)}%)`);
    }
    
    // Analisar acurácia geral
    if (overallAccuracy > 80) {
      strengths.push(`Alta acurácia geral (${overallAccuracy.toFixed(1)}%)`);
    } else if (overallAccuracy < 60) {
      weaknesses.push(`Baixa acurácia geral (${overallAccuracy.toFixed(1)}%)`);
    }
    
    return {
      overallAccuracy,
      realConsistency,
      syntheticAccuracy: syntheticResults ? syntheticResults.metrics.accuracy : 0,
      benchmarkAccuracy: benchmarkResults ? benchmarkResults.metrics.accuracy : 0,
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
          sampleCount: this.results.synthetic.samples.length
        } : null,
        real: this.results.real ? {
          consistency: this.results.real.metrics.consistency,
          sampleCount: this.results.real.samples.length
        } : null,
        benchmark: this.results.benchmark ? {
          accuracy: this.results.benchmark.metrics.accuracy,
          sampleCount: this.results.benchmark.samples.length
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
      recommendations.push('Melhorar o modelo de análise de sentimento com mais dados de treinamento');
    }
    
    // Verificar consistência
    if (this.results.summary.realConsistency < 70) {
      recommendations.push('Ajustar o modelo para melhor consistência com notícias reais');
    }
    
    // Verificar pontos fracos
    if (this.results.summary.weaknesses.length > 0) {
      this.results.summary.weaknesses.forEach(weakness => {
        if (weakness.includes('sentimentos')) {
          const sentimentType = weakness.match(/sentimentos (\w+)/)[1];
          recommendations.push(`Melhorar a detecção de sentimentos "${sentimentType}" com exemplos adicionais`);
        }
      });
    }
    
    // Recomendações gerais
    recommendations.push('Implementar atualização periódica do modelo para acompanhar mudanças no mercado');
    recommendations.push('Considerar o uso de fontes de notícias adicionais para maior cobertura');
    
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

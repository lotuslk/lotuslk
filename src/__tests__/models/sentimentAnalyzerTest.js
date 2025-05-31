// src/__tests__/models/sentimentAnalyzerTest.js
import { SentimentAnalyzer } from '../../models/sentimentAnalyzer';
import { SentimentAnalyzerValidator } from '../../validation/sentimentAnalyzerValidator';

/**
 * Testes automatizados para o modelo de análise de sentimento
 * 
 * Este arquivo contém testes unitários e de integração para validar
 * o comportamento e a precisão do analisador de sentimento para notícias de FIIs.
 */

// Mock de artigos para testes
const mockArticles = [
  {
    title: "KNRI11 apresenta crescimento de dividendos no trimestre",
    description: "O fundo imobiliário KNRI11 reportou aumento nos dividendos distribuídos no último trimestre.",
    content: "O fundo imobiliário KNRI11 anunciou um aumento de dividendos no último trimestre, refletindo o bom desempenho dos ativos em seu portfólio. Segundo o relatório gerencial, a taxa de ocupação se manteve estável e os contratos de locação foram reajustados acima da inflação.",
    url: "https://example.com/news/knri11-dividendos",
    publishedAt: "2024-05-15T10:30:00Z",
    source: "InfoMoney"
  },
  {
    title: "HGLG11 anuncia nova aquisição de imóvel comercial",
    description: "Fundo adquire propriedade comercial para expandir portfólio.",
    content: "O HGLG11 anunciou hoje a aquisição de um novo imóvel comercial para seu portfólio. A transação, avaliada em milhões de reais, deve contribuir para o aumento da receita imobiliária do fundo nos próximos meses. A gestão afirma que a compra está alinhada com a estratégia de diversificação geográfica.",
    url: "https://example.com/news/hglg11-aquisicao",
    publishedAt: "2024-05-10T14:45:00Z",
    source: "Valor Econômico"
  },
  {
    title: "Resultados do MXRF11 ficam abaixo das expectativas",
    description: "Fundo reporta queda nos rendimentos distribuídos aos cotistas.",
    content: "O MXRF11 divulgou resultados abaixo das expectativas do mercado para o último trimestre. A distribuição de rendimentos sofreu redução em comparação ao período anterior, principalmente devido ao aumento da vacância em alguns imóveis do portfólio e à renegociação de contratos com valores reduzidos.",
    url: "https://example.com/news/mxrf11-resultados",
    publishedAt: "2024-05-05T09:15:00Z",
    source: "Suno Research"
  },
  {
    title: "XPLG11 registra queda na vacância de seus imóveis",
    description: "Taxa de ocupação do fundo atinge novo recorde.",
    content: "O fundo imobiliário XPLG11 divulgou que a taxa de vacância de seus imóveis caiu para o menor nível dos últimos anos. O resultado é atribuído à estratégia de gestão ativa e à qualidade dos ativos em localizações privilegiadas, que continuam atraindo inquilinos mesmo em cenários econômicos desafiadores.",
    url: "https://example.com/news/xplg11-vacancia",
    publishedAt: "2024-05-01T11:20:00Z",
    source: "InfoFII"
  },
  {
    title: "VISC11 enfrenta desafios com inadimplência de inquilinos",
    description: "Aumento na taxa de inadimplência pressiona resultados do fundo.",
    content: "O fundo imobiliário VISC11 reportou um aumento na taxa de inadimplência de seus inquilinos no último trimestre. Segundo comunicado aos investidores, a gestão está tomando medidas para renegociar contratos e reduzir o impacto nos rendimentos distribuídos aos cotistas.",
    url: "https://example.com/news/visc11-inadimplencia",
    publishedAt: "2024-04-28T16:10:00Z",
    source: "Exame"
  }
];

// Sentimentos esperados para validação
const expectedSentiments = {
  "KNRI11 apresenta crescimento de dividendos no trimestre": "positive",
  "HGLG11 anuncia nova aquisição de imóvel comercial": "positive",
  "Resultados do MXRF11 ficam abaixo das expectativas": "negative",
  "XPLG11 registra queda na vacância de seus imóveis": "positive",
  "VISC11 enfrenta desafios com inadimplência de inquilinos": "negative"
};

describe('SentimentAnalyzer - Modelo Básico', () => {
  let analyzer;

  beforeEach(async () => {
    // Inicializar o analisador antes de cada teste
    analyzer = new SentimentAnalyzer({
      usePretrained: false, // Usar apenas regras para testes mais rápidos
      useCache: false
    });
    
    await analyzer.initialize();
  });

  test('deve inicializar corretamente', () => {
    expect(analyzer).toBeDefined();
    expect(analyzer.initialized).toBe(true);
  });

  test('deve analisar o sentimento de um artigo individual', async () => {
    const article = mockArticles[0]; // Artigo positivo sobre KNRI11
    const ticker = 'KNRI11';
    
    const analysis = await analyzer.analyzeArticle(article, ticker);
    
    expect(analysis).toBeDefined();
    expect(analysis).toHaveProperty('sentiment');
    expect(analysis.sentiment).toHaveProperty('label');
    expect(analysis.sentiment).toHaveProperty('score');
    expect(analysis.sentiment).toHaveProperty('confidence');
    
    // Verificar que o sentimento é positivo (como esperado para este artigo)
    expect(analysis.sentiment.label).toBe('positive');
    expect(analysis.sentiment.score).toBeGreaterThan(0);
  });

  test('deve calcular relevância corretamente', async () => {
    const relevantArticle = mockArticles[0]; // Artigo sobre KNRI11
    const irrelevantArticle = {
      title: "Mercado de ações tem dia de alta",
      description: "Índices sobem com notícias positivas da economia.",
      content: "O mercado de ações brasileiro fechou em alta nesta quinta-feira, impulsionado por dados econômicos positivos e pelo cenário externo favorável.",
      url: "https://example.com/news/mercado-alta",
      publishedAt: "2024-05-15T18:00:00Z",
      source: "InfoMoney"
    };
    
    const relevantAnalysis = await analyzer.analyzeArticle(relevantArticle, 'KNRI11');
    const irrelevantAnalysis = await analyzer.analyzeArticle(irrelevantArticle, 'KNRI11');
    
    expect(relevantAnalysis.relevance).toBeGreaterThan(0.5);
    expect(irrelevantAnalysis.relevance).toBeLessThan(0.5);
  });

  test('deve extrair entidades e tópicos corretamente', async () => {
    const article = mockArticles[1]; // Artigo sobre aquisição do HGLG11
    const analysis = await analyzer.analyzeArticle(article, 'HGLG11');
    
    expect(analysis).toHaveProperty('entities');
    expect(analysis).toHaveProperty('topics');
    expect(Array.isArray(analysis.entities)).toBe(true);
    expect(Array.isArray(analysis.topics)).toBe(true);
    
    // Verificar se o tópico de aquisição foi detectado
    expect(analysis.topics).toContain('aquisição');
  });

  test('deve analisar múltiplos artigos em lote', async () => {
    const ticker = 'KNRI11';
    const results = await analyzer.analyzeArticles(mockArticles, ticker);
    
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(mockArticles.length);
    
    // Verificar que todos os artigos têm análise de sentimento
    results.forEach(result => {
      expect(result).toHaveProperty('sentiment');
      expect(result.sentiment).toHaveProperty('label');
    });
    
    // Verificar que os artigos estão ordenados por relevância
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].relevance).toBeGreaterThanOrEqual(results[i + 1].relevance);
    }
  });

  test('deve gerar nuvem de palavras a partir dos artigos', async () => {
    const articles = await analyzer.analyzeArticles(mockArticles, 'KNRI11');
    const wordcloud = analyzer.generateWordcloud(articles);
    
    expect(Array.isArray(wordcloud)).toBe(true);
    expect(wordcloud.length).toBeGreaterThan(0);
    
    // Verificar estrutura dos itens da nuvem
    const firstWord = wordcloud[0];
    expect(firstWord).toHaveProperty('text');
    expect(firstWord).toHaveProperty('value');
    expect(typeof firstWord.text).toBe('string');
    expect(typeof firstWord.value).toBe('number');
  });

  test('deve calcular sentimento agregado corretamente', async () => {
    const articles = await analyzer.analyzeArticles(mockArticles, 'KNRI11');
    const aggregated = analyzer.calculateAggregatedSentiment(articles);
    
    expect(aggregated).toHaveProperty('score');
    expect(aggregated).toHaveProperty('label');
    expect(aggregated).toHaveProperty('confidence');
    
    // Como temos 3 positivos e 2 negativos, o sentimento deve ser levemente positivo
    expect(aggregated.score).toBeGreaterThan(0);
  });

  test('deve lidar com artigos sem conteúdo', async () => {
    const emptyArticle = {
      title: "",
      description: "",
      content: "",
      url: "https://example.com/empty",
      publishedAt: "2024-05-15T10:30:00Z",
      source: "Test"
    };
    
    const analysis = await analyzer.analyzeArticle(emptyArticle, 'KNRI11');
    
    expect(analysis).toBeDefined();
    expect(analysis.sentiment).toHaveProperty('label');
    expect(analysis.sentiment.label).toBe('neutral');
    expect(analysis.relevance).toBeLessThan(0.2);
  });
});

describe('SentimentAnalyzer - Análise de Notícias Completas', () => {
  let analyzer;

  beforeEach(async () => {
    analyzer = new SentimentAnalyzer({
      usePretrained: false,
      useCache: false
    });
    
    await analyzer.initialize();
    
    // Mock da função fetchNews para não depender de APIs externas
    analyzer.fetchNews = jest.fn().mockImplementation((ticker) => {
      return Promise.resolve(mockArticles.filter(article => 
        article.title.includes(ticker) || article.content.includes(ticker)
      ));
    });
  });

  test('deve analisar notícias para um ticker específico', async () => {
    const result = await analyzer.analyzeNewsSentiment('KNRI11', '2024-05-01', '2024-05-31');
    
    expect(result).toBeDefined();
    expect(result.ticker).toBe('KNRI11');
    expect(result).toHaveProperty('articles');
    expect(result).toHaveProperty('wordcloud');
    expect(result).toHaveProperty('aggregated');
    
    // Verificar que apenas artigos relevantes foram incluídos
    expect(result.articles.length).toBeGreaterThan(0);
    expect(result.articles.length).toBeLessThanOrEqual(mockArticles.length);
    
    // Verificar sentimento agregado
    expect(result.aggregated).toHaveProperty('score');
    expect(result.aggregated).toHaveProperty('label');
  });

  test('deve retornar resultado vazio quando não há notícias', async () => {
    // Sobrescrever mock para retornar array vazio
    analyzer.fetchNews = jest.fn().mockImplementation(() => Promise.resolve([]));
    
    const result = await analyzer.analyzeNewsSentiment('UNKNOWN11', '2024-05-01', '2024-05-31');
    
    expect(result).toBeDefined();
    expect(result.ticker).toBe('UNKNOWN11');
    expect(result.articles).toEqual([]);
    expect(result.aggregated.score).toBe(0);
    expect(result.aggregated.label).toBe('neutral');
  });

  test('deve usar cache quando configurado', async () => {
    // Criar analisador com cache ativado
    const analyzerWithCache = new SentimentAnalyzer({
      usePretrained: false,
      useCache: true
    });
    
    await analyzerWithCache.initialize();
    
    // Mock da função fetchNews
    analyzerWithCache.fetchNews = jest.fn().mockImplementation(() => Promise.resolve(mockArticles));
    
    // Primeira chamada deve buscar notícias
    await analyzerWithCache.analyzeNewsSentiment('KNRI11', '2024-05-01', '2024-05-31');
    
    // Verificar que fetchNews foi chamado
    expect(analyzerWithCache.fetchNews).toHaveBeenCalledTimes(1);
    
    // Resetar o mock
    analyzerWithCache.fetchNews.mockClear();
    
    // Segunda chamada deve usar cache
    await analyzerWithCache.analyzeNewsSentiment('KNRI11', '2024-05-01', '2024-05-31');
    
    // Verificar que fetchNews não foi chamado novamente
    expect(analyzerWithCache.fetchNews).not.toHaveBeenCalled();
  });

  test('deve gerar notícias sintéticas quando necessário', async () => {
    const syntheticNews = analyzer.generateSyntheticNews('KNRI11', '2024-05-01', '2024-05-31');
    
    expect(Array.isArray(syntheticNews)).toBe(true);
    expect(syntheticNews.length).toBeGreaterThan(0);
    
    // Verificar estrutura das notícias sintéticas
    const firstNews = syntheticNews[0];
    expect(firstNews).toHaveProperty('title');
    expect(firstNews).toHaveProperty('content');
    expect(firstNews).toHaveProperty('publishedAt');
    expect(firstNews).toHaveProperty('synthetic');
    expect(firstNews.synthetic).toBe(true);
  });
});

describe('SentimentAnalyzerValidator - Validação do Modelo', () => {
  let validator;
  let analyzer;

  beforeEach(async () => {
    analyzer = new SentimentAnalyzer({
      usePretrained: false,
      useCache: false
    });
    
    validator = new SentimentAnalyzerValidator({
      analyzerConfig: {
        usePretrained: false,
        useCache: false
      }
    });
    
    await validator.initialize();
  });

  test('deve validar o analisador com amostras sintéticas', async () => {
    const results = await validator.validateWithSyntheticSamples();
    
    expect(results).toBeDefined();
    expect(results).toHaveProperty('samples');
    expect(results).toHaveProperty('metrics');
    expect(results.metrics).toHaveProperty('accuracy');
    expect(results.metrics).toHaveProperty('precision');
    expect(results.metrics).toHaveProperty('recall');
    
    // Verificar que a acurácia está em um intervalo razoável
    expect(results.metrics.accuracy).toBeGreaterThan(50);
  });

  test('deve validar o analisador com amostras de benchmark', async () => {
    const results = await validator.validateWithBenchmarkSamples();
    
    expect(results).toBeDefined();
    expect(results).toHaveProperty('samples');
    expect(results).toHaveProperty('metrics');
    
    // Verificar que todas as amostras de benchmark foram processadas
    expect(results.samples.length).toBeGreaterThan(5);
    
    // Verificar que cada amostra tem resultado esperado e atual
    results.samples.forEach(sample => {
      expect(sample).toHaveProperty('expected');
      expect(sample).toHaveProperty('actual');
      expect(sample).toHaveProperty('match');
    });
  });

  test('deve gerar relatório de validação completo', async () => {
    // Executar validação primeiro
    await validator.validateWithSamples();
    
    const report = validator.generateReport();
    
    expect(report).toBeDefined();
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('details');
    expect(report).toHaveProperty('recommendations');
    
    // Verificar que o relatório contém métricas de performance
    expect(report.summary).toHaveProperty('overallAccuracy');
    
    // Verificar que há recomendações
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  test('deve comparar labels de sentimento corretamente', () => {
    // Testar casos de correspondência exata
    expect(validator.compareLabels('positive', 'positive')).toBe(true);
    expect(validator.compareLabels('negative', 'negative')).toBe(true);
    expect(validator.compareLabels('neutral', 'neutral')).toBe(true);
    
    // Testar casos de correspondência aproximada
    expect(validator.compareLabels('very_positive', 'positive')).toBe(true);
    expect(validator.compareLabels('very_negative', 'negative')).toBe(true);
    
    // Testar casos de não correspondência
    expect(validator.compareLabels('positive', 'negative')).toBe(false);
    expect(validator.compareLabels('negative', 'neutral')).toBe(false);
  });

  test('deve calcular métricas de avaliação corretamente', () => {
    const samples = [
      { match: { labelMatch: true, scoreMatch: true, similarity: 0.9 } },
      { match: { labelMatch: true, scoreMatch: false, similarity: 0.7 } },
      { match: { labelMatch: false, scoreMatch: true, similarity: 0.6 } },
      { match: { labelMatch: true, scoreMatch: true, similarity: 0.8 } }
    ];
    
    const metrics = validator.calculateMetrics(samples);
    
    expect(metrics).toHaveProperty('accuracy');
    expect(metrics).toHaveProperty('scoreAccuracy');
    expect(metrics).toHaveProperty('consistency');
    
    // 3 de 4 labels corretos = 75%
    expect(metrics.accuracy).toBe(75);
    
    // 3 de 4 scores corretos = 75%
    expect(metrics.scoreAccuracy).toBe(75);
    
    // Média de similaridade = (0.9 + 0.7 + 0.6 + 0.8) / 4 * 100 = 75%
    expect(metrics.consistency).toBe(75);
  });
});

// Testes de integração
describe('Integração entre Analyzer e Validator', () => {
  test('deve validar análises em pipeline completo', async () => {
    const analyzer = new SentimentAnalyzer({
      usePretrained: false,
      useCache: false
    });
    
    const validator = new SentimentAnalyzerValidator({
      analyzerConfig: {
        usePretrained: false,
        useCache: false
      }
    });
    
    await analyzer.initialize();
    
    // Analisar artigos
    const articles = await analyzer.analyzeArticles(mockArticles, 'KNRI11');
    
    // Validar análises contra sentimentos esperados
    const validationResults = [];
    
    for (const article of articles) {
      const expectedLabel = expectedSentiments[article.title];
      if (expectedLabel) {
        const match = validator.compareLabels(expectedLabel, article.sentiment.label);
        validationResults.push({ article, expectedLabel, actualLabel: article.sentiment.label, match });
      }
    }
    
    // Calcular acurácia
    const correctCount = validationResults.filter(r => r.match).length;
    const accuracy = (correctCount / validationResults.length) * 100;
    
    expect(validationResults.length).toBeGreaterThan(0);
    expect(accuracy).toBeGreaterThan(60);
  });
});

// Testes de robustez
describe('Robustez do Analisador de Sentimento', () => {
  let analyzer;

  beforeEach(async () => {
    analyzer = new SentimentAnalyzer({
      usePretrained: false,
      useCache: false
    });
    
    await analyzer.initialize();
  });

  test('deve lidar com textos ambíguos', async () => {
    const ambiguousArticle = {
      title: "KNRI11 mantém dividendos apesar de aumento na vacância",
      description: "Fundo consegue manter distribuição mesmo com desafios.",
      content: "O KNRI11 anunciou que manterá o valor dos dividendos distribuídos, apesar do aumento na taxa de vacância de seus imóveis. A gestão conseguiu compensar a perda de receita com renegociações de contratos existentes.",
      url: "https://example.com/news/knri11-dividendos-vacancia",
      publishedAt: "2024-05-15T10:30:00Z",
      source: "InfoMoney"
    };
    
    const analysis = await analyzer.analyzeArticle(ambiguousArticle, 'KNRI11');
    
    expect(analysis).toBeDefined();
    expect(analysis.sentiment).toHaveProperty('label');
    expect(analysis.sentiment).toHaveProperty('confidence');
    
    // A confiança deve ser menor em textos ambíguos
    expect(analysis.sentiment.confidence).toBeLessThan(0.8);
  });

  test('deve lidar com textos muito curtos', async () => {
    const shortArticle = {
      title: "KNRI11 divulga resultados",
      description: "",
      content: "Resultados divulgados hoje.",
      url: "https://example.com/news/knri11-resultados",
      publishedAt: "2024-05-15T10:30:00Z",
      source: "InfoMoney"
    };
    
    const analysis = await analyzer.analyzeArticle(shortArticle, 'KNRI11');
    
    expect(analysis).toBeDefined();
    expect(analysis.sentiment).toHaveProperty('label');
    
    // Textos muito curtos tendem a ser classificados como neutros
    expect(analysis.sentiment.label).toBe('neutral');
    expect(analysis.sentiment.confidence).toBeLessThan(0.6);
  });

  test('deve lidar com textos com negações', async () => {
    const negationArticle = {
      title: "KNRI11 não reduz dividendos apesar de expectativas negativas",
      description: "Fundo mantém distribuição contrariando analistas.",
      content: "Contrariando as expectativas negativas do mercado, o KNRI11 não reduziu seus dividendos no último mês. Analistas previam queda na distribuição devido aos desafios do setor.",
      url: "https://example.com/news/knri11-mantem-dividendos",
      publishedAt: "2024-05-15T10:30:00Z",
      source: "InfoMoney"
    };
    
    const analysis = await analyzer.analyzeArticle(negationArticle, 'KNRI11');
    
    expect(analysis).toBeDefined();
    expect(analysis.sentiment).toHaveProperty('label');
    
    // Este texto deve ser classificado como positivo apesar das negações
    expect(analysis.sentiment.label).toBe('positive');
  });
});

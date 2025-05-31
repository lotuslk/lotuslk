// src/models/sentimentAnalyzer.js
import axios from 'axios';
import * as tf from '@tensorflow/tfjs';

/**
 * Classe para análise de sentimento de notícias relacionadas a FIIs
 * 
 * Esta implementação utiliza uma combinação de técnicas de NLP para
 * analisar o sentimento de notícias e artigos sobre FIIs, gerando
 * insights sobre a percepção do mercado.
 */
export class SentimentAnalyzer {
  constructor(config = {}) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl || 'https://api.thelotusinvest.com',
      newsApiKey: config.newsApiKey || process.env.NEWS_API_KEY,
      maxArticles: config.maxArticles || 50, // Máximo de artigos a analisar
      relevanceThreshold: config.relevanceThreshold || 0.5, // Limiar de relevância (0-1)
      usePretrained: config.usePretrained !== undefined ? config.usePretrained : true, // Usar modelo pré-treinado
      useCache: config.useCache !== undefined ? config.useCache : true, // Usar cache para resultados
      cacheExpiration: config.cacheExpiration || 6 * 60 * 60 * 1000, // 6 horas em ms
      ...config
    };
    
    this.model = null;
    this.tokenizer = null;
    this.vocabulary = null;
    this.cache = {};
    this.initialized = false;
  }
  
  /**
   * Inicializa o analisador de sentimento
   * @returns {Promise<boolean>} - Sucesso da inicialização
   */
  async initialize() {
    try {
      if (this.initialized) return true;
      
      if (this.config.usePretrained) {
        // Carregar modelo pré-treinado
        const modelLoaded = await this.loadModel();
        
        if (!modelLoaded) {
          console.warn('Modelo pré-treinado não disponível, usando API externa para análise');
        }
      }
      
      // Carregar vocabulário para tokenização
      await this.loadVocabulary();
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Erro ao inicializar analisador de sentimento:', error);
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
        this.model = await tf.loadLayersModel('localstorage://lotus-invest-sentiment-analyzer');
        console.log('Modelo de sentimento carregado do localStorage');
        return true;
      } catch (e) {
        console.log('Modelo não encontrado no localStorage, tentando carregar do servidor');
      }
      
      // Se não estiver no localStorage, carregar do servidor
      try {
        this.model = await tf.loadLayersModel(`${this.config.apiBaseUrl}/models/sentiment/model.json`);
        
        // Salvar no localStorage para uso futuro
        await this.model.save('localstorage://lotus-invest-sentiment-analyzer');
        
        console.log('Modelo de sentimento carregado do servidor e salvo localmente');
        return true;
      } catch (e) {
        console.warn('Não foi possível carregar o modelo do servidor:', e);
        return false;
      }
    } catch (error) {
      console.error('Erro ao carregar modelo:', error);
      return false;
    }
  }
  
  /**
   * Carrega vocabulário para tokenização
   * @returns {Promise<boolean>} - Sucesso do carregamento
   */
  async loadVocabulary() {
    try {
      // Tentar carregar do localStorage primeiro
      const cachedVocab = localStorage.getItem('lotus-invest-sentiment-vocabulary');
      
      if (cachedVocab) {
        this.vocabulary = JSON.parse(cachedVocab);
        return true;
      }
      
      // Se não estiver no localStorage, carregar do servidor
      const response = await axios.get(`${this.config.apiBaseUrl}/models/sentiment/vocabulary.json`);
      this.vocabulary = response.data;
      
      // Salvar no localStorage para uso futuro
      localStorage.setItem('lotus-invest-sentiment-vocabulary', JSON.stringify(this.vocabulary));
      
      return true;
    } catch (error) {
      console.warn('Erro ao carregar vocabulário, usando vocabulário padrão:', error);
      
      // Vocabulário mínimo para funcionamento básico
      this.vocabulary = {
        wordIndex: {
          "fii": 1, "alta": 2, "queda": 3, "dividendo": 4, "rendimento": 5,
          "valorização": 6, "desvalorização": 7, "lucro": 8, "prejuízo": 9,
          "crescimento": 10, "retração": 11, "positivo": 12, "negativo": 13,
          "oportunidade": 14, "risco": 15, "mercado": 16, "investimento": 17
        },
        indexWord: {
          "1": "fii", "2": "alta", "3": "queda", "4": "dividendo", "5": "rendimento",
          "6": "valorização", "7": "desvalorização", "8": "lucro", "9": "prejuízo",
          "10": "crescimento", "11": "retração", "12": "positivo", "13": "negativo",
          "14": "oportunidade", "15": "risco", "16": "mercado", "17": "investimento"
        }
      };
      
      return false;
    }
  }
  
  /**
   * Analisa o sentimento de notícias relacionadas a um FII
   * @param {String} ticker - Código do FII
   * @param {String} startDate - Data inicial (YYYY-MM-DD)
   * @param {String} endDate - Data final (YYYY-MM-DD)
   * @returns {Promise<Object>} - Resultados da análise de sentimento
   */
  async analyzeNewsSentiment(ticker, startDate, endDate = new Date().toISOString().split('T')[0]) {
    try {
      // Verificar inicialização
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Verificar cache
      const cacheKey = `sentiment-${ticker}-${startDate}-${endDate}`;
      if (this.config.useCache && this.cache[cacheKey] && this.isCacheValid(this.cache[cacheKey].timestamp)) {
        return this.cache[cacheKey].data;
      }
      
      // Buscar notícias
      const articles = await this.fetchNews(ticker, startDate, endDate);
      
      if (!articles || articles.length === 0) {
        console.warn(`Nenhuma notícia encontrada para ${ticker} no período especificado`);
        return {
          ticker,
          articles: [],
          wordcloud: [],
          aggregated: { score: 0, label: 'neutral', confidence: 0 }
        };
      }
      
      console.log(`Encontradas ${articles.length} notícias para ${ticker}`);
      
      // Analisar sentimento de cada artigo
      const analyzedArticles = await this.analyzeArticles(articles, ticker);
      
      // Filtrar por relevância
      const relevantArticles = analyzedArticles.filter(
        article => article.relevance >= this.config.relevanceThreshold
      );
      
      console.log(`${relevantArticles.length} artigos relevantes após filtragem`);
      
      // Gerar nuvem de palavras
      const wordcloud = this.generateWordcloud(relevantArticles);
      
      // Calcular sentimento agregado
      const aggregated = this.calculateAggregatedSentiment(relevantArticles);
      
      // Formatar resultado
      const result = {
        ticker,
        articles: relevantArticles,
        wordcloud,
        aggregated
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
      console.error(`Erro ao analisar sentimento para ${ticker}:`, error);
      return {
        ticker,
        error: error.message,
        articles: [],
        wordcloud: [],
        aggregated: { score: 0, label: 'neutral', confidence: 0 }
      };
    }
  }
  
  /**
   * Busca notícias relacionadas a um FII
   * @param {String} ticker - Código do FII
   * @param {String} startDate - Data inicial (YYYY-MM-DD)
   * @param {String} endDate - Data final (YYYY-MM-DD)
   * @returns {Promise<Array>} - Array de artigos
   */
  async fetchNews(ticker, startDate, endDate) {
    try {
      // Primeiro, tentar API interna
      try {
        const response = await axios.get(`${this.config.apiBaseUrl}/news`, {
          params: {
            ticker,
            startDate,
            endDate,
            limit: this.config.maxArticles
          }
        });
        
        return response.data;
      } catch (e) {
        console.warn('Erro ao buscar notícias na API interna, tentando API externa:', e);
      }
      
      // Se API interna falhar, tentar NewsAPI
      if (this.config.newsApiKey) {
        const response = await axios.get('https://newsapi.org/v2/everything', {
          params: {
            q: `${ticker} OR "fundos imobiliários" OR FII`,
            from: startDate,
            to: endDate,
            language: 'pt',
            sortBy: 'relevancy',
            pageSize: this.config.maxArticles,
            apiKey: this.config.newsApiKey
          }
        });
        
        // Converter formato da NewsAPI para formato interno
        return response.data.articles.map(article => ({
          title: article.title,
          description: article.description,
          content: article.content,
          url: article.url,
          publishedAt: article.publishedAt,
          source: article.source.name
        }));
      }
      
      // Se não tiver API key, usar dados simulados
      return this.generateSyntheticNews(ticker, startDate, endDate);
    } catch (error) {
      console.error('Erro ao buscar notícias:', error);
      
      // Em caso de erro, usar dados simulados
      return this.generateSyntheticNews(ticker, startDate, endDate);
    }
  }
  
  /**
   * Analisa o sentimento de múltiplos artigos
   * @param {Array} articles - Array de artigos
   * @param {String} ticker - Código do FII
   * @returns {Promise<Array>} - Artigos com análise de sentimento
   */
  async analyzeArticles(articles, ticker) {
    // Analisar em lotes para não sobrecarregar
    const batchSize = 10;
    const results = [];
    
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      
      // Processar em paralelo com Promise.all
      const batchResults = await Promise.all(
        batch.map(article => this.analyzeArticle(article, ticker))
      );
      
      results.push(...batchResults);
    }
    
    // Ordenar por relevância
    return results.sort((a, b) => b.relevance - a.relevance);
  }
  
  /**
   * Analisa o sentimento de um único artigo
   * @param {Object} article - Artigo a ser analisado
   * @param {String} ticker - Código do FII
   * @returns {Promise<Object>} - Artigo com análise de sentimento
   */
  async analyzeArticle(article, ticker) {
    try {
      // Combinar título, descrição e conteúdo para análise
      const text = [
        article.title || '',
        article.description || '',
        article.content || ''
      ].join(' ').toLowerCase();
      
      // Verificar relevância para o ticker
      const relevance = this.calculateRelevance(text, ticker);
      
      let sentiment;
      
      // Se o modelo estiver disponível, usar para análise
      if (this.model && this.vocabulary) {
        sentiment = await this.analyzeSentimentWithModel(text);
      } else {
        // Caso contrário, usar análise baseada em regras
        sentiment = this.analyzeSentimentWithRules(text);
      }
      
      // Extrair entidades e tópicos
      const entities = this.extractEntities(text);
      const topics = this.extractTopics(text);
      
      return {
        ...article,
        relevance,
        sentiment,
        entities,
        topics
      };
    } catch (error) {
      console.error('Erro ao analisar artigo:', error);
      
      // Em caso de erro, retornar sentimento neutro
      return {
        ...article,
        relevance: 0.1,
        sentiment: { score: 0, label: 'neutral', confidence: 0.5 },
        entities: [],
        topics: []
      };
    }
  }
  
  /**
   * Analisa sentimento usando o modelo TensorFlow.js
   * @param {String} text - Texto a ser analisado
   * @returns {Promise<Object>} - Resultado da análise
   */
  async analyzeSentimentWithModel(text) {
    try {
      // Tokenizar texto
      const tokens = this.tokenize(text);
      
      // Converter para tensor
      const inputTensor = tf.tensor2d([tokens], [1, tokens.length]);
      
      // Fazer previsão
      const prediction = this.model.predict(inputTensor);
      const score = prediction.dataSync()[0];
      
      // Mapear score para label
      let label;
      if (score > 0.6) label = 'positive';
      else if (score < 0.4) label = 'negative';
      else label = 'neutral';
      
      // Calcular confiança
      const confidence = Math.abs(score - 0.5) * 2; // 0 a 1
      
      // Liberar tensores
      inputTensor.dispose();
      prediction.dispose();
      
      return {
        score: parseFloat((score * 2 - 1).toFixed(2)), // Converter de 0-1 para -1 a 1
        label,
        confidence: parseFloat(confidence.toFixed(2))
      };
    } catch (error) {
      console.error('Erro ao analisar sentimento com modelo:', error);
      
      // Em caso de erro, usar análise baseada em regras
      return this.analyzeSentimentWithRules(text);
    }
  }
  
  /**
   * Analisa sentimento usando regras simples (fallback)
   * @param {String} text - Texto a ser analisado
   * @returns {Object} - Resultado da análise
   */
  analyzeSentimentWithRules(text) {
    // Palavras positivas e negativas em português
    const positiveWords = [
      'alta', 'crescimento', 'lucro', 'ganho', 'valorização', 'positivo',
      'oportunidade', 'sucesso', 'excelente', 'bom', 'ótimo', 'forte',
      'aumento', 'subida', 'rentável', 'promissor', 'estável', 'seguro'
    ];
    
    const negativeWords = [
      'queda', 'retração', 'prejuízo', 'perda', 'desvalorização', 'negativo',
      'risco', 'fracasso', 'ruim', 'péssimo', 'fraco', 'baixo',
      'diminuição', 'descida', 'instável', 'inseguro', 'preocupante'
    ];
    
    // Contar ocorrências
    let positiveCount = 0;
    let negativeCount = 0;
    
    // Verificar palavras positivas
    positiveWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) positiveCount += matches.length;
    });
    
    // Verificar palavras negativas
    negativeWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) negativeCount += matches.length;
    });
    
    // Calcular score
    const total = positiveCount + negativeCount;
    
    if (total === 0) {
      return { score: 0, label: 'neutral', confidence: 0.5 };
    }
    
    const score = (positiveCount - negativeCount) / total;
    
    // Mapear score para label
    let label;
    if (score > 0.2) label = 'positive';
    else if (score < -0.2) label = 'negative';
    else label = 'neutral';
    
    // Calcular confiança
    const confidence = Math.min(0.5 + (total / 20), 0.9); // Máximo de 0.9
    
    return {
      score: parseFloat(score.toFixed(2)),
      label,
      confidence: parseFloat(confidence.toFixed(2))
    };
  }
  
  /**
   * Calcula a relevância de um texto para um ticker
   * @param {String} text - Texto a ser analisado
   * @param {String} ticker - Código do FII
   * @returns {Number} - Score de relevância (0-1)
   */
  calculateRelevance(text, ticker) {
    // Verificar menção direta ao ticker
    const tickerMention = text.includes(ticker.toLowerCase());
    
    // Verificar menção ao nome do fundo (simplificado)
    const fundName = this.getFundName(ticker);
    const fundMention = fundName ? text.includes(fundName.toLowerCase()) : false;
    
    // Verificar menção a termos relacionados
    const relatedTerms = [
      'fii', 'fundo imobiliário', 'fundos imobiliários',
      'dividendo', 'rendimento', 'cotação', 'imóvel', 'imóveis'
    ];
    
    let relatedCount = 0;
    relatedTerms.forEach(term => {
      if (text.includes(term)) relatedCount++;
    });
    
    // Calcular score de relevância
    let relevance = 0;
    
    if (tickerMention) relevance += 0.6;
    if (fundMention) relevance += 0.3;
    relevance += Math.min(relatedCount * 0.1, 0.3);
    
    // Limitar a 1
    return Math.min(relevance, 1);
  }
  
  /**
   * Extrai entidades mencionadas no texto
   * @param {String} text - Texto a ser analisado
   * @returns {Array} - Entidades extraídas
   */
  extractEntities(text) {
    // Lista de entidades comuns em FIIs
    const entityTypes = {
      segment: [
        'logística', 'shopping', 'lajes corporativas', 'residencial',
        'hospital', 'educacional', 'varejo', 'hotel', 'industrial'
      ],
      metric: [
        'dividend yield', 'p/vp', 'vacância', 'cap rate',
        'noi', 'tir', 'liquidez', 'patrimônio'
      ],
      location: [
        'são paulo', 'rio de janeiro', 'belo horizonte', 'brasília',
        'curitiba', 'salvador', 'recife', 'fortaleza'
      ]
    };
    
    const entities = [];
    
    // Buscar cada tipo de entidade
    Object.entries(entityTypes).forEach(([type, terms]) => {
      terms.forEach(term => {
        if (text.includes(term)) {
          entities.push({ type, value: term });
        }
      });
    });
    
    return entities;
  }
  
  /**
   * Extrai tópicos mencionados no texto
   * @param {String} text - Texto a ser analisado
   * @returns {Array} - Tópicos extraídos
   */
  extractTopics(text) {
    // Lista de tópicos comuns em notícias de FIIs
    const topics = [
      { name: 'dividendos', terms: ['dividendo', 'rendimento', 'distribuição', 'proventos'] },
      { name: 'preço', terms: ['cotação', 'preço', 'valor', 'valorização', 'desvalorização'] },
      { name: 'aquisição', terms: ['compra', 'aquisição', 'incorporação', 'expansão'] },
      { name: 'venda', terms: ['venda', 'desinvestimento', 'alienação'] },
      { name: 'locação', terms: ['aluguel', 'locação', 'inquilino', 'contrato'] },
      { name: 'vacância', terms: ['vacância', 'ocupação', 'desocupação'] },
      { name: 'resultados', terms: ['resultado', 'lucro', 'prejuízo', 'balanço', 'demonstração'] },
      { name: 'regulação', terms: ['cvm', 'regulação', 'legislação', 'normativa', 'tributação'] }
    ];
    
    const foundTopics = [];
    
    topics.forEach(topic => {
      // Verificar se algum termo do tópico está presente
      const found = topic.terms.some(term => text.includes(term));
      
      if (found) {
        foundTopics.push(topic.name);
      }
    });
    
    return foundTopics;
  }
  
  /**
   * Gera nuvem de palavras a partir dos artigos
   * @param {Array} articles - Artigos analisados
   * @returns {Array} - Palavras e suas frequências
   */
  generateWordcloud(articles) {
    // Combinar todos os textos
    const allText = articles.map(article => 
      [article.title, article.description, article.content]
        .filter(Boolean)
        .join(' ')
    ).join(' ').toLowerCase();
    
    // Remover stopwords e caracteres especiais
    const cleanText = this.removeStopwords(allText);
    
    // Contar frequência das palavras
    const wordFreq = {};
    const words = cleanText.split(/\s+/);
    
    words.forEach(word => {
      if (word.length < 3) return; // Ignorar palavras muito curtas
      
      if (wordFreq[word]) {
        wordFreq[word]++;
      } else {
        wordFreq[word] = 1;
      }
    });
    
    // Converter para array e ordenar
    const wordcloudData = Object.entries(wordFreq)
      .map(([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 50); // Limitar a 50 palavras
    
    return wordcloudData;
  }
  
  /**
   * Remove stopwords de um texto
   * @param {String} text - Texto a ser processado
   * @returns {String} - Texto sem stopwords
   */
  removeStopwords(text) {
    // Stopwords em português
    const stopwords = [
      'a', 'ao', 'aos', 'aquela', 'aquelas', 'aquele', 'aqueles', 'aquilo', 'as', 'até',
      'com', 'como', 'da', 'das', 'de', 'dela', 'delas', 'dele', 'deles', 'depois',
      'do', 'dos', 'e', 'ela', 'elas', 'ele', 'eles', 'em', 'entre', 'era',
      'eram', 'éramos', 'essa', 'essas', 'esse', 'esses', 'esta', 'estas', 'este', 'estes',
      'eu', 'foi', 'fomos', 'for', 'foram', 'forem', 'formos', 'fosse', 'fossem', 'fôssemos',
      'há', 'isso', 'isto', 'já', 'lhe', 'lhes', 'mais', 'mas', 'me', 'mesmo',
      'meu', 'meus', 'minha', 'minhas', 'muito', 'na', 'não', 'nas', 'nem', 'no',
      'nos', 'nós', 'nossa', 'nossas', 'nosso', 'nossos', 'num', 'numa', 'o', 'os',
      'ou', 'para', 'pela', 'pelas', 'pelo', 'pelos', 'por', 'qual', 'quando', 'que',
      'quem', 'são', 'se', 'seja', 'sejam', 'sejamos', 'sem', 'será', 'serão', 'seria',
      'seriam', 'seríamos', 'seu', 'seus', 'sua', 'suas', 'também', 'te', 'tem', 'tém',
      'temos', 'tenha', 'tenham', 'tenhamos', 'tenho', 'terá', 'terão', 'teria', 'teriam',
      'teríamos', 'teu', 'teus', 'teve', 'tinha', 'tinham', 'tínhamos', 'tua', 'tuas', 'um',
      'uma', 'você', 'vocês', 'vos'
    ];
    
    // Substituir caracteres especiais por espaços
    let cleanText = text.replace(/[^\w\sáàâãéèêíïóôõöúçñ]/gi, ' ');
    
    // Substituir múltiplos espaços por um único
    cleanText = cleanText.replace(/\s+/g, ' ');
    
    // Remover stopwords
    const words = cleanText.split(' ');
    const filteredWords = words.filter(word => !stopwords.includes(word));
    
    return filteredWords.join(' ');
  }
  
  /**
   * Tokeniza um texto para entrada no modelo
   * @param {String} text - Texto a ser tokenizado
   * @returns {Array} - Array de tokens
   */
  tokenize(text) {
    if (!this.vocabulary) {
      throw new Error('Vocabulário não carregado');
    }
    
    // Limpar texto
    const cleanText = this.removeStopwords(text.toLowerCase());
    
    // Dividir em palavras
    const words = cleanText.split(/\s+/);
    
    // Converter palavras em índices
    const tokens = [];
    const maxLength = 100; // Limitar tamanho da sequência
    
    for (let i = 0; i < Math.min(words.length, maxLength); i++) {
      const word = words[i];
      const index = this.vocabulary.wordIndex[word] || 0; // 0 para palavras desconhecidas
      tokens.push(index);
    }
    
    // Preencher com zeros se necessário
    while (tokens.length < maxLength) {
      tokens.push(0);
    }
    
    return tokens;
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
   * Obtém o nome do fundo a partir do ticker
   * @param {String} ticker - Código do FII
   * @returns {String|null} - Nome do fundo ou null se não encontrado
   */
  getFundName(ticker) {
    // Mapeamento simplificado de alguns FIIs populares
    const fundNames = {
      'KNRI11': 'kinea renda imobiliária',
      'HGLG11': 'cshg logística',
      'XPLG11': 'xp log',
      'VISC11': 'vinci shopping centers',
      'HGRE11': 'cshg real estate',
      'MXRF11': 'maxi renda',
      'BCFF11': 'btg pactual fundo de fundos',
      'HSML11': 'hsbc multimarket',
      'IRDM11': 'iridium recebíveis',
      'KNCR11': 'kinea rendimentos'
    };
    
    return fundNames[ticker] || null;
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
   * Gera notícias sintéticas para testes
   * @param {String} ticker - Código do FII
   * @param {String} startDate - Data inicial
   * @param {String} endDate - Data final
   * @returns {Array} - Notícias sintéticas
   */
  generateSyntheticNews(ticker, startDate, endDate) {
    console.log(`Gerando notícias sintéticas para ${ticker} de ${startDate} a ${endDate}`);
    
    // Converter datas para objetos Date
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calcular número de dias
    const days = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    
    // Número de notícias a gerar (1 a 3 por semana)
    const newsCount = Math.floor(days / 7 * (1 + Math.random() * 2));
    
    // Gerar notícias
    const news = [];
    
    // Possíveis títulos e conteúdos
    const templates = [
      {
        title: `${ticker} apresenta crescimento de dividendos no trimestre`,
        description: `O fundo imobiliário ${ticker} reportou aumento nos dividendos distribuídos no último trimestre.`,
        content: `O fundo imobiliário ${ticker} anunciou um aumento de dividendos no último trimestre, refletindo o bom desempenho dos ativos em seu portfólio. Segundo o relatório gerencial, a taxa de ocupação se manteve estável e os contratos de locação foram reajustados acima da inflação.`
      },
      {
        title: `${ticker} anuncia nova aquisição de imóvel comercial`,
        description: `Fundo adquire propriedade comercial para expandir portfólio.`,
        content: `O ${ticker} anunciou hoje a aquisição de um novo imóvel comercial para seu portfólio. A transação, avaliada em milhões de reais, deve contribuir para o aumento da receita imobiliária do fundo nos próximos meses. A gestão afirma que a compra está alinhada com a estratégia de diversificação geográfica.`
      },
      {
        title: `Analistas recomendam ${ticker} como oportunidade de investimento`,
        description: `Relatórios apontam potencial de valorização para o fundo imobiliário.`,
        content: `Diversos relatórios de análise publicados esta semana destacam o ${ticker} como uma oportunidade de investimento no setor de fundos imobiliários. Os analistas citam o desconto em relação ao valor patrimonial e o histórico consistente de distribuição de rendimentos como fatores positivos.`
      },
      {
        title: `${ticker} registra queda na vacância de seus imóveis`,
        description: `Taxa de ocupação do fundo atinge novo recorde.`,
        content: `O fundo imobiliário ${ticker} divulgou que a taxa de vacância de seus imóveis caiu para o menor nível dos últimos anos. O resultado é atribuído à estratégia de gestão ativa e à qualidade dos ativos em localizações privilegiadas, que continuam atraindo inquilinos mesmo em cenários econômicos desafiadores.`
      },
      {
        title: `Resultados do ${ticker} ficam abaixo das expectativas`,
        description: `Fundo reporta queda nos rendimentos distribuídos aos cotistas.`,
        content: `O ${ticker} divulgou resultados abaixo das expectativas do mercado para o último trimestre. A distribuição de rendimentos sofreu redução em comparação ao período anterior, principalmente devido ao aumento da vacância em alguns imóveis do portfólio e à renegociação de contratos com valores reduzidos.`
      },
      {
        title: `${ticker} enfrenta desafios com inadimplência de inquilinos`,
        description: `Aumento na taxa de inadimplência pressiona resultados do fundo.`,
        content: `O fundo imobiliário ${ticker} reportou um aumento na taxa de inadimplência de seus inquilinos no último trimestre. Segundo comunicado aos investidores, a gestão está tomando medidas para renegociar contratos e reduzir o impacto nos rendimentos distribuídos aos cotistas.`
      },
      {
        title: `Nova emissão de cotas do ${ticker} é anunciada`,
        description: `Fundo busca captar recursos para novas aquisições.`,
        content: `Foi anunciada hoje uma nova emissão de cotas do fundo imobiliário ${ticker}. A oferta visa captar recursos para aquisição de novos ativos, em linha com a estratégia de crescimento do portfólio. Os atuais cotistas terão direito de preferência na subscrição das novas cotas.`
      },
      {
        title: `Setor de ${ticker} mostra recuperação após período de crise`,
        description: `Segmento imobiliário apresenta sinais positivos para investidores.`,
        content: `O setor em que o ${ticker} atua está mostrando sinais claros de recuperação após um período desafiador. Indicadores como taxa de ocupação, valores de locação e volume de transações têm apresentado melhora consistente, o que pode beneficiar os resultados do fundo nos próximos trimestres.`
      }
    ];
    
    // Fontes simuladas
    const sources = [
      'InfoMoney', 'Valor Econômico', 'Exame', 'InfoFII',
      'Seu Dinheiro', 'Investing.com', 'Suno Research', 'BTG Pactual'
    ];
    
    // Gerar notícias distribuídas ao longo do período
    for (let i = 0; i < newsCount; i++) {
      // Selecionar template aleatório
      const template = templates[Math.floor(Math.random() * templates.length)];
      
      // Gerar data aleatória dentro do período
      const newsDate = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
      
      // Selecionar fonte aleatória
      const source = sources[Math.floor(Math.random() * sources.length)];
      
      news.push({
        title: template.title,
        description: template.description,
        content: template.content,
        url: `https://example.com/news/${ticker.toLowerCase()}/${newsDate.getTime()}`,
        publishedAt: newsDate.toISOString(),
        source,
        synthetic: true
      });
    }
    
    // Ordenar por data (mais recentes primeiro)
    return news.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  }
  
  /**
   * Salva o modelo treinado
   * @returns {Promise} - Promessa que resolve após o salvamento
   */
  async saveModel() {
    if (!this.model) {
      throw new Error('Modelo não inicializado');
    }
    
    try {
      await this.model.save('localstorage://lotus-invest-sentiment-analyzer');
      
      // Salvar vocabulário
      if (this.vocabulary) {
        localStorage.setItem('lotus-invest-sentiment-vocabulary', JSON.stringify(this.vocabulary));
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar modelo:', error);
      return false;
    }
  }
  
  /**
   * Treina o modelo com dados rotulados
   * @param {Array} data - Array de textos com sentimento rotulado
   * @returns {Promise} - Promessa que resolve após o treinamento
   */
  async trainModel(data) {
    // Implementação simplificada - em produção, seria necessário um pipeline completo de treinamento
    console.warn('Treinamento de modelo não implementado nesta versão');
    return false;
  }
}

// src/services/dataCollector.js
import axios from 'axios';

/**
 * Serviço para coleta e pré-processamento de dados históricos de FIIs
 */
export class DataCollector {
  constructor(config = {}) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl || 'https://api.thelotusinvest.com',
      cacheExpiration: config.cacheExpiration || 24 * 60 * 60 * 1000, // 24 horas em ms
      ...config
    };
  }

  /**
   * Obtém dados históricos de preços para um FII específico
   * @param {String} ticker - Código do FII (ex: KNRI11)
   * @param {String} startDate - Data inicial (YYYY-MM-DD)
   * @param {String} endDate - Data final (YYYY-MM-DD)
   * @returns {Promise<Array>} - Array com dados históricos
   */
  async getHistoricalPrices(ticker, startDate, endDate = new Date().toISOString().split('T')[0]) {
    try {
      // Verificar cache primeiro
      const cacheKey = `historical-prices-${ticker}-${startDate}-${endDate}`;
      const cachedData = this.getFromCache(cacheKey);
      
      if (cachedData) {
        return cachedData;
      }
      
      // Fazer requisição à API
      const response = await axios.get(`${this.config.apiBaseUrl}/fii/${ticker}/prices`, {
        params: { startDate, endDate }
      });
      
      // Pré-processar dados
      const processedData = this.preprocessPriceData(response.data);
      
      // Salvar no cache
      this.saveToCache(cacheKey, processedData);
      
      return processedData;
    } catch (error) {
      console.error(`Erro ao obter dados históricos para ${ticker}:`, error);
      throw new Error(`Falha ao obter dados históricos para ${ticker}`);
    }
  }
  
  /**
   * Obtém dados históricos de dividendos para um FII específico
   * @param {String} ticker - Código do FII (ex: KNRI11)
   * @param {String} startDate - Data inicial (YYYY-MM-DD)
   * @param {String} endDate - Data final (YYYY-MM-DD)
   * @returns {Promise<Array>} - Array com dados de dividendos
   */
  async getHistoricalDividends(ticker, startDate, endDate = new Date().toISOString().split('T')[0]) {
    try {
      // Verificar cache primeiro
      const cacheKey = `historical-dividends-${ticker}-${startDate}-${endDate}`;
      const cachedData = this.getFromCache(cacheKey);
      
      if (cachedData) {
        return cachedData;
      }
      
      // Fazer requisição à API
      const response = await axios.get(`${this.config.apiBaseUrl}/fii/${ticker}/dividends`, {
        params: { startDate, endDate }
      });
      
      // Pré-processar dados
      const processedData = this.preprocessDividendData(response.data);
      
      // Salvar no cache
      this.saveToCache(cacheKey, processedData);
      
      return processedData;
    } catch (error) {
      console.error(`Erro ao obter dados de dividendos para ${ticker}:`, error);
      throw new Error(`Falha ao obter dados de dividendos para ${ticker}`);
    }
  }
  
  /**
   * Obtém dados históricos de preços para múltiplos FIIs
   * @param {Array} tickers - Array de códigos de FIIs
   * @param {String} startDate - Data inicial (YYYY-MM-DD)
   * @param {String} endDate - Data final (YYYY-MM-DD)
   * @returns {Promise<Object>} - Objeto com dados históricos por ticker
   */
  async getBatchHistoricalPrices(tickers, startDate, endDate = new Date().toISOString().split('T')[0]) {
    const results = {};
    
    // Processar em paralelo com Promise.all
    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          results[ticker] = await this.getHistoricalPrices(ticker, startDate, endDate);
        } catch (error) {
          console.error(`Erro ao obter dados para ${ticker}:`, error);
          results[ticker] = null;
        }
      })
    );
    
    return results;
  }
  
  /**
   * Pré-processa dados de preços para remover outliers e normalizar
   * @param {Array} data - Dados brutos da API
   * @returns {Array} - Dados processados
   */
  preprocessPriceData(data) {
    // Garantir que os dados estão ordenados por data
    const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Extrair apenas os preços de fechamento
    const prices = sortedData.map(item => ({
      date: item.date,
      price: item.close,
      volume: item.volume
    }));
    
    // Remover outliers (método Z-score)
    const cleanPrices = this.removeOutliers(prices, 'price', 3);
    
    // Preencher dados faltantes (interpolação linear)
    const filledPrices = this.fillMissingValues(cleanPrices);
    
    return filledPrices;
  }
  
  /**
   * Pré-processa dados de dividendos
   * @param {Array} data - Dados brutos da API
   * @returns {Array} - Dados processados
   */
  preprocessDividendData(data) {
    // Garantir que os dados estão ordenados por data
    const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Remover outliers (método Z-score)
    const cleanData = this.removeOutliers(sortedData, 'value', 3);
    
    // Calcular yield com base no preço do dia
    const enrichedData = cleanData.map(item => ({
      ...item,
      yield: item.price > 0 ? (item.value / item.price) * 100 : 0
    }));
    
    return enrichedData;
  }
  
  /**
   * Remove outliers usando o método Z-score
   * @param {Array} data - Array de dados
   * @param {String} field - Campo a ser analisado
   * @param {Number} threshold - Limiar para considerar outlier (padrão: 3)
   * @returns {Array} - Dados sem outliers
   */
  removeOutliers(data, field, threshold = 3) {
    // Calcular média e desvio padrão
    const values = data.map(item => item[field]);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Filtrar outliers
    return data.filter(item => {
      const zScore = Math.abs((item[field] - mean) / stdDev);
      return zScore <= threshold;
    });
  }
  
  /**
   * Preenche valores faltantes usando interpolação linear
   * @param {Array} data - Array de dados com possíveis lacunas
   * @returns {Array} - Dados com valores preenchidos
   */
  fillMissingValues(data) {
    if (data.length <= 1) return data;
    
    const result = [...data];
    const dates = this.generateDateRange(data[0].date, data[data.length - 1].date);
    
    // Criar mapa de datas existentes
    const dateMap = {};
    data.forEach(item => {
      dateMap[item.date] = item;
    });
    
    // Preencher datas faltantes
    const filledData = [];
    
    for (let i = 0; i < dates.length; i++) {
      const currentDate = dates[i];
      
      if (dateMap[currentDate]) {
        // Data existe, usar valor real
        filledData.push(dateMap[currentDate]);
      } else {
        // Data faltante, interpolar
        // Encontrar data anterior mais próxima
        let prevIndex = i - 1;
        while (prevIndex >= 0 && !dateMap[dates[prevIndex]]) {
          prevIndex--;
        }
        
        // Encontrar próxima data
        let nextIndex = i + 1;
        while (nextIndex < dates.length && !dateMap[dates[nextIndex]]) {
          nextIndex++;
        }
        
        if (prevIndex >= 0 && nextIndex < dates.length) {
          // Interpolar
          const prevDate = dates[prevIndex];
          const nextDate = dates[nextIndex];
          
          const prevValue = dateMap[prevDate].price;
          const nextValue = dateMap[nextDate].price;
          
          const prevTimestamp = new Date(prevDate).getTime();
          const nextTimestamp = new Date(nextDate).getTime();
          const currentTimestamp = new Date(currentDate).getTime();
          
          const ratio = (currentTimestamp - prevTimestamp) / (nextTimestamp - prevTimestamp);
          const interpolatedPrice = prevValue + ratio * (nextValue - prevValue);
          
          // Interpolar volume também
          const prevVolume = dateMap[prevDate].volume;
          const nextVolume = dateMap[nextDate].volume;
          const interpolatedVolume = prevVolume + ratio * (nextVolume - prevVolume);
          
          filledData.push({
            date: currentDate,
            price: interpolatedPrice,
            volume: interpolatedVolume,
            interpolated: true
          });
        } else if (prevIndex >= 0) {
          // Usar valor anterior
          filledData.push({
            ...dateMap[dates[prevIndex]],
            date: currentDate,
            interpolated: true
          });
        } else if (nextIndex < dates.length) {
          // Usar próximo valor
          filledData.push({
            ...dateMap[dates[nextIndex]],
            date: currentDate,
            interpolated: true
          });
        }
      }
    }
    
    return filledData;
  }
  
  /**
   * Gera um array de datas entre duas datas (formato YYYY-MM-DD)
   * @param {String} startDate - Data inicial
   * @param {String} endDate - Data final
   * @returns {Array} - Array de datas
   */
  generateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates = [];
    
    // Ajustar para dias úteis apenas (seg-sex)
    let current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Não é domingo (0) nem sábado (6)
        dates.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }
  
  /**
   * Salva dados no cache local
   * @param {String} key - Chave do cache
   * @param {Any} data - Dados a serem armazenados
   */
  saveToCache(key, data) {
    try {
      const cacheItem = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (error) {
      console.warn('Erro ao salvar no cache:', error);
    }
  }
  
  /**
   * Obtém dados do cache local
   * @param {String} key - Chave do cache
   * @returns {Any|null} - Dados armazenados ou null se expirado/inexistente
   */
  getFromCache(key) {
    try {
      const cachedItem = localStorage.getItem(key);
      
      if (!cachedItem) return null;
      
      const { data, timestamp } = JSON.parse(cachedItem);
      const now = Date.now();
      
      // Verificar se o cache expirou
      if (now - timestamp > this.config.cacheExpiration) {
        localStorage.removeItem(key);
        return null;
      }
      
      return data;
    } catch (error) {
      console.warn('Erro ao ler do cache:', error);
      return null;
    }
  }
  
  /**
   * Limpa o cache local
   */
  clearCache() {
    try {
      // Limpar apenas itens relacionados a este serviço
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('historical-prices-') || key.startsWith('historical-dividends-')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      return true;
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      return false;
    }
  }
  
  /**
   * Gera dados sintéticos para testes
   * @param {String} ticker - Código do FII
   * @param {Number} days - Número de dias
   * @returns {Array} - Dados sintéticos
   */
  generateSyntheticData(ticker, days = 365) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const dates = this.generateDateRange(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    
    // Parâmetros para simulação
    const basePrice = 80 + Math.random() * 40; // Entre 80 e 120
    const volatility = 0.01 + Math.random() * 0.02; // Entre 1% e 3%
    const trend = -0.01 + Math.random() * 0.02; // Entre -1% e 1%
    
    // Gerar preços com random walk
    let currentPrice = basePrice;
    const priceData = dates.map(date => {
      // Aplicar tendência e volatilidade
      const change = trend + volatility * (Math.random() * 2 - 1);
      currentPrice = currentPrice * (1 + change);
      
      // Garantir que o preço não fique negativo
      if (currentPrice < 1) currentPrice = 1;
      
      // Gerar volume aleatório
      const volume = Math.floor(10000 + Math.random() * 90000);
      
      return {
        date,
        price: currentPrice,
        volume,
        synthetic: true
      };
    });
    
    // Gerar dividendos (aproximadamente mensal)
    const dividendData = [];
    let currentMonth = -1;
    
    for (const item of priceData) {
      const date = new Date(item.date);
      const month = date.getMonth();
      
      // Novo mês, gerar dividendo
      if (month !== currentMonth) {
        currentMonth = month;
        
        // 80% de chance de ter dividendo no mês
        if (Math.random() < 0.8) {
          // Yield entre 0.5% e 1.2%
          const yield_value = 0.005 + Math.random() * 0.007;
          const value = item.price * yield_value;
          
          // Data de pagamento alguns dias depois
          const paymentDate = new Date(date);
          paymentDate.setDate(paymentDate.getDate() + 10 + Math.floor(Math.random() * 5));
          
          dividendData.push({
            date: item.date,
            paymentDate: paymentDate.toISOString().split('T')[0],
            value,
            price: item.price,
            yield: yield_value * 100,
            synthetic: true
          });
        }
      }
    }
    
    return {
      ticker,
      prices: priceData,
      dividends: dividendData
    };
  }
}

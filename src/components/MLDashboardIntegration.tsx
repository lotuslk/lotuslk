// src/components/MLDashboardIntegration.tsx
import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { DataPipeline } from '../pipeline/dataPipeline';
import { PriceChart } from './PriceChart';
import { StatCard } from './StatCard';
import { FiiTable } from './FiiTable';
import { Spinner } from './ui/Spinner';
import { Alert } from './ui/Alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs';
import { Badge } from './ui/Badge';
import { Tooltip } from './ui/Tooltip';
import { useFilterStore } from '../store/filterStore';
import { useFiis } from '../hooks/useFiis';

// Ícones
import { 
  TrendingUp, TrendingDown, AlertTriangle, 
  BarChart2, MessageCircle, Calendar, 
  Info, ChevronDown, ChevronUp, Activity
} from 'lucide-react';

/**
 * Componente de integração dos modelos de ML ao dashboard
 * 
 * Este componente integra os resultados dos modelos de machine learning
 * (previsão de preços, análise de sentimento e detecção de anomalias)
 * ao dashboard existente.
 */
export const MLDashboardIntegration: React.FC = () => {
  // Estado para armazenar a instância do pipeline
  const [pipeline, setPipeline] = useState<DataPipeline | null>(null);
  
  // Estado para armazenar o ticker selecionado
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  
  // Acessar filtros globais
  const { filters } = useFilterStore();
  
  // Obter lista de FIIs
  const { data: fiis, isLoading: isLoadingFiis } = useFiis();
  
  // Inicializar pipeline
  useEffect(() => {
    const initPipeline = async () => {
      const newPipeline = new DataPipeline();
      await newPipeline.initialize();
      setPipeline(newPipeline);
    };
    
    initPipeline();
  }, []);
  
  // Atualizar ticker selecionado quando os filtros mudarem
  useEffect(() => {
    if (filters.ticker) {
      setSelectedTicker(filters.ticker);
    } else if (fiis && fiis.length > 0) {
      setSelectedTicker(fiis[0].ticker);
    }
  }, [filters.ticker, fiis]);
  
  // Consulta para obter dados de ML para o ticker selecionado
  const { 
    data: mlResults, 
    isLoading: isLoadingML,
    error: mlError,
    refetch: refetchML
  } = useQuery(
    ['ml-results', selectedTicker],
    async () => {
      if (!pipeline || !selectedTicker) return null;
      return await pipeline.processFii(selectedTicker);
    },
    {
      enabled: !!pipeline && !!selectedTicker,
      staleTime: 5 * 60 * 1000, // 5 minutos
      refetchOnWindowFocus: false
    }
  );
  
  // Renderizar componente de carregamento
  if (isLoadingFiis || !pipeline) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="lg" />
        <span className="ml-2 text-gray-600">Carregando modelos de ML...</span>
      </div>
    );
  }
  
  // Renderizar mensagem de erro
  if (mlError) {
    return (
      <Alert 
        variant="destructive" 
        title="Erro ao carregar modelos de ML" 
        description={`Ocorreu um erro ao processar os dados: ${(mlError as Error).message}`}
        action={<button onClick={() => refetchML()} className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded">Tentar novamente</button>}
      />
    );
  }
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 flex items-center">
        <Activity className="mr-2" size={24} />
        Análise Avançada com Machine Learning
      </h2>
      
      {/* Seletor de ticker */}
      {!filters.ticker && fiis && fiis.length > 0 && (
        <div className="flex items-center space-x-2 mb-4">
          <label className="font-medium text-gray-700">Selecionar FII:</label>
          <select 
            value={selectedTicker} 
            onChange={(e) => setSelectedTicker(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {fiis.map(fii => (
              <option key={fii.ticker} value={fii.ticker}>{fii.ticker} - {fii.name}</option>
            ))}
          </select>
        </div>
      )}
      
      {isLoadingML ? (
        <div className="flex items-center justify-center p-8">
          <Spinner />
          <span className="ml-2 text-gray-600">Processando dados de ML...</span>
        </div>
      ) : mlResults ? (
        <div className="space-y-6">
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card de previsão de preços */}
            <PriceForecastCard forecast={mlResults.priceForecast} />
            
            {/* Card de análise de sentimento */}
            <SentimentAnalysisCard sentiment={mlResults.sentimentAnalysis} />
            
            {/* Card de detecção de anomalias */}
            <AnomalyDetectionCard anomalies={mlResults.anomalies} />
          </div>
          
          {/* Tabs para detalhes */}
          <Tabs defaultValue="price-forecast" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="price-forecast" className="flex items-center">
                <TrendingUp className="mr-2" size={16} />
                Previsão de Preços
              </TabsTrigger>
              <TabsTrigger value="sentiment" className="flex items-center">
                <MessageCircle className="mr-2" size={16} />
                Análise de Sentimento
              </TabsTrigger>
              <TabsTrigger value="anomalies" className="flex items-center">
                <AlertTriangle className="mr-2" size={16} />
                Detecção de Anomalias
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="flex items-center">
                <Info className="mr-2" size={16} />
                Recomendações
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="price-forecast">
              <PriceForecastDetails forecast={mlResults.priceForecast} historicalData={mlResults.historicalData} />
            </TabsContent>
            
            <TabsContent value="sentiment">
              <SentimentAnalysisDetails sentiment={mlResults.sentimentAnalysis} />
            </TabsContent>
            
            <TabsContent value="anomalies">
              <AnomalyDetectionDetails anomalies={mlResults.anomalies} />
            </TabsContent>
            
            <TabsContent value="recommendations">
              <RecommendationsDetails recommendations={mlResults.recommendations} />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <Alert 
          variant="info" 
          title="Selecione um FII" 
          description="Selecione um FII para visualizar as análises de machine learning."
        />
      )}
    </div>
  );
};

/**
 * Card de resumo da previsão de preços
 */
const PriceForecastCard: React.FC<{ forecast: any }> = ({ forecast }) => {
  if (!forecast) return null;
  
  // Calcular variação percentual
  const lastPrediction = forecast.predictions[forecast.predictions.length - 1];
  const firstPrediction = forecast.predictions[0];
  const variation = ((lastPrediction.price - firstPrediction.price) / firstPrediction.price) * 100;
  
  // Determinar cor com base na tendência
  let trendColor = 'text-gray-500';
  let bgColor = 'bg-gray-100';
  let icon = <Activity size={24} />;
  
  if (forecast.trend === 'strong_up' || forecast.trend === 'up') {
    trendColor = 'text-green-600';
    bgColor = 'bg-green-50';
    icon = <TrendingUp size={24} />;
  } else if (forecast.trend === 'strong_down' || forecast.trend === 'down') {
    trendColor = 'text-red-600';
    bgColor = 'bg-red-50';
    icon = <TrendingDown size={24} />;
  }
  
  return (
    <StatCard
      title="Previsão de Preços"
      value={`R$ ${firstPrediction.price.toFixed(2)}`}
      icon={icon}
      footer={
        <div className={`flex items-center ${trendColor}`}>
          {variation >= 0 ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <span className="ml-1">{Math.abs(variation).toFixed(2)}% em {forecast.predictions.length} dias</span>
        </div>
      }
      className={bgColor}
    />
  );
};

/**
 * Card de resumo da análise de sentimento
 */
const SentimentAnalysisCard: React.FC<{ sentiment: any }> = ({ sentiment }) => {
  if (!sentiment) return null;
  
  // Determinar cor com base no sentimento
  let sentimentColor = 'text-gray-500';
  let bgColor = 'bg-gray-100';
  let icon = <MessageCircle size={24} />;
  
  if (sentiment.aggregated.label === 'very_positive' || sentiment.aggregated.label === 'positive') {
    sentimentColor = 'text-green-600';
    bgColor = 'bg-green-50';
  } else if (sentiment.aggregated.label === 'very_negative' || sentiment.aggregated.label === 'negative') {
    sentimentColor = 'text-red-600';
    bgColor = 'bg-red-50';
  }
  
  // Mapear label para texto em português
  const labelMap: Record<string, string> = {
    'very_positive': 'Muito Positivo',
    'positive': 'Positivo',
    'neutral': 'Neutro',
    'negative': 'Negativo',
    'very_negative': 'Muito Negativo'
  };
  
  return (
    <StatCard
      title="Análise de Sentimento"
      value={labelMap[sentiment.aggregated.label] || 'Neutro'}
      icon={icon}
      footer={
        <div className="flex items-center">
          <span className="text-gray-600">Baseado em {sentiment.articles.length} notícias recentes</span>
        </div>
      }
      className={bgColor}
    />
  );
};

/**
 * Card de resumo da detecção de anomalias
 */
const AnomalyDetectionCard: React.FC<{ anomalies: any }> = ({ anomalies }) => {
  if (!anomalies) return null;
  
  // Determinar cor com base no risco
  let riskColor = 'text-gray-500';
  let bgColor = 'bg-gray-100';
  
  if (anomalies.riskLevel === 'high') {
    riskColor = 'text-red-600';
    bgColor = 'bg-red-50';
  } else if (anomalies.riskLevel === 'medium') {
    riskColor = 'text-yellow-600';
    bgColor = 'bg-yellow-50';
  } else if (anomalies.riskLevel === 'low') {
    riskColor = 'text-green-600';
    bgColor = 'bg-green-50';
  }
  
  // Mapear nível de risco para texto em português
  const riskMap: Record<string, string> = {
    'high': 'Alto',
    'medium': 'Médio',
    'low': 'Baixo',
    'unknown': 'Desconhecido'
  };
  
  return (
    <StatCard
      title="Risco de Anomalias"
      value={riskMap[anomalies.riskLevel] || 'Desconhecido'}
      icon={<AlertTriangle size={24} />}
      footer={
        <div className="flex items-center">
          <span className="text-gray-600">
            {anomalies.anomalies.length} anomalias detectadas
          </span>
        </div>
      }
      className={bgColor}
    />
  );
};

/**
 * Detalhes da previsão de preços
 */
const PriceForecastDetails: React.FC<{ forecast: any, historicalData: any }> = ({ forecast, historicalData }) => {
  if (!forecast) return null;
  
  // Preparar dados para o gráfico
  const chartData = [
    ...(historicalData || []).map((item: any) => ({
      date: item.date,
      price: item.price,
      type: 'historical'
    })),
    ...forecast.predictions.map((item: any) => ({
      date: item.date,
      price: item.price,
      type: 'forecast'
    }))
  ];
  
  // Adicionar intervalos de confiança se disponíveis
  if (forecast.lowerBounds && forecast.upperBounds) {
    forecast.predictions.forEach((item: any, index: number) => {
      chartData.push({
        date: item.date,
        price: forecast.lowerBounds[index],
        type: 'lower_bound'
      });
      
      chartData.push({
        date: item.date,
        price: forecast.upperBounds[index],
        type: 'upper_bound'
      });
    });
  }
  
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Previsão de Preços para os Próximos {forecast.predictions.length} Dias</h3>
        
        {/* Gráfico de previsão */}
        <div className="h-80">
          <PriceChart 
            data={chartData} 
            showConfidenceInterval={!!forecast.lowerBounds && !!forecast.upperBounds}
          />
        </div>
        
        {/* Métricas de confiança */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="text-sm font-medium text-gray-500">Confiança da Previsão</h4>
            <div className="mt-1 flex items-center">
              <span className="text-xl font-semibold">
                {forecast.metrics.confidence === 'high' ? 'Alta' : 
                 forecast.metrics.confidence === 'medium' ? 'Média' : 'Baixa'}
              </span>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="text-sm font-medium text-gray-500">RMSE</h4>
            <div className="mt-1 flex items-center">
              <span className="text-xl font-semibold">{forecast.metrics.rmse}</span>
              <Tooltip content="Root Mean Squared Error - Medida de erro da previsão">
                <Info size={16} className="ml-2 text-gray-400" />
              </Tooltip>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="text-sm font-medium text-gray-500">MAPE</h4>
            <div className="mt-1 flex items-center">
              <span className="text-xl font-semibold">{forecast.metrics.mape}</span>
              <Tooltip content="Mean Absolute Percentage Error - Erro percentual médio">
                <Info size={16} className="ml-2 text-gray-400" />
              </Tooltip>
            </div>
          </div>
        </div>
        
        {/* Tabela de previsões */}
        <div className="mt-6">
          <h4 className="text-md font-semibold mb-2">Valores Previstos</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Previsto</th>
                  {forecast.lowerBounds && forecast.upperBounds && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Intervalo de Confiança</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {forecast.predictions.map((prediction: any, index: number) => (
                  <tr key={prediction.date} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{prediction.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      R$ {prediction.price.toFixed(2)}
                    </td>
                    {forecast.lowerBounds && forecast.upperBounds && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        R$ {forecast.lowerBounds[index].toFixed(2)} - R$ {forecast.upperBounds[index].toFixed(2)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Detalhes da análise de sentimento
 */
const SentimentAnalysisDetails: React.FC<{ sentiment: any }> = ({ sentiment }) => {
  if (!sentiment) return null;
  
  // Mapear label para texto em português
  const labelMap: Record<string, string> = {
    'very_positive': 'Muito Positivo',
    'positive': 'Positivo',
    'neutral': 'Neutro',
    'negative': 'Negativo',
    'very_negative': 'Muito Negativo'
  };
  
  // Determinar cor com base no sentimento
  const getSentimentColor = (label: string) => {
    if (label === 'very_positive' || label === 'positive') return 'bg-green-100 text-green-800';
    if (label === 'very_negative' || label === 'negative') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Análise de Sentimento de Notícias</h3>
        
        {/* Resumo do sentimento */}
        <div className="bg-gray-50 p-4 rounded-md mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Sentimento Agregado</h4>
              <div className="mt-1 flex items-center">
                <span className="text-xl font-semibold">{labelMap[sentiment.aggregated.label] || 'Neutro'}</span>
                <Badge className={`ml-2 ${getSentimentColor(sentiment.aggregated.label)}`}>
                  Score: {sentiment.aggregated.score.toFixed(2)}
                </Badge>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Confiança</h4>
              <div className="mt-1">
                <span className="text-xl font-semibold">{(sentiment.aggregated.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Nuvem de palavras */}
        {sentiment.wordcloud && sentiment.wordcloud.length > 0 && (
          <div className="mb-6">
            <h4 className="text-md font-semibold mb-2">Termos Mais Relevantes</h4>
            <div className="flex flex-wrap gap-2">
              {sentiment.wordcloud.slice(0, 20).map((word: any) => (
                <Badge 
                  key={word.text} 
                  className="bg-blue-100 text-blue-800 text-xs px-2 py-1"
                  style={{ fontSize: `${Math.max(0.8, Math.min(1.5, 0.8 + word.value / 10))}rem` }}
                >
                  {word.text}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Lista de notícias */}
        <div>
          <h4 className="text-md font-semibold mb-2">Notícias Analisadas</h4>
          {sentiment.articles.length > 0 ? (
            <div className="space-y-4">
              {sentiment.articles.map((article: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded-md p-4">
                  <div className="flex justify-between items-start">
                    <h5 className="font-medium text-gray-900">{article.title}</h5>
                    <Badge className={getSentimentColor(article.sentiment.label)}>
                      {labelMap[article.sentiment.label]}
                    </Badge>
                  </div>
                  <p className="text-gray-600 text-sm mt-2">{article.description}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center">
                      <Calendar size={14} className="mr-1" />
                      {new Date(article.publishedAt).toLocaleDateString('pt-BR')}
                    </div>
                    <div>
                      <span className="font-medium">Fonte:</span> {article.source}
                    </div>
                    {article.url && (
                      <a 
                        href={article.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Ler mais
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 italic">Nenhuma notícia encontrada para análise.</div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Detalhes da detecção de anomalias
 */
const AnomalyDetectionDetails: React.FC<{ anomalies: any }> = ({ anomalies }) => {
  if (!anomalies) return null;
  
  // Determinar cor com base na severidade
  const getSeverityColor = (severity: string) => {
    if (severity === 'high') return 'bg-red-100 text-red-800';
    if (severity === 'medium') return 'bg-yellow-100 text-yellow-800';
    if (severity === 'low') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };
  
  // Mapear tipo para texto em português
  const typeMap: Record<string, string> = {
    'high_value': 'Valor Alto',
    'low_value': 'Valor Baixo'
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Detecção de Anomalias em Dividendos</h3>
        
        {/* Resumo das anomalias */}
        <div className="bg-gray-50 p-4 rounded-md mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Nível de Risco</h4>
              <div className="mt-1 flex items-center">
                <span className="text-xl font-semibold">
                  {anomalies.riskLevel === 'high' ? 'Alto' : 
                   anomalies.riskLevel === 'medium' ? 'Médio' : 
                   anomalies.riskLevel === 'low' ? 'Baixo' : 'Desconhecido'}
                </span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Anomalias Detectadas</h4>
              <div className="mt-1">
                <span className="text-xl font-semibold">{anomalies.stats.count}</span>
                <span className="text-gray-500 ml-1">({anomalies.stats.percentage}%)</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Métodos de detecção */}
        <div className="mb-6">
          <h4 className="text-md font-semibold mb-2">Métodos de Detecção Utilizados</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(anomalies.methods).map(([method, details]: [string, any]) => (
              <div key={method} className="bg-gray-50 p-3 rounded-md">
                <h5 className="text-sm font-medium">{method}</h5>
                <div className="text-xs text-gray-500 mt-1">
                  <div>Anomalias: {details.anomalyCount}</div>
                  <div>Threshold: {details.threshold.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Lista de anomalias */}
        <div>
          <h4 className="text-md font-semibold mb-2">Anomalias Detectadas</h4>
          {anomalies.anomalies.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desvio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Métodos</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {anomalies.anomalies.map((anomaly: any, index: number) => (
                    <tr key={anomaly.date} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{anomaly.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        R$ {anomaly.value.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {typeMap[anomaly.type] || anomaly.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={getSeverityColor(anomaly.severity)}>
                          {anomaly.severity === 'high' ? 'Alta' : 
                           anomaly.severity === 'medium' ? 'Média' : 'Baixa'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex flex-wrap gap-1">
                          {anomaly.detectedBy.map((method: string) => (
                            <Badge key={method} className="bg-gray-100 text-gray-800 text-xs">
                              {method}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-gray-500 italic">Nenhuma anomalia detectada.</div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Detalhes das recomendações
 */
const RecommendationsDetails: React.FC<{ recommendations: any }> = ({ recommendations }) => {
  if (!recommendations) return null;
  
  // Determinar cor com base na recomendação
  const getRecommendationColor = (recommendation: string) => {
    if (recommendation === 'strong_buy' || recommendation === 'buy') return 'bg-green-100 text-green-800';
    if (recommendation === 'strong_sell' || recommendation === 'sell') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };
  
  // Mapear recomendação para texto em português
  const recommendationMap: Record<string, string> = {
    'strong_buy': 'Compra Forte',
    'buy': 'Compra',
    'hold': 'Manter',
    'sell': 'Venda',
    'strong_sell': 'Venda Forte'
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Recomendações Baseadas em Machine Learning</h3>
        
        {/* Resumo da recomendação */}
        <div className="bg-gray-50 p-4 rounded-md mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Recomendação</h4>
              <div className="mt-1 flex items-center">
                <span className="text-xl font-semibold">
                  {recommendationMap[recommendations.recommendation] || 'Manter'}
                </span>
                <Badge className={`ml-2 ${getRecommendationColor(recommendations.recommendation)}`}>
                  Score: {recommendations.score}
                </Badge>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Data da Análise</h4>
              <div className="mt-1">
                <span className="text-md">
                  {new Date(recommendations.timestamp).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Justificativas */}
        <div>
          <h4 className="text-md font-semibold mb-2">Justificativas</h4>
          <ul className="list-disc pl-5 space-y-2">
            {recommendations.reasons.map((reason: string, index: number) => (
              <li key={index} className="text-gray-700">{reason}</li>
            ))}
          </ul>
        </div>
        
        {/* Disclaimer */}
        <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Info className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                Esta recomendação é gerada automaticamente por algoritmos de machine learning e não constitui aconselhamento financeiro. 
                Sempre consulte um profissional qualificado antes de tomar decisões de investimento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MLDashboardIntegration;

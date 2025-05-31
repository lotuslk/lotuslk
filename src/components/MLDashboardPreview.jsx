import React from 'react';
import './MLDashboardPreview.css';

/**
 * Componente de visualização do Dashboard com integração de ML
 * Este componente é personalizado com base na carteira real do usuário
 */
const MLDashboardPreview = () => {
  // Dados da carteira do usuário
  const portfolioData = {
    funds: [
      { ticker: 'KNCR11', segment: 'CRI CDI', quantity: 191, price: 104.18, invested: 19898, dy12m: 11.7, monthlyIncome: 194.34 },
      { ticker: 'HGCR11', segment: 'CRI IPCA+', quantity: 207, price: 96.58, invested: 19992, dy12m: 12.3, monthlyIncome: 204.25 },
      { ticker: 'MXRF11', segment: 'FOF / CRI', quantity: 2085, price: 9.59, invested: 19995, dy12m: 11.8, monthlyIncome: 197.12 },
      { ticker: 'CVBI11', segment: 'CRI IPCA+', quantity: 230, price: 86.70, invested: 19941, dy12m: 12.9, monthlyIncome: 215.03 },
      { ticker: 'RZAK11', segment: 'CRI high-yield', quantity: 250, price: 79.91, invested: 19977, dy12m: 17.0, monthlyIncome: 283.18 }
    ],
    totalInvested: 99804,
    totalMonthlyIncome: 1093.9,
    averageDY: 13.1,
    characteristics: [
      'Foco: renda passiva com alto DY (média ~13,1 % a.a.)',
      'Segmentação: 80 % CRI (KNCR, HGCR, CVBI, RZAK), 20 % FOF/híbrido (MXRF)',
      'Risco controlado: apenas 1 FII high-yield (RZAK11) com peso dentro do limite',
      'Disciplina de preço: todas as compras abaixo ou no máximo até o VP'
    ],
    nextStep: 'Inserir 1 FII de tijolo descontado (ex: VISC11, HSML11) para diversificação e potencial de ganho de capital'
  };

  // Dados simulados de ML para os FIIs da carteira
  const mlData = {
    'KNCR11': {
      priceForecast: {
        predictions: [
          { date: '2025-06-01', price: 104.18 },
          { date: '2025-06-02', price: 104.25 },
          { date: '2025-06-03', price: 104.40 },
          { date: '2025-06-04', price: 104.52 },
          { date: '2025-06-05', price: 104.65 },
          { date: '2025-06-08', price: 104.78 },
          { date: '2025-06-09', price: 104.90 },
          { date: '2025-06-10', price: 105.05 },
        ],
        lowerBounds: [104.18, 103.95, 103.80, 103.70, 103.60, 103.50, 103.40, 103.30],
        upperBounds: [104.18, 104.55, 105.00, 105.34, 105.70, 106.06, 106.40, 106.80],
        trend: 'stable',
        confidence: 'high'
      },
      sentiment: {
        score: 0.35,
        label: 'neutral',
        confidence: 0.82,
        recentArticles: [
          { title: 'KNCR11 mantém distribuição de dividendos estável', sentiment: 'neutral', date: '2025-05-28' },
          { title: 'Fundos de CRI seguem como opção defensiva no cenário atual', sentiment: 'positive', date: '2025-05-20' }
        ]
      },
      anomalies: {
        detected: false,
        riskLevel: 'low'
      },
      recommendation: {
        action: 'hold',
        confidence: 'high',
        score: 0.15,
        reasons: [
          'Estabilidade de preço projetada para os próximos dias.',
          'Sentimento de mercado neutro a levemente positivo.',
          'Distribuição de dividendos consistente sem anomalias.',
          'Bom rendimento atual (11,7% a.a.) com baixo risco.'
        ]
      }
    },
    'HGCR11': {
      priceForecast: {
        predictions: [
          { date: '2025-06-01', price: 96.58 },
          { date: '2025-06-02', price: 96.80 },
          { date: '2025-06-03', price: 97.10 },
          { date: '2025-06-04', price: 97.45 },
          { date: '2025-06-05', price: 97.85 },
          { date: '2025-06-08', price: 98.20 },
          { date: '2025-06-09', price: 98.60 },
          { date: '2025-06-10', price: 99.05 },
        ],
        lowerBounds: [96.58, 96.20, 96.00, 95.90, 95.80, 95.70, 95.60, 95.50],
        upperBounds: [96.58, 97.40, 98.20, 99.00, 99.90, 100.70, 101.60, 102.60],
        trend: 'up',
        confidence: 'medium'
      },
      sentiment: {
        score: 0.58,
        label: 'positive',
        confidence: 0.75,
        recentArticles: [
          { title: 'HGCR11 se beneficia da alta da inflação com papéis indexados ao IPCA', sentiment: 'positive', date: '2025-05-26' },
          { title: 'Gestora do HGCR11 anuncia nova emissão para captação', sentiment: 'neutral', date: '2025-05-18' }
        ]
      },
      anomalies: {
        detected: false,
        riskLevel: 'low'
      },
      recommendation: {
        action: 'buy',
        confidence: 'medium',
        score: 0.62,
        reasons: [
          'Tendência de alta projetada para os próximos dias (+2,56%).',
          'Sentimento de mercado positivo.',
          'Bom rendimento atual (12,3% a.a.) com proteção inflacionária.',
          'Potencial de valorização com cenário de inflação persistente.'
        ]
      }
    },
    'MXRF11': {
      priceForecast: {
        predictions: [
          { date: '2025-06-01', price: 9.59 },
          { date: '2025-06-02', price: 9.62 },
          { date: '2025-06-03', price: 9.65 },
          { date: '2025-06-04', price: 9.68 },
          { date: '2025-06-05', price: 9.72 },
          { date: '2025-06-08', price: 9.75 },
          { date: '2025-06-09', price: 9.79 },
          { date: '2025-06-10', price: 9.83 },
        ],
        lowerBounds: [9.59, 9.55, 9.52, 9.48, 9.45, 9.42, 9.38, 9.35],
        upperBounds: [9.59, 9.69, 9.78, 9.88, 9.99, 10.08, 10.20, 10.31],
        trend: 'up',
        confidence: 'medium'
      },
      sentiment: {
        score: 0.42,
        label: 'positive',
        confidence: 0.68,
        recentArticles: [
          { title: 'MXRF11 mantém distribuição acima da média do setor', sentiment: 'positive', date: '2025-05-27' },
          { title: 'Fundos híbridos como MXRF11 ganham espaço nas carteiras dos investidores', sentiment: 'positive', date: '2025-05-15' }
        ]
      },
      anomalies: {
        detected: false,
        riskLevel: 'low'
      },
      recommendation: {
        action: 'hold',
        confidence: 'medium',
        score: 0.45,
        reasons: [
          'Leve tendência de alta projetada para os próximos dias (+2,5%).',
          'Sentimento de mercado moderadamente positivo.',
          'Bom rendimento atual (11,8% a.a.) com diversificação via FOF.',
          'Alta liquidez favorece operações de entrada e saída.'
        ]
      }
    },
    'CVBI11': {
      priceForecast: {
        predictions: [
          { date: '2025-06-01', price: 86.70 },
          { date: '2025-06-02', price: 87.10 },
          { date: '2025-06-03', price: 87.55 },
          { date: '2025-06-04', price: 88.05 },
          { date: '2025-06-05', price: 88.60 },
          { date: '2025-06-08', price: 89.20 },
          { date: '2025-06-09', price: 89.85 },
          { date: '2025-06-10', price: 90.55 },
        ],
        lowerBounds: [86.70, 86.40, 86.20, 86.00, 85.80, 85.60, 85.40, 85.20],
        upperBounds: [86.70, 87.80, 88.90, 90.10, 91.40, 92.80, 94.30, 95.90],
        trend: 'strong_up',
        confidence: 'high'
      },
      sentiment: {
        score: 0.72,
        label: 'positive',
        confidence: 0.85,
        recentArticles: [
          { title: 'CVBI11 apresenta resultados acima das expectativas no trimestre', sentiment: 'very_positive', date: '2025-05-29' },
          { title: 'Analistas recomendam CVBI11 como opção de proteção inflacionária', sentiment: 'positive', date: '2025-05-22' }
        ]
      },
      anomalies: {
        detected: true,
        recentAnomalies: [
          { date: '2025-05-15', value: 1.05, type: 'high_value', severity: 'medium' }
        ],
        riskLevel: 'low'
      },
      recommendation: {
        action: 'strong_buy',
        confidence: 'high',
        score: 0.85,
        reasons: [
          'Forte tendência de alta projetada para os próximos dias (+4,44%).',
          'Sentimento de mercado muito positivo baseado em resultados recentes.',
          'Dividendo acima da média detectado em maio de 2025.',
          'Excelente rendimento atual (12,9% a.a.) com proteção inflacionária.'
        ]
      }
    },
    'RZAK11': {
      priceForecast: {
        predictions: [
          { date: '2025-06-01', price: 79.91 },
          { date: '2025-06-02', price: 80.30 },
          { date: '2025-06-03', price: 80.75 },
          { date: '2025-06-04', price: 81.25 },
          { date: '2025-06-05', price: 80.90 },
          { date: '2025-06-08', price: 80.40 },
          { date: '2025-06-09', price: 79.80 },
          { date: '2025-06-10', price: 79.10 },
        ],
        lowerBounds: [79.91, 79.40, 78.90, 78.40, 77.90, 77.40, 76.90, 76.40],
        upperBounds: [79.91, 81.20, 82.60, 84.10, 83.90, 83.40, 82.70, 81.80],
        trend: 'volatile',
        confidence: 'medium'
      },
      sentiment: {
        score: 0.25,
        label: 'neutral',
        confidence: 0.60,
        recentArticles: [
          { title: 'RZAK11 mantém alto rendimento, mas analistas alertam para riscos', sentiment: 'neutral', date: '2025-05-25' },
          { title: 'Fundos high-yield enfrentam desafios no cenário econômico atual', sentiment: 'negative', date: '2025-05-18' }
        ]
      },
      anomalies: {
        detected: true,
        recentAnomalies: [
          { date: '2025-04-15', value: 1.35, type: 'high_value', severity: 'high' }
        ],
        riskLevel: 'medium'
      },
      recommendation: {
        action: 'hold',
        confidence: 'medium',
        score: 0.10,
        reasons: [
          'Volatilidade projetada para os próximos dias, com tendência de queda após pico inicial.',
          'Sentimento de mercado misto, com alertas sobre riscos do segmento high-yield.',
          'Anomalia significativa detectada nos dividendos recentes (valor muito alto).',
          'Rendimento excepcional (17,0% a.a.), mas com risco elevado.'
        ]
      }
    },
    'VISC11': {
      priceForecast: {
        predictions: [
          { date: '2025-06-01', price: 92.50 },
          { date: '2025-06-02', price: 93.20 },
          { date: '2025-06-03', price: 94.10 },
          { date: '2025-06-04', price: 95.05 },
          { date: '2025-06-05', price: 96.10 },
          { date: '2025-06-08', price: 97.20 },
          { date: '2025-06-09', price: 98.40 },
          { date: '2025-06-10', price: 99.70 },
        ],
        lowerBounds: [92.50, 91.80, 91.20, 90.70, 90.30, 90.00, 89.80, 89.60],
        upperBounds: [92.50, 94.60, 97.00, 99.40, 101.90, 104.40, 107.00, 109.80],
        trend: 'strong_up',
        confidence: 'high'
      },
      sentiment: {
        score: 0.78,
        label: 'positive',
        confidence: 0.88,
        recentArticles: [
          { title: 'VISC11 se beneficia da recuperação do setor de shopping centers', sentiment: 'very_positive', date: '2025-05-30' },
          { title: 'Analistas veem VISC11 como oportunidade de compra com desconto', sentiment: 'very_positive', date: '2025-05-24' }
        ]
      },
      anomalies: {
        detected: false,
        riskLevel: 'low'
      },
      recommendation: {
        action: 'strong_buy',
        confidence: 'high',
        score: 0.92,
        reasons: [
          'Forte tendência de alta projetada para os próximos dias (+7,8%).',
          'Sentimento de mercado muito positivo com recuperação do setor de shoppings.',
          'Negociação com desconto em relação ao valor patrimonial (P/VP: 0.88).',
          'Potencial de valorização com retomada do consumo presencial.'
        ]
      }
    },
    'HSML11': {
      priceForecast: {
        predictions: [
          { date: '2025-06-01', price: 85.20 },
          { date: '2025-06-02', price: 85.80 },
          { date: '2025-06-03', price: 86.50 },
          { date: '2025-06-04', price: 87.30 },
          { date: '2025-06-05', price: 88.20 },
          { date: '2025-06-08', price: 89.20 },
          { date: '2025-06-09', price: 90.30 },
          { date: '2025-06-10', price: 91.50 },
        ],
        lowerBounds: [85.20, 84.70, 84.30, 84.00, 83.80, 83.60, 83.50, 83.40],
        upperBounds: [85.20, 86.90, 88.70, 90.60, 92.60, 94.80, 97.10, 99.60],
        trend: 'strong_up',
        confidence: 'high'
      },
      sentiment: {
        score: 0.68,
        label: 'positive',
        confidence: 0.82,
        recentArticles: [
          { title: 'HSML11 anuncia expansão em shopping center estratégico', sentiment: 'positive', date: '2025-05-28' },
          { title: 'Fundos de shopping centers mostram recuperação consistente', sentiment: 'positive', date: '2025-05-20' }
        ]
      },
      anomalies: {
        detected: false,
        riskLevel: 'low'
      },
      recommendation: {
        action: 'strong_buy',
        confidence: 'high',
        score: 0.88,
        reasons: [
          'Forte tendência de alta projetada para os próximos dias (+7,4%).',
          'Sentimento de mercado positivo com expansão de ativos.',
          'Negociação com desconto em relação ao valor patrimonial (P/VP: 0.85).',
          'Bom potencial de valorização com retomada do setor de varejo.'
        ]
      }
    }
  };

  // Ticker selecionado para visualização detalhada
  const [selectedTicker, setSelectedTicker] = React.useState('CVBI11');
  
  // Dados do ticker selecionado
  const selectedFund = portfolioData.funds.find(fund => fund.ticker === selectedTicker) || portfolioData.funds[0];
  const selectedMlData = mlData[selectedTicker] || mlData['CVBI11'];

  // Função para renderizar o gráfico de previsão
  const renderPriceChart = () => {
    const data = selectedMlData.priceForecast;
    const width = 600;
    const height = 300;
    const padding = 40;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    
    // Encontrar min e max para escala
    const allPrices = [
      ...data.predictions.map(p => p.price),
      ...data.lowerBounds,
      ...data.upperBounds
    ];
    const minPrice = Math.min(...allPrices) * 0.995;
    const maxPrice = Math.max(...allPrices) * 1.005;
    
    // Calcular posições
    const points = data.predictions.map((point, index) => {
      const x = padding + (index / (data.predictions.length - 1)) * chartWidth;
      const y = height - padding - ((point.price - minPrice) / (maxPrice - minPrice)) * chartHeight;
      return { x, y, ...point };
    });
    
    const lowerPoints = data.lowerBounds.map((price, index) => {
      const x = padding + (index / (data.lowerBounds.length - 1)) * chartWidth;
      const y = height - padding - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;
      return { x, y };
    });
    
    const upperPoints = data.upperBounds.map((price, index) => {
      const x = padding + (index / (data.upperBounds.length - 1)) * chartWidth;
      const y = height - padding - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;
      return { x, y };
    });
    
    // Gerar path para linha principal
    const linePath = points.map((point, i) => 
      (i === 0 ? 'M' : 'L') + point.x + ',' + point.y
    ).join(' ');
    
    // Gerar path para área de confiança
    const areaPath = [
      ...upperPoints.map((point, i) => 
        (i === 0 ? 'M' : 'L') + point.x + ',' + point.y
      ),
      ...lowerPoints.reverse().map(point => 
        'L' + point.x + ',' + point.y
      ),
      'Z'
    ].join(' ');
    
    // Calcular variação percentual
    const firstPrice = data.predictions[0].price;
    const lastPrice = data.predictions[data.predictions.length - 1].price;
    const priceChange = lastPrice - firstPrice;
    const priceChangePercent = (priceChange / firstPrice) * 100;
    
    // Renderizar o SVG
    return (
      <div className="chart-container">
        <h3>Previsão de Preços - {selectedTicker}</h3>
        <div className="chart-header">
          <div className="current-price">
            <span className="price">R$ {selectedFund.price.toFixed(2)}</span>
            <span className={`change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
            </span>
          </div>
          <div className="forecast-info">
            <div className="trend">
              <span className="label">Tendência:</span>
              <span className={`value ${data.trend.includes('up') ? 'positive' : data.trend.includes('down') ? 'negative' : 'neutral'}`}>
                {data.trend === 'strong_up' ? 'Forte Alta' : 
                 data.trend === 'up' ? 'Alta' :
                 data.trend === 'stable' ? 'Estável' :
                 data.trend === 'down' ? 'Queda' : 
                 data.trend === 'strong_down' ? 'Forte Queda' : 'Volátil'}
              </span>
            </div>
            <div className="confidence">
              <span className="label">Confiança:</span>
              <span className="value">
                {data.confidence === 'high' ? 'Alta' : 
                 data.confidence === 'medium' ? 'Média' : 'Baixa'}
              </span>
            </div>
          </div>
        </div>
        <svg width={width} height={height}>
          {/* Área de confiança */}
          <path d={areaPath} fill="rgba(75, 192, 192, 0.2)" />
          
          {/* Linha principal */}
          <path d={linePath} fill="none" stroke="#4bc0c0" strokeWidth="2" />
          
          {/* Pontos */}
          {points.map((point, i) => (
            <circle 
              key={i} 
              cx={point.x} 
              cy={point.y} 
              r={i === 0 ? 4 : 3} 
              fill={i === 0 ? "#2a6b6b" : "#4bc0c0"} 
            />
          ))}
          
          {/* Eixo X */}
          <line 
            x1={padding} 
            y1={height - padding} 
            x2={width - padding} 
            y2={height - padding} 
            stroke="#ccc" 
          />
          
          {/* Eixo Y */}
          <line 
            x1={padding} 
            y1={padding} 
            x2={padding} 
            y2={height - padding} 
            stroke="#ccc" 
          />
          
          {/* Rótulos de data (X) */}
          {points.filter((_, i) => i % 2 === 0).map((point, i) => (
            <text 
              key={i} 
              x={point.x} 
              y={height - padding + 20} 
              textAnchor="middle" 
              fontSize="10"
            >
              {new Date(point.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </text>
          ))}
          
          {/* Rótulos de preço (Y) */}
          {[minPrice, (minPrice + maxPrice) / 2, maxPrice].map((price, i) => {
            const y = height - padding - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;
            return (
              <text 
                key={i} 
                x={padding - 5} 
                y={y} 
                textAnchor="end" 
                dominantBaseline="middle" 
                fontSize="10"
              >
                {price.toFixed(2)}
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  // Função para renderizar o sentimento
  const renderSentiment = () => {
    const { sentiment } = selectedMlData;
    
    // Determinar classe CSS baseada no sentimento
    const sentimentClass = 
      sentiment.label === 'very_positive' ? 'very-positive' :
      sentiment.label === 'positive' ? 'positive' :
      sentiment.label === 'neutral' ? 'neutral' :
      sentiment.label === 'negative' ? 'negative' : 'very-negative';
    
    // Determinar texto do sentimento
    const sentimentText = 
      sentiment.label === 'very_positive' ? 'Muito Positivo' :
      sentiment.label === 'positive' ? 'Positivo' :
      sentiment.label === 'neutral' ? 'Neutro' :
      sentiment.label === 'negative' ? 'Negativo' : 'Muito Negativo';
    
    return (
      <div className="sentiment-container">
        <h3>Análise de Sentimento</h3>
        <div className="sentiment-gauge">
          <div className="sentiment-meter">
            <div className="sentiment-value" style={{ width: `${sentiment.score * 100}%` }}></div>
          </div>
          <div className={`sentiment-label ${sentimentClass}`}>
            {sentimentText} ({(sentiment.score * 100).toFixed(0)}%)
          </div>
          <div className="sentiment-confidence">
            Confiança: {(sentiment.confidence * 100).toFixed(0)}%
          </div>
        </div>
        
        <div className="recent-news">
          <h4>Notícias Recentes</h4>
          <ul className="news-list">
            {sentiment.recentArticles.map((article, i) => {
              const articleClass = 
                article.sentiment === 'very_positive' ? 'very-positive' :
                article.sentiment === 'positive' ? 'positive' :
                article.sentiment === 'neutral' ? 'neutral' :
                article.sentiment === 'negative' ? 'negative' : 'very-negative';
              
              return (
                <li key={i} className={`news-item ${articleClass}`}>
                  <div className="news-title">{article.title}</div>
                  <div className="news-date">{article.date}</div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  };

  // Função para renderizar anomalias
  const renderAnomalies = () => {
    const { anomalies } = selectedMlData;
    
    return (
      <div className="anomalies-container">
        <h3>Detecção de Anomalias</h3>
        <div className="anomaly-status">
          <div className={`status-indicator ${anomalies.riskLevel}`}></div>
          <div className="status-text">
            Nível de Risco: {
              anomalies.riskLevel === 'low' ? 'Baixo' :
              anomalies.riskLevel === 'medium' ? 'Médio' : 'Alto'
            }
          </div>
        </div>
        
        {anomalies.detected && (
          <div className="anomalies-detected">
            <h4>Anomalias Recentes</h4>
            <table className="anomalies-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>Tipo</th>
                  <th>Severidade</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.recentAnomalies.map((anomaly, i) => (
                  <tr key={i}>
                    <td>{anomaly.date}</td>
                    <td>R$ {anomaly.value.toFixed(2)}</td>
                    <td>{anomaly.type === 'high_value' ? 'Valor Alto' : 'Valor Baixo'}</td>
                    <td className={anomaly.severity}>
                      {anomaly.severity === 'high' ? 'Alta' :
                       anomaly.severity === 'medium' ? 'Média' : 'Baixa'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {!anomalies.detected && (
          <div className="no-anomalies">
            Nenhuma anomalia detectada nos últimos 3 meses.
          </div>
        )}
      </div>
    );
  };

  // Função para renderizar recomendações
  const renderRecommendation = () => {
    const { recommendation } = selectedMlData;
    
    // Determinar classe CSS baseada na recomendação
    const recommendationClass = 
      recommendation.action === 'strong_buy' ? 'strong-buy' :
      recommendation.action === 'buy' ? 'buy' :
      recommendation.action === 'hold' ? 'hold' :
      recommendation.action === 'sell' ? 'sell' : 'strong-sell';
    
    // Determinar texto da recomendação
    const recommendationText = 
      recommendation.action === 'strong_buy' ? 'Compra Forte' :
      recommendation.action === 'buy' ? 'Compra' :
      recommendation.action === 'hold' ? 'Manter' :
      recommendation.action === 'sell' ? 'Venda' : 'Venda Forte';
    
    return (
      <div className="recommendation-container">
        <h3>Recomendação Personalizada</h3>
        <div className={`recommendation-header ${recommendationClass}`}>
          <div className="recommendation-action">{recommendationText}</div>
          <div className="recommendation-score">
            Score: {(recommendation.score * 100).toFixed(0)}%
          </div>
          <div className="recommendation-confidence">
            Confiança: {
              recommendation.confidence === 'high' ? 'Alta' :
              recommendation.confidence === 'medium' ? 'Média' : 'Baixa'
            }
          </div>
        </div>
        
        <div className="recommendation-components">
          <div className="component">
            <div className="component-label">Preço</div>
            <div className="component-bar">
              <div 
                className="component-value" 
                style={{ 
                  width: `${Math.abs(recommendation.components?.priceScore || 0.5) * 100}%`,
                  backgroundColor: (recommendation.components?.priceScore || 0) >= 0 ? '#4caf50' : '#f44336'
                }}
              ></div>
            </div>
            <div className="component-score">
              {(recommendation.components?.priceScore || 0) >= 0 ? '+' : ''}
              {((recommendation.components?.priceScore || 0) * 100).toFixed(0)}%
            </div>
          </div>
          
          <div className="component">
            <div className="component-label">Sentimento</div>
            <div className="component-bar">
              <div 
                className="component-value" 
                style={{ 
                  width: `${Math.abs(recommendation.components?.sentimentScore || 0.4) * 100}%`,
                  backgroundColor: (recommendation.components?.sentimentScore || 0) >= 0 ? '#4caf50' : '#f44336'
                }}
              ></div>
            </div>
            <div className="component-score">
              {(recommendation.components?.sentimentScore || 0) >= 0 ? '+' : ''}
              {((recommendation.components?.sentimentScore || 0) * 100).toFixed(0)}%
            </div>
          </div>
          
          <div className="component">
            <div className="component-label">Dividendos</div>
            <div className="component-bar">
              <div 
                className="component-value" 
                style={{ 
                  width: `${Math.abs(recommendation.components?.anomalyScore || 0.3) * 100}%`,
                  backgroundColor: (recommendation.components?.anomalyScore || 0) >= 0 ? '#4caf50' : '#f44336'
                }}
              ></div>
            </div>
            <div className="component-score">
              {(recommendation.components?.anomalyScore || 0) >= 0 ? '+' : ''}
              {((recommendation.components?.anomalyScore || 0) * 100).toFixed(0)}%
            </div>
          </div>
          
          <div className="component">
            <div className="component-label">Fundamentos</div>
            <div className="component-bar">
              <div 
                className="component-value" 
                style={{ 
                  width: `${Math.abs(recommendation.components?.fundamentalScore || 0.6) * 100}%`,
                  backgroundColor: (recommendation.components?.fundamentalScore || 0) >= 0 ? '#4caf50' : '#f44336'
                }}
              ></div>
            </div>
            <div className="component-score">
              {(recommendation.components?.fundamentalScore || 0) >= 0 ? '+' : ''}
              {((recommendation.components?.fundamentalScore || 0) * 100).toFixed(0)}%
            </div>
          </div>
        </div>
        
        <div className="recommendation-reasons">
          <h4>Justificativas</h4>
          <ul>
            {recommendation.reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  // Função para renderizar o resumo da carteira
  const renderPortfolioSummary = () => {
    return (
      <div className="portfolio-summary">
        <h3>Resumo da Carteira</h3>
        <div className="portfolio-stats">
          <div className="stat-item">
            <div className="stat-label">Total Investido</div>
            <div className="stat-value">R$ {portfolioData.totalInvested.toLocaleString('pt-BR')}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Renda Mensal</div>
            <div className="stat-value">R$ {portfolioData.totalMonthlyIncome.toLocaleString('pt-BR')}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">DY Médio</div>
            <div className="stat-value">{portfolioData.averageDY.toFixed(1)}%</div>
          </div>
        </div>
        
        <div className="portfolio-characteristics">
          <h4>Características</h4>
          <ul>
            {portfolioData.characteristics.map((characteristic, i) => (
              <li key={i}>{characteristic}</li>
            ))}
          </ul>
        </div>
        
        <div className="next-step">
          <h4>Próximo Passo Recomendado</h4>
          <p>{portfolioData.nextStep}</p>
        </div>
      </div>
    );
  };

  // Função para renderizar a tabela de FIIs
  const renderFiiTable = () => {
    return (
      <div className="fii-table-container">
        <h3>Fundos na Carteira</h3>
        <table className="fii-table">
          <thead>
            <tr>
              <th>FII</th>
              <th>Segmento</th>
              <th>Preço</th>
              <th>DY 12m</th>
              <th>Recomendação</th>
            </tr>
          </thead>
          <tbody>
            {portfolioData.funds.map((fund, i) => {
              const fundMlData = mlData[fund.ticker] || {};
              const recommendation = fundMlData.recommendation || {};
              
              const recommendationClass = 
                recommendation.action === 'strong_buy' ? 'strong-buy' :
                recommendation.action === 'buy' ? 'buy' :
                recommendation.action === 'hold' ? 'hold' :
                recommendation.action === 'sell' ? 'sell' : 'strong-sell';
              
              const recommendationText = 
                recommendation.action === 'strong_buy' ? 'Compra Forte' :
                recommendation.action === 'buy' ? 'Compra' :
                recommendation.action === 'hold' ? 'Manter' :
                recommendation.action === 'sell' ? 'Venda' : 'Venda Forte';
              
              return (
                <tr 
                  key={i} 
                  className={selectedTicker === fund.ticker ? 'selected' : ''}
                  onClick={() => setSelectedTicker(fund.ticker)}
                >
                  <td>{fund.ticker}</td>
                  <td>{fund.segment}</td>
                  <td>R$ {fund.price.toFixed(2)}</td>
                  <td>{fund.dy12m.toFixed(1)}%</td>
                  <td className={recommendationClass}>{recommendationText}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Função para renderizar recomendações de novos FIIs
  const renderNewRecommendations = () => {
    // Filtrar apenas FIIs recomendados que não estão na carteira
    const portfolioTickers = portfolioData.funds.map(fund => fund.ticker);
    const recommendedFiis = Object.entries(mlData)
      .filter(([ticker, data]) => 
        !portfolioTickers.includes(ticker) && 
        (data.recommendation?.action === 'strong_buy' || data.recommendation?.action === 'buy')
      )
      .map(([ticker, data]) => ({ ticker, data }));
    
    if (recommendedFiis.length === 0) return null;
    
    return (
      <div className="new-recommendations">
        <h3>Recomendações para Diversificação</h3>
        <div className="recommendation-cards">
          {recommendedFiis.map((item, i) => {
            const { ticker, data } = item;
            const recommendation = data.recommendation;
            
            const recommendationClass = 
              recommendation.action === 'strong_buy' ? 'strong-buy' : 'buy';
            
            return (
              <div key={i} className={`recommendation-card ${recommendationClass}`} onClick={() => setSelectedTicker(ticker)}>
                <div className="card-header">
                  <div className="card-ticker">{ticker}</div>
                  <div className="card-action">{recommendation.action === 'strong_buy' ? 'Compra Forte' : 'Compra'}</div>
                </div>
                <div className="card-body">
                  <div className="card-score">Score: {(recommendation.score * 100).toFixed(0)}%</div>
                  <div className="card-reason">{recommendation.reasons[0]}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="ml-dashboard-preview">
      <div className="dashboard-header">
        <h2>Dashboard Lotus Invest - Análise de Carteira</h2>
        <div className="ticker-info">
          <div className="ticker-name">Carteira Personalizada</div>
          <div className="ticker-segment">5 FIIs | Foco em Renda Passiva</div>
        </div>
      </div>
      
      <div className="portfolio-overview">
        {renderPortfolioSummary()}
        {renderFiiTable()}
        {renderNewRecommendations()}
      </div>
      
      <div className="fii-details-header">
        <h2>Análise Detalhada - {selectedTicker}</h2>
        <div className="fii-basic-info">
          <div className="fii-segment">{selectedFund?.segment || 'Shopping'}</div>
          <div className="fii-dy">DY 12m: {selectedFund?.dy12m.toFixed(1) || '8.5'}%</div>
        </div>
      </div>
      
      <div className="dashboard-grid">
        <div className="grid-item price-forecast">
          {renderPriceChart()}
        </div>
        
        <div className="grid-item sentiment-analysis">
          {renderSentiment()}
        </div>
        
        <div className="grid-item anomaly-detection">
          {renderAnomalies()}
        </div>
        
        <div className="grid-item recommendation">
          {renderRecommendation()}
        </div>
      </div>
      
      <div className="dashboard-footer">
        <div className="disclaimer">
          As previsões e recomendações são baseadas em modelos de machine learning e não constituem aconselhamento financeiro.
          Sempre consulte um profissional antes de tomar decisões de investimento.
        </div>
        <div className="last-updated">
          Última atualização: {new Date().toLocaleString('pt-BR')}
        </div>
      </div>
    </div>
  );
};

export default MLDashboardPreview;

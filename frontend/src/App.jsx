import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { io } from 'socket.io-client';

Chart.register(...registerables);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';
const HISTORY_LIMIT = 18;

const farmMeta = {
  sensor_bogota: {
    id: 'sensor_bogota',
    name: 'Bogotá',
    accent: '#e08f3d',
    dot: 'linear-gradient(135deg, #f2a24b, #c96c1f)',
    lat: 4.6097,
    lon: -74.0817,
  },
  sensor_medellin: {
    id: 'sensor_medellin',
    name: 'Medellín',
    accent: '#4a9788',
    dot: 'linear-gradient(135deg, #6bb9a8, #2d7366)',
    lat: 6.2518,
    lon: -75.5636,
  },
  sensor_cali: {
    id: 'sensor_cali',
    name: 'Cali',
    accent: '#6a8d6b',
    dot: 'linear-gradient(135deg, #8ab08d, #547257)',
    lat: 3.4372,
    lon: -76.5225,
  },
};

const initialSensors = Object.values(farmMeta).map((farm, index) => ({
  ...farm,
  temperature: 24 + index * 1.7,
  humidity: 70 - index * 2.1,
  pressure: 1012 + index * 2.2,
  windspeed: 11 + index * 0.8,
  timestamp: null,
}));

const formatDateTime = (value) => {
  if (!value) return 'Sin actualización';
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
};

const formatChartTime = (value) =>
  new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function summarizeSensors(list) {
  return list.reduce(
    (accumulator, sensor) => {
      accumulator.temperature += sensor.temperature;
      accumulator.humidity += sensor.humidity;
      accumulator.pressure += sensor.pressure;
      accumulator.windspeed += sensor.windspeed;
      return accumulator;
    },
    { temperature: 0, humidity: 0, pressure: 0, windspeed: 0 },
  );
}

function formatSummary(summary, totalSensors) {
  return {
    temperature: Number((summary.temperature / totalSensors).toFixed(1)),
    humidity: Number((summary.humidity / totalSensors).toFixed(1)),
    pressure: Math.round(summary.pressure / totalSensors),
    windspeed: Number((summary.windspeed / totalSensors).toFixed(1)),
  };
}

function createInitialHistory(value, spread) {
  const baseTime = Date.now();

  return Array.from({ length: HISTORY_LIMIT }, (_, index) => {
    const offset = Math.sin(index * 0.7) * spread * 0.35 + Math.cos(index * 0.43) * spread * 0.2;
    return {
      x: baseTime - (HISTORY_LIMIT - index) * 10000,
      y: Number((value + offset).toFixed(1)),
    };
  });
}

function pushHistoryPoint(series, value, time = Date.now()) {
  return [...series.slice(1), { x: time, y: Number(value.toFixed(1)) }];
}

function buildHistorySeries(sensor) {
  return {
    temperature: createInitialHistory(sensor.temperature, 2.2),
    humidity: createInitialHistory(sensor.humidity, 4.3),
    pressure: createInitialHistory(sensor.pressure, 6.2),
    windspeed: createInitialHistory(sensor.windspeed, 1.4),
  };
}

function averageHistorySeries(seriesList) {
  if (seriesList.length === 0) {
    return [];
  }

  return seriesList[0].map((_, index) => {
    const total = seriesList.reduce((sum, series) => sum + (series[index]?.y ?? 0), 0);
    return {
      x: seriesList[0][index]?.x ?? Date.now(),
      y: Number((total / seriesList.length).toFixed(1)),
    };
  });
}

function toRgba(color, alpha) {
  const hex = color.replace('#', '');
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function heatmapColor(value, minimum, maximum) {
  const range = Math.max(1, maximum - minimum);
  const ratio = clamp((value - minimum) / range, 0, 1);
  const hue = 135 - ratio * 95;
  return `hsla(${hue}, 54%, 52%, 0.92)`;
}

function climateHeatScore(sensor) {
  const temperatureScore = clamp((sensor.temperature - 10) / 25, 0, 1);
  const humidityScore = clamp(sensor.humidity / 100, 0, 1);
  const windScore = clamp(sensor.windspeed / 20, 0, 1);
  const pressureScore = clamp((sensor.pressure - 850) / 180, 0, 1);

  return Number(((temperatureScore * 0.45) + (humidityScore * 0.2) + (windScore * 0.15) + (pressureScore * 0.2)) / 1);
}

function climateHeatColor(score) {
  const normalized = clamp(score, 0, 1);
  const lightness = 20 + normalized * 42;
  const saturation = 58 + normalized * 30;
  const hue = 145 - normalized * 110;
  return `hsla(${hue}, ${saturation}%, ${lightness}%, 0.95)`;
}

function TimeSeriesChart({ title, unit, points, color, suffix }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return undefined;
    }

    const context = canvasRef.current.getContext('2d');
    if (!context) {
      return undefined;
    }

    const chart = new Chart(context, {
      type: 'line',
      data: {
        labels: points.map((point) => formatChartTime(point.x)),
        datasets: [
          {
            label: title,
            data: points.map((point) => point.y),
            borderColor: color,
            backgroundColor: toRgba(color, 0.16),
            pointBackgroundColor: color,
            pointBorderColor: '#fff7eb',
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 3,
            tension: 0.35,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return `${title}: ${context.parsed.y}${suffix}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(105, 74, 35, 0.08)' },
            ticks: { color: '#80654b', maxTicksLimit: 6 },
          },
          y: {
            grid: { color: 'rgba(105, 74, 35, 0.08)' },
            ticks: { color: '#80654b' },
          },
        },
      },
    });

    chartRef.current = chart;

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    chart.data.labels = points.map((point) => formatChartTime(point.x));
    chart.data.datasets[0].data = points.map((point) => point.y);
    chart.data.datasets[0].borderColor = color;
    chart.data.datasets[0].backgroundColor = toRgba(color, 0.16);
    chart.data.datasets[0].pointBackgroundColor = color;
    chart.update('none');
  }, [color, points, title, suffix]);

  return (
    <section className="mini-chart card">
      <div className="section-label">{title}</div>
      <div className="chart-frame">
        <canvas ref={canvasRef} className="chart-canvas" />
      </div>
      <div className="chart-unit">{unit}</div>
    </section>
  );
}

export default function App() {
  const [sensors, setSensors] = useState(initialSensors);
  const [selectedFarm, setSelectedFarm] = useState('Todas');
  const [connected, setConnected] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [historyBySensor, setHistoryBySensor] = useState(() =>
    Object.fromEntries(initialSensors.map((sensor) => [sensor.id, buildHistorySeries(sensor)])),
  );

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('new_weather_data', (payload) => {
      if (!payload?.sensorId) return;

      const nextTemperature = Number(payload.temperature);
      const nextHumidity = Number(payload.humidity);
      const nextPressure = Number(payload.pressure);
      const nextWindspeed = Number(payload.windspeed);

      if (
        !Number.isFinite(nextTemperature) ||
        !Number.isFinite(nextHumidity) ||
        !Number.isFinite(nextPressure) ||
        !Number.isFinite(nextWindspeed)
      ) {
        return;
      }

      setSensors((current) =>
        current.map((sensor) =>
          sensor.id === payload.sensorId
            ? {
                ...sensor,
                temperature: nextTemperature,
                humidity: nextHumidity,
                pressure: nextPressure,
                windspeed: nextWindspeed,
                timestamp: payload.timestamp,
              }
            : sensor,
        ),
      );

      setHistoryBySensor((previous) => {
        const sensorHistory = previous[payload.sensorId];
        if (!sensorHistory) {
          return previous;
        }

        return {
          ...previous,
          [payload.sensorId]: {
            temperature: pushHistoryPoint(sensorHistory.temperature, nextTemperature),
            humidity: pushHistoryPoint(sensorHistory.humidity, nextHumidity),
            pressure: pushHistoryPoint(sensorHistory.pressure, nextPressure),
            windspeed: pushHistoryPoint(sensorHistory.windspeed, nextWindspeed),
          },
        };
      });
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const farms = ['Todas', ...new Set(sensors.map((sensor) => sensor.name))];
  const visibleSensors = selectedFarm === 'Todas' ? sensors : sensors.filter((sensor) => sensor.name === selectedFarm);
  const activeSensor = selectedFarm === 'Todas' ? null : visibleSensors[0] ?? null;

  const summary = useMemo(() => formatSummary(summarizeSensors(visibleSensors), visibleSensors.length), [visibleSensors]);

  const displayedHistory = useMemo(() => {
    if (selectedFarm === 'Todas') {
      return {
        temperature: averageHistorySeries(sensors.map((sensor) => historyBySensor[sensor.id].temperature)),
        humidity: averageHistorySeries(sensors.map((sensor) => historyBySensor[sensor.id].humidity)),
        pressure: averageHistorySeries(sensors.map((sensor) => historyBySensor[sensor.id].pressure)),
        windspeed: averageHistorySeries(sensors.map((sensor) => historyBySensor[sensor.id].windspeed)),
      };
    }

    if (!activeSensor) {
      return {
        temperature: createInitialHistory(0, 2.2),
        humidity: createInitialHistory(0, 4.3),
        pressure: createInitialHistory(0, 6.2),
        windspeed: createInitialHistory(0, 1.4),
      };
    }

    return historyBySensor[activeSensor.id] ?? buildHistorySeries(activeSensor);
  }, [activeSensor, historyBySensor, selectedFarm, sensors]);

  const heatPoints = visibleSensors.map((sensor, index) => ({
    ...sensor,
    x: [24, 46, 76][index],
    y: [72, 46, 23][index],
    size: clamp((sensor.temperature - 15) * 1.7, 16, 42),
    heatScore: climateHeatScore(sensor),
  }));

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <main className="dashboard">
        <header className="topbar card">
          <div>
            <div className="brand">CLIMATENET</div>
            <div className="subtitle">Red multi-ciudad · Bojacá</div>
          </div>
          <div className="live-status">
            <span className={connected ? 'status-dot live' : 'status-dot'} />
            <span>{connected ? 'En vivo' : 'Sin conexión'}</span>
            <span>· {visibleSensors.length} sensores</span>
            <span className="clock">{new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(clock))}</span>
          </div>
        </header>

        <section className="farm-switcher">
          <span className="switcher-label">Ciudad:</span>
          {farms.map((farm) => (
            <button
              key={farm}
              type="button"
              className={`farm-pill ${selectedFarm === farm ? 'active' : ''}`}
              onClick={() => setSelectedFarm(farm)}
            >
              {farm !== 'Todas' && <span className="pill-dot" />}
              {farm}
            </button>
          ))}
        </section>

        <section className="summary-grid">
          <article className="stat-card card warm">
            <div className="stat-label">Temperatura</div>
            <div className="stat-value">{summary.temperature.toFixed(1)}°C</div>
          </article>
          <article className="stat-card card mint">
            <div className="stat-label">Humedad</div>
            <div className="stat-value">{summary.humidity.toFixed(1)}%</div>
          </article>
          <article className="stat-card card sage">
            <div className="stat-label">Presión</div>
            <div className="stat-value">{summary.pressure} hPa</div>
          </article>
          <article className="stat-card card plum">
            <div className="stat-label">Viento</div>
            <div className="stat-value">{summary.windspeed.toFixed(1)} km/h</div>
          </article>
        </section>

        <section className="content-grid">
          <article className="heatmap card">
            <div className="section-header">
              <div>
                <div className="section-title">Mapa de calor — ubicación de sensores</div>
                <div className="section-subtitle">Distribución de mediciones en tiempo real</div>
              </div>
              <div className="legend">
                <span className="legend-step warm" />
                <span className="legend-step mint" />
                <span className="legend-step sage" />
                <span className="legend-step plum" />
                <span className="legend-scale">Baja actividad → alta actividad</span>
              </div>
            </div>

            <div className="heatmap-grid">
              {Array.from({ length: 6 }).map((_, row) =>
                Array.from({ length: 8 }).map((__, col) => (
                  <span key={`${row}-${col}`} className="grid-cell" />
                )),
              )}
              {heatPoints.map((point) => {
                const heatColor = climateHeatColor(point.heatScore);
                const glow = point.heatScore > 0.7 ? 0.42 : point.heatScore > 0.4 ? 0.28 : 0.18;

                return (
                  <div
                    key={point.id}
                    className="heat-point"
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                      width: `${point.size}px`,
                      height: `${point.size}px`,
                      background: heatColor,
                      boxShadow: `0 0 18px rgba(155, 91, 34, ${glow})`,
                    }}
                  >
                    <span className="heat-point-label">{point.name}</span>
                    <span className="heat-point-value">{point.temperature.toFixed(1)}°C</span>
                  </div>
                );
              })}
            </div>
          </article>

          <aside className="sensor-panel card">
            <div className="section-title">Sensores</div>
            <div className="sensor-list">
              {visibleSensors.map((sensor) => (
                <div key={sensor.id} className="sensor-group">
                  <div className="sensor-group-header">
                    <span className="sensor-badge" style={{ background: sensor.accent }} />
                    <div>
                      <div className="sensor-group-title">{sensor.name}</div>
                      <div className="sensor-group-meta">{sensor.lat.toFixed(4)}, {sensor.lon.toFixed(4)}</div>
                    </div>
                    <strong>{sensor.temperature.toFixed(1)}°C</strong>
                  </div>
                  <div className="sensor-row">
                    <span>{sensor.id.toUpperCase()}</span>
                    <span>{sensor.humidity.toFixed(1)}%</span>
                  </div>
                  <div className="sensor-row">
                    <span>Presión</span>
                    <span>{sensor.pressure.toFixed(0)} hPa</span>
                  </div>
                  <div className="sensor-row">
                    <span>Viento</span>
                    <span>{sensor.windspeed.toFixed(1)} km/h</span>
                  </div>
                  <div className="sensor-row muted">Última lectura: {formatDateTime(sensor.timestamp)}</div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="charts-title">Temperatura, humedad y presión vs tiempo</section>
        <section className="charts-grid">
          <TimeSeriesChart title="Temperatura vs tiempo" unit={selectedFarm === 'Todas' ? 'Promedio general' : `Ciudad: ${activeSensor?.name ?? 'Sin datos'}`} points={displayedHistory.temperature} color="#d8842d" suffix=" °C" />
          <TimeSeriesChart title="Humedad vs tiempo" unit={selectedFarm === 'Todas' ? 'Promedio general' : `Ciudad: ${activeSensor?.name ?? 'Sin datos'}`} points={displayedHistory.humidity} color="#4f988a" suffix=" %" />
          <TimeSeriesChart title="Presión vs tiempo" unit={selectedFarm === 'Todas' ? 'Promedio general' : `Ciudad: ${activeSensor?.name ?? 'Sin datos'}`} points={displayedHistory.pressure} color="#6a8467" suffix=" hPa" />
          <TimeSeriesChart title="Viento vs tiempo" unit={selectedFarm === 'Todas' ? 'Promedio general' : `Ciudad: ${activeSensor?.name ?? 'Sin datos'}`} points={displayedHistory.windspeed} color="#8d5d7b" suffix=" km/h" />
        </section>
      </main>
    </div>
  );
}

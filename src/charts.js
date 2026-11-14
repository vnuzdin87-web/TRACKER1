import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { PARAMS } from './constants.js';
import {
  formatNumber,
  formatPercent,
  formatResponses,
  prefersReducedMotion,
} from './utils.js';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

const charts = [];

const tooltipOptions = {
  backgroundColor: '#111827',
  titleColor: '#FFFFFF',
  bodyColor: '#FFFFFF',
  padding: 10,
  cornerRadius: 8,
  displayColors: false,
};

function pushChart(chart) {
  charts.push(chart);
  return chart;
}

export function createAveragesChart(canvas, averages) {
  if (!canvas) return null;

  const reducedMotion = prefersReducedMotion();

  return pushChart(
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: PARAMS.map(({ label }) => label),
        datasets: [
          {
            data: PARAMS.map(({ key }) => averages[key] ?? 0),
            backgroundColor: '#2563EB',
            hoverBackgroundColor: '#1D4ED8',
            borderRadius: 6,
            borderSkipped: false,
            barThickness: 22,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: reducedMotion ? false : { duration: 450 },
        layout: {
          padding: { top: 4, right: 12, bottom: 4, left: 0 },
        },
        scales: {
          x: {
            min: 0,
            max: 10,
            ticks: {
              stepSize: 1,
              color: '#6B7280',
              font: { size: 11 },
            },
            grid: { color: '#E5E7EB' },
            border: { color: '#E5E7EB' },
          },
          y: {
            ticks: {
              color: '#1F2937',
              font: { size: 12, weight: '600' },
            },
            grid: { display: false },
            border: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipOptions,
            callbacks: {
              label(context) {
                return `${formatNumber(context.parsed.x)} из 10`;
              },
            },
          },
        },
      },
    }),
  );
}

export function createAgeChart(canvas, ageDistribution) {
  if (!canvas) return null;

  const reducedMotion = prefersReducedMotion();

  return pushChart(
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ageDistribution.map(({ label }) => label),
        datasets: [
          {
            data: ageDistribution.map(({ count }) => count),
            backgroundColor: ['#2563EB', '#10B981', '#F59E0B'],
            hoverBackgroundColor: ['#1D4ED8', '#059669', '#D97706'],
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 64,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reducedMotion ? false : { duration: 450 },
        layout: {
          padding: { top: 4, right: 8, bottom: 4, left: 0 },
        },
        scales: {
          x: {
            ticks: {
              color: '#1F2937',
              font: { size: 12, weight: '600' },
            },
            grid: { display: false },
            border: { color: '#E5E7EB' },
          },
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
              stepSize: 1,
              color: '#6B7280',
              font: { size: 11 },
            },
            grid: { color: '#E5E7EB' },
            border: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipOptions,
            callbacks: {
              label(context) {
                const item = ageDistribution[context.dataIndex];
                return `${formatResponses(item.count)} (${formatPercent(item.share)} от всех)`;
              },
            },
          },
        },
      },
    }),
  );
}

export function destroyCharts() {
  for (const chart of charts) {
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
  }

  charts.length = 0;
}

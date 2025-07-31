import React, { useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Trail } from '../types';
import { getLevelColor } from '../utils/colors';
import styles from './ElevationChart.module.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ElevationChartProps {
  trail: Trail;
  width?: number;
  height?: number;
}


export default function ElevationChart({ trail, width = 300, height = 150 }: ElevationChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);

  // Prepare chart data
  const chartData = React.useMemo(() => {
    if (!trail.elevation_profile || trail.elevation_profile.length === 0) {
      return null;
    }

    const distances = trail.elevation_profile.map(point => (point.distance / 1000).toFixed(1)); // Convert to km
    const elevations = trail.elevation_profile.map(point => point.elevation);
    const color = getLevelColor(trail.level);

    return {
      labels: distances,
      datasets: [
        {
          label: 'Elevation (m)',
          data: elevations,
          borderColor: color,
          backgroundColor: color + '20', // Add transparency
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    };
  }, [trail.elevation_profile, trail.level]);

  const chartOptions = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: (context: TooltipItem<'line'>[]) => {
            return `Distance: ${context[0].label}km`;
          },
          label: (context: TooltipItem<'line'>) => {
            return `Elevation: ${Math.round(context.parsed.y)}m`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Distance (km)',
        },
        grid: {
          display: false,
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Elevation (m)',
        },
        grid: {
          color: 'rgba(0,0,0,0.1)',
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  }), []);

  if (!chartData) {
    return (
      <div 
        className={styles.noDataContainer}
        style={{ width, height }}
      >
        No elevation data available
      </div>
    );
  }

  return (
    <div style={{ width, height }}>
      <Line ref={chartRef} data={chartData} options={chartOptions} />
    </div>
  );
}
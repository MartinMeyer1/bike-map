import React, { useEffect, useRef } from 'react';
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
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Trail } from '../types';

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

// Get color by difficulty level
function getLevelColor(level: string): string {
  switch (level) {
    case 'S0': return '#28a745'; // Green
    case 'S1': return '#007bff'; // Blue
    case 'S2': return '#ffc107'; // Yellow
    case 'S3':
    case 'S4':
    case 'S5': return '#dc3545'; // Red
    default: return '#6c757d'; // Gray
  }
}

export default function ElevationChart({ trail, width = 300, height = 150 }: ElevationChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);

  // Prepare chart data
  const chartData = React.useMemo(() => {
    if (!trail.elevation_profile || trail.elevation_profile.length === 0) {
      return null;
    }

    const distances = trail.elevation_profile.map(point => (point.dist / 1000).toFixed(1)); // Convert to km
    const elevations = trail.elevation_profile.map(point => point.alts.DTM25);
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
          title: (context: any) => {
            return `Distance: ${context[0].label}km`;
          },
          label: (context: any) => {
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
        style={{ 
          width, 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#f8f9fa',
          borderRadius: '4px',
          color: '#666',
          fontSize: '14px'
        }}
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
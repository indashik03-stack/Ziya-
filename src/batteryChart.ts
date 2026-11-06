import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export interface BatteryPoint {
  time: string;
  hour: number;
  level: number;
  status: string;
  isCharging?: boolean;
}

export const BATTERY_24H_DATA: BatteryPoint[] = [
  { time: '06:00', hour: 6, level: 100, status: 'Full Charge', isCharging: true },
  { time: '08:00', hour: 8, level: 96, status: 'Commute & Music' },
  { time: '10:00', hour: 10, level: 90, status: 'Active Screen & 5G' },
  { time: '12:00', hour: 12, level: 84, status: 'Calls & Messaging' },
  { time: '14:00', hour: 14, level: 76, status: 'Camera & Video Call' },
  { time: '16:00', hour: 16, level: 68, status: 'Gaming & High Brightness' },
  { time: '18:00', hour: 18, level: 58, status: 'Evening Commute' },
  { time: '20:00', hour: 20, level: 48, status: 'Low Battery Alert' },
  { time: '20:30', hour: 20.5, level: 45, status: 'Plugged in 120W', isCharging: true },
  { time: '21:00', hour: 21, level: 95, status: 'HyperCharge 120W', isCharging: true },
  { time: '22:00', hour: 22, level: 93, status: 'Web Browsing' },
  { time: '00:00', hour: 24, level: 91, status: 'Night Standby' },
  { time: '02:00', hour: 2, level: 90, status: 'Deep Sleep' },
  { time: '04:00', hour: 4, level: 89, status: 'Deep Sleep' },
  { time: '06:00', hour: 6, level: 88, status: 'Current Battery Level' }
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as BatteryPoint;
    return React.createElement(
      'div',
      {
        style: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(0, 242, 254, 0.4)',
          borderRadius: '12px',
          padding: '8px 12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(16px)',
          fontFamily: 'inherit',
          color: '#fff',
          fontSize: '12px'
        }
      },
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#38bdf8' } },
        React.createElement('span', null, label),
        data.isCharging ? React.createElement('span', { style: { color: '#10b981', fontSize: '11px' } }, '⚡ Charging') : null
      ),
      React.createElement(
        'div',
        { style: { fontSize: '16px', fontWeight: 800, color: '#00f2fe', margin: '3px 0' } },
        `${data.level}%`
      ),
      React.createElement(
        'div',
        { style: { color: '#94a3b8', fontSize: '11px' } },
        data.status
      )
    );
  }
  return null;
};

let activeRoot: Root | null = null;

export function mountBatteryChart(container: HTMLElement) {
  if (activeRoot) {
    try {
      activeRoot.unmount();
    } catch {
      // Ignored
    }
  }

  activeRoot = createRoot(container);

  const chartElement = React.createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '200px',
        position: 'relative'
      }
    },
    React.createElement(
      ResponsiveContainer as any,
      { width: '100%', height: '100%' },
      React.createElement(
        AreaChart,
        {
          data: BATTERY_24H_DATA,
          margin: { top: 10, right: 10, left: -20, bottom: 0 }
        },
        React.createElement(
          'defs',
          null,
          React.createElement(
            'linearGradient',
            { id: 'batteryCyanGlow', x1: '0', y1: '0', x2: '0', y2: '1' },
            React.createElement('stop', { offset: '5%', stopColor: '#00f2fe', stopOpacity: 0.45 }),
            React.createElement('stop', { offset: '95%', stopColor: '#2563eb', stopOpacity: 0.0 })
          )
        ),
        React.createElement(CartesianGrid, {
          strokeDasharray: '3 3',
          stroke: 'rgba(255, 255, 255, 0.08)',
          vertical: false
        }),
        React.createElement(XAxis, {
          dataKey: 'time',
          stroke: '#94a3b8',
          fontSize: 10,
          tickLine: false,
          axisLine: { stroke: 'rgba(255, 255, 255, 0.1)' }
        }),
        React.createElement(YAxis, {
          domain: [0, 100],
          stroke: '#94a3b8',
          fontSize: 10,
          tickLine: false,
          ticks: [20, 50, 80, 100],
          axisLine: { stroke: 'rgba(255, 255, 255, 0.1)' },
          unit: '%'
        }),
        React.createElement(Tooltip, { content: React.createElement(CustomTooltip) }),
        React.createElement(Area, {
          type: 'monotone',
          dataKey: 'level',
          stroke: '#00f2fe',
          strokeWidth: 2.5,
          fillOpacity: 1,
          fill: 'url(#batteryCyanGlow)',
          dot: { r: 3, fill: '#00f2fe', strokeWidth: 1, stroke: '#fff' },
          activeDot: { r: 6, fill: '#38bdf8', stroke: '#fff', strokeWidth: 2 }
        })
      )
    )
  );

  activeRoot.render(chartElement);
}

export function unmountBatteryChart() {
  if (activeRoot) {
    try {
      activeRoot.unmount();
    } catch {
      // Ignored
    }
    activeRoot = null;
  }
}

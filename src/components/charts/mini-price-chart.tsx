/**
 * Mini Price Chart Component
 * Compact chart for dashboard and portfolio views
 */

'use client';

import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { useHistoricalData } from '@/hooks/use-historical-data';
import type { AssetType } from '@/types';
import { Loader2 } from 'lucide-react';

interface MiniPriceChartProps {
  symbol: string;
  assetType: AssetType;
  currentPrice?: number;
  days?: number;
  height?: number;
  showPositive?: boolean;
}

export function MiniPriceChart({
  symbol,
  assetType,
  currentPrice,
  days = 7,
  height = 60,
  showPositive = true,
}: MiniPriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  const { data: historicalData, isLoading } = useHistoricalData(symbol, assetType, days);

  // Determine if price is going up or down
  const isPositive = historicalData && historicalData.length >= 2
    ? historicalData[historicalData.length - 1].price > historicalData[0].price
    : showPositive;

  const lineColor = isPositive ? '#22c55e' : '#ef4444';
  const topColor = isPositive ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'transparent',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      leftPriceScale: { visible: false },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      handleScroll: false,
      handleScale: false,
    });

    // Create area series
    const series = chart.addAreaSeries({
      lineColor: lineColor,
      topColor: topColor,
      bottomColor: 'rgba(0, 0, 0, 0)',
      lineWidth: 1.5,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [lineColor, topColor, height]);

  useEffect(() => {
    if (!historicalData || !seriesRef.current) return;

    // Convert data to chart format
    const chartData = historicalData
      .map((point) => ({
        time: point.date,
        value: point.price,
      }))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    // Add current price if available
    if (currentPrice && chartData.length > 0) {
      const lastDate = new Date(chartData[chartData.length - 1].time);
      const today = new Date();

      if (today > lastDate) {
        chartData.push({
          time: today.toISOString().split('T')[0],
          value: currentPrice,
        });
      }
    }

    seriesRef.current.setData(chartData);

    // Auto-scale to fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [historicalData, currentPrice]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!historicalData || historicalData.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-muted-foreground" style={{ height }}>
        No data
      </div>
    );
  }

  return <div ref={chartContainerRef} className="w-full" />;
}

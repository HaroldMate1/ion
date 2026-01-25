/**
 * Price Chart Component
 * Interactive price chart using TradingView Lightweight Charts
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { useHistoricalData } from '@/hooks/use-historical-data';
import type { AssetType } from '@/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

interface PriceChartProps {
  symbol: string;
  assetType: AssetType;
  currentPrice?: number;
}

type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y';

const timeframeMap: Record<Timeframe, number> = {
  '1D': 1,
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '1Y': 365,
};

export function PriceChart({ symbol, assetType, currentPrice }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('1M');

  const { data: historicalData, isLoading } = useHistoricalData(
    symbol,
    assetType,
    timeframeMap[timeframe]
  );

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#666',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#e0e0e0',
      },
      crosshair: {
        mode: 1,
      },
    });

    // Create area series
    const series = chart.addAreaSeries({
      lineColor: '#2563eb',
      topColor: 'rgba(37, 99, 235, 0.4)',
      bottomColor: 'rgba(37, 99, 235, 0.0)',
      lineWidth: 2,
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
  }, []);

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

      // Only add current price if it's newer than the last historical data point
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

  return (
    <div className="space-y-4">
      <Tabs value={timeframe} onValueChange={(value) => setTimeframe(value as Timeframe)}>
        <TabsList>
          <TabsTrigger value="1D">1D</TabsTrigger>
          <TabsTrigger value="1W">1W</TabsTrigger>
          <TabsTrigger value="1M">1M</TabsTrigger>
          <TabsTrigger value="3M">3M</TabsTrigger>
          <TabsTrigger value="1Y">1Y</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <div ref={chartContainerRef} className="w-full" />
      </div>
    </div>
  );
}

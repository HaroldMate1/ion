/**
 * Trading Validation Schemas
 * Zod schemas for trade operations
 */

import { z } from 'zod';

export const tradeSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required').toUpperCase(),
  assetType: z.enum(['stock', 'crypto', 'etf'], {
    errorMap: () => ({ message: 'Invalid asset type' }),
  }),
  assetName: z.string().min(1, 'Asset name is required'),
  quantity: z.number().positive('Quantity must be positive'),
  market: z.enum(['us', 'europe', 'colombia']).default('us'),
});

export const buySchema = tradeSchema;
export const sellSchema = tradeSchema;

export type TradeInput = z.infer<typeof tradeSchema>;

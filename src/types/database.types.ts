/**
 * Database Types
 *
 * To generate updated types from your Supabase project, run:
 * npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
 *
 * Or use the Supabase CLI:
 * supabase gen types typescript --linked > src/types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AssetType = 'stock' | 'crypto' | 'etf';
export type TransactionType = 'buy' | 'sell';
export type Market = 'us' | 'europe' | 'colombia';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          initial_balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          initial_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          initial_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      balances: {
        Row: {
          id: string;
          user_id: string;
          available_cash: number;
          reserved_cash: number;
          total_invested: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          available_cash?: number;
          reserved_cash?: number;
          total_invested?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          available_cash?: number;
          reserved_cash?: number;
          total_invested?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      portfolios: {
        Row: {
          id: string;
          user_id: string;
          asset_type: AssetType;
          symbol: string;
          asset_name: string;
          quantity: number;
          average_buy_price: number;
          total_invested: number;
          market: Market;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          asset_type: AssetType;
          symbol: string;
          asset_name: string;
          quantity: number;
          average_buy_price: number;
          total_invested: number;
          market?: Market;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          asset_type?: AssetType;
          symbol?: string;
          asset_name?: string;
          quantity?: number;
          average_buy_price?: number;
          total_invested?: number;
          market?: Market;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          asset_type: AssetType;
          symbol: string;
          asset_name: string;
          transaction_type: TransactionType;
          quantity: number;
          price_per_unit: number;
          total_amount: number;
          fee: number;
          market: Market;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          asset_type: AssetType;
          symbol: string;
          asset_name: string;
          transaction_type: TransactionType;
          quantity: number;
          price_per_unit: number;
          total_amount: number;
          fee?: number;
          market?: Market;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          asset_type?: AssetType;
          symbol?: string;
          asset_name?: string;
          transaction_type?: TransactionType;
          quantity?: number;
          price_per_unit?: number;
          total_amount?: number;
          fee?: number;
          market?: Market;
          created_at?: string;
        };
      };
      watchlists: {
        Row: {
          id: string;
          user_id: string;
          asset_type: AssetType;
          symbol: string;
          asset_name: string;
          added_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          asset_type: AssetType;
          symbol: string;
          asset_name: string;
          added_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          asset_type?: AssetType;
          symbol?: string;
          asset_name?: string;
          added_at?: string;
        };
      };
      portfolio_snapshots: {
        Row: {
          id: string;
          user_id: string;
          total_value: number;
          cash_balance: number;
          portfolio_value: number;
          total_profit_loss: number;
          total_profit_loss_percentage: number;
          snapshot_date: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          total_value: number;
          cash_balance: number;
          portfolio_value: number;
          total_profit_loss: number;
          total_profit_loss_percentage: number;
          snapshot_date?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          total_value?: number;
          cash_balance?: number;
          portfolio_value?: number;
          total_profit_loss?: number;
          total_profit_loss_percentage?: number;
          snapshot_date?: string;
        };
      };
      price_cache: {
        Row: {
          id: string;
          symbol: string;
          asset_type: AssetType;
          price: number;
          change_24h: number | null;
          volume_24h: number | null;
          market_cap: number | null;
          cached_at: string;
        };
        Insert: {
          id?: string;
          symbol: string;
          asset_type: AssetType;
          price: number;
          change_24h?: number | null;
          volume_24h?: number | null;
          market_cap?: number | null;
          cached_at?: string;
        };
        Update: {
          id?: string;
          symbol?: string;
          asset_type?: AssetType;
          price?: number;
          change_24h?: number | null;
          volume_24h?: number | null;
          market_cap?: number | null;
          cached_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      asset_type: AssetType;
      transaction_type: TransactionType;
      market: Market;
    };
  };
}

-- EatEsts Database Schema
-- Run this in your Supabase SQL editor

-- Cost centers (restaurants / establishments)
CREATE TABLE IF NOT EXISTS cost_centers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendors / Suppliers
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Orders (Pedidos de compra)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE CASCADE,
  vendor_id TEXT,
  vendor_name TEXT,
  date DATE,
  total DECIMAL(10, 2),
  status TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Deliveries (Albaranes de compra)
CREATE TABLE IF NOT EXISTS purchase_deliveries (
  id TEXT PRIMARY KEY,
  cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE CASCADE,
  vendor_id TEXT,
  vendor_name TEXT,
  date DATE,
  total DECIMAL(10, 2),
  status TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Invoices (Facturas de compra)
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id TEXT PRIMARY KEY,
  cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE CASCADE,
  vendor_id TEXT,
  vendor_name TEXT,
  date DATE,
  total DECIMAL(10, 2),
  status TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Deliveries (Albaranes de venta)
CREATE TABLE IF NOT EXISTS sales_deliveries (
  id TEXT PRIMARY KEY,
  cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE CASCADE,
  date DATE,
  total DECIMAL(10, 2),
  status TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Invoices (Facturas de venta)
CREATE TABLE IF NOT EXISTS sales_invoices (
  id TEXT PRIMARY KEY,
  cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE CASCADE,
  date DATE,
  total DECIMAL(10, 2),
  status TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration logs
CREATE TABLE IF NOT EXISTS migration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tspoonlab_email TEXT,
  status TEXT DEFAULT 'running',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  details JSONB,
  error TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendors_cost_center ON vendors(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_cost_center ON purchase_orders(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(date);
CREATE INDEX IF NOT EXISTS idx_purchase_deliveries_cost_center ON purchase_deliveries(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_purchase_deliveries_date ON purchase_deliveries(date);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_cost_center ON purchase_invoices(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(date);
CREATE INDEX IF NOT EXISTS idx_sales_deliveries_cost_center ON sales_deliveries(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_sales_deliveries_date ON sales_deliveries(date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_cost_center ON sales_invoices(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(date);

-- Enable Row Level Security (optional, disable for now for simplicity)
-- ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;

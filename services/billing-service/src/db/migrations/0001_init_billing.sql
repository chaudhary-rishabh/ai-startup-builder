CREATE SCHEMA IF NOT EXISTS billing;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE billing.sub_status_enum AS ENUM ('active','past_due','cancelled','trialing','paused');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE billing.tx_status_enum AS ENUM ('succeeded','failed','refunded','pending');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS billing.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  price_yearly_cents INTEGER NOT NULL DEFAULT 0,
  stripe_price_monthly_id VARCHAR(100) NULL,
  stripe_price_yearly_id VARCHAR(100) NULL,
  stripe_product_id VARCHAR(100) NULL,
  token_limit_monthly BIGINT NOT NULL,
  project_limit INTEGER NOT NULL DEFAULT 3,
  api_key_limit INTEGER NOT NULL DEFAULT 2,
  features TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS billing_plans_active_idx ON billing.plans(is_active);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS billing.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  plan_id UUID NOT NULL REFERENCES billing.plans(id),
  stripe_customer_id VARCHAR(100) UNIQUE NOT NULL,
  stripe_subscription_id VARCHAR(100) UNIQUE NULL,
  status billing.sub_status_enum NOT NULL,
  billing_cycle VARCHAR(10) NULL,
  current_period_start TIMESTAMPTZ NULL,
  current_period_end TIMESTAMPTZ NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ NULL,
  trial_end TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS billing_subscriptions_status_period_idx
  ON billing.subscriptions(status, current_period_end);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS billing.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  subscription_id UUID NULL REFERENCES billing.subscriptions(id),
  stripe_invoice_id VARCHAR(100) UNIQUE NULL,
  stripe_charge_id VARCHAR(100) NULL,
  stripe_event_id VARCHAR(100) NULL,
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'usd',
  status billing.tx_status_enum NOT NULL,
  description TEXT NULL,
  refunded_amount_cents INTEGER NOT NULL DEFAULT 0,
  refunded_at TIMESTAMPTZ NULL,
  invoice_pdf_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS billing_transactions_user_created_idx
  ON billing.transactions(user_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS billing_transactions_event_id_idx
  ON billing.transactions(stripe_event_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS billing.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent','amount')),
  discount_value DECIMAL(10,2) NOT NULL,
  max_uses INTEGER NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_for_plans TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NULL,
  stripe_coupon_id VARCHAR(100) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS billing.token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  month DATE NOT NULL,
  tokens_used BIGINT NOT NULL DEFAULT 0,
  tokens_limit BIGINT NOT NULL,
  cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, month)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS billing_token_usage_user_month_idx
  ON billing.token_usage(user_id, month DESC);
--> statement-breakpoint
INSERT INTO billing.plans
  (name, display_name, price_monthly_cents, price_yearly_cents, token_limit_monthly, project_limit, api_key_limit, features, is_active, sort_order)
VALUES
  ('free', 'Free', 0, 0, 50000, 3, 2, ARRAY['Phase 1 & 2 only','3 projects','50K tokens/month','2 API keys'], TRUE, 1),
  ('pro', 'Pro', 2900, 29000, 500000, 20, 10, ARRAY['All 6 phases','20 projects','500K tokens/month','10 API keys','Code export','Priority support'], TRUE, 2),
  ('team', 'Team', 9900, 99000, 2000000, -1, -1, ARRAY['Everything in Pro','Unlimited projects','2M tokens/month','Unlimited API keys','Team collaboration (coming soon)','Custom integrations'], TRUE, 3),
  ('enterprise', 'Enterprise', 0, 0, -1, -1, -1, ARRAY['Everything in Team','Unlimited tokens','Custom contracts','Dedicated support','SLA guarantees','SSO/SAML'], TRUE, 4)
ON CONFLICT (name) DO NOTHING;

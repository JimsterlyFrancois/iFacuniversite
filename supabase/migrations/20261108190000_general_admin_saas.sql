-- iFac Université: SaaS administration and manual billing foundation.
-- Apply this migration before deploying the general administrator workspace.

CREATE TABLE IF NOT EXISTS public.saas_plans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  billing_interval VARCHAR(16) NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly','yearly','one_time')),
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.university_subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  university_id BIGINT NOT NULL REFERENCES public.universities(id) ON DELETE RESTRICT,
  plan_id BIGINT NOT NULL REFERENCES public.saas_plans(id) ON DELETE RESTRICT,
  status VARCHAR(16) NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing','active','past_due','suspended','canceled')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  grace_until TIMESTAMPTZ,
  external_customer_id VARCHAR(180),
  notes TEXT,
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS university_subscriptions_university_status_idx
  ON public.university_subscriptions(university_id,status,created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS university_subscriptions_one_current_idx
  ON public.university_subscriptions(university_id)
  WHERE status IN ('trialing','active','past_due','suspended');

CREATE TABLE IF NOT EXISTS public.billing_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id BIGINT REFERENCES public.university_subscriptions(id) ON DELETE SET NULL,
  university_id BIGINT NOT NULL REFERENCES public.universities(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(48) NOT NULL UNIQUE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(16) NOT NULL DEFAULT 'issued'
    CHECK (status IN ('draft','issued','paid','overdue','void')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_reference VARCHAR(180),
  notes TEXT,
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (due_at IS NULL OR due_at >= issued_at)
);
CREATE INDEX IF NOT EXISTS billing_records_university_status_idx
  ON public.billing_records(university_id,status,issued_at DESC);

INSERT INTO public.saas_plans(code,name,description,amount_cents,currency,billing_interval,limits)
VALUES
 ('starter','Starter','Offre de démarrage à configurer',0,'USD','monthly',
  '{"universities":1,"students":250,"storage_gb":2,"support":"standard"}'::jsonb),
 ('campus','Campus','Offre campus à configurer',0,'USD','monthly',
  '{"universities":1,"students":1500,"storage_gb":20,"support":"priority"}'::jsonb),
 ('institution','Institution','Offre institutionnelle à configurer',0,'USD','yearly',
  '{"universities":5,"students":10000,"storage_gb":100,"support":"priority"}'::jsonb)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.saas_plans, public.university_subscriptions, public.billing_records
  FROM anon, authenticated;

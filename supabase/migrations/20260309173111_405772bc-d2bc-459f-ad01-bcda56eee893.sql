
-- Add unique constraint on wallet_address for subscriber upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'aegis_subscribers_wallet_address_unique'
  ) THEN
    ALTER TABLE public.aegis_subscribers
      ADD CONSTRAINT aegis_subscribers_wallet_address_unique UNIQUE (wallet_address);
  END IF;
END;
$$;

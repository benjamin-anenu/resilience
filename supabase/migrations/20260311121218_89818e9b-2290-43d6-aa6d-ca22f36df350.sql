
-- Create a public-safe view for canary_nodes that hides sensitive fields
CREATE OR REPLACE VIEW public.canary_nodes_public AS
SELECT
  id,
  node_id,
  reputation_score,
  total_reports,
  accurate_reports,
  false_reports,
  geographic_region,
  status,
  last_seen_at,
  version,
  registered_at
FROM public.canary_nodes;

-- Restrict direct public reads on canary_nodes to service_role only
DROP POLICY IF EXISTS "canary_nodes_public_read" ON public.canary_nodes;

CREATE POLICY "canary_nodes_service_read"
ON public.canary_nodes
FOR SELECT
TO public
USING (auth.role() = 'service_role');

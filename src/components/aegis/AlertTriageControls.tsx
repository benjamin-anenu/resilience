import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, ArrowUpCircle, XCircle, Shield, Loader2 } from 'lucide-react';

interface AlertTriageProps {
  alertId: string;
  currentStatus: string;
  currentSeverity: string;
  onUpdated?: () => void;
}

const ACTIONS = [
  { value: 'acknowledge', label: 'Acknowledge', icon: CheckCircle2, description: 'Mark as seen and being investigated', color: 'text-blue-400' },
  { value: 'escalate', label: 'Escalate', icon: ArrowUpCircle, description: 'Raise severity or flag for immediate review', color: 'text-amber-400' },
  { value: 'resolve', label: 'Resolve', icon: Shield, description: 'Mark as resolved — no longer active', color: 'text-emerald-400' },
  { value: 'dismiss', label: 'Dismiss', icon: XCircle, description: 'False positive — dismiss this alert', color: 'text-muted-foreground' },
];

export function AlertTriageControls({ alertId, currentStatus, currentSeverity, onUpdated }: AlertTriageProps) {
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const [escalateTo, setEscalateTo] = useState('P1');
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSubmit = async () => {
    if (!action) {
      toast.error('Select an action');
      return;
    }

    setSubmitting(true);
    try {
      let updateData: Record<string, unknown> = {};

      switch (action) {
        case 'acknowledge':
          updateData = {
            status: 'ACKNOWLEDGED',
            acknowledged_at: new Date().toISOString(),
          };
          break;
        case 'escalate':
          updateData = {
            severity: escalateTo,
            status: 'FIRING',
          };
          break;
        case 'resolve':
          updateData = {
            status: 'RESOLVED',
            resolved_at: new Date().toISOString(),
          };
          break;
        case 'dismiss':
          updateData = {
            status: 'RESOLVED',
            resolved_at: new Date().toISOString(),
          };
          break;
      }

      // This requires service role — attempt via edge function or direct
      // For now, we attempt direct update (will work if RLS allows service_role)
      const { error } = await supabase
        .from('alerts')
        .update(updateData)
        .eq('id', alertId);

      if (error) {
        // If RLS blocks, show appropriate message
        toast.error('Triage requires elevated permissions. Contact an admin.');
        return;
      }

      // Log to audit trail
      await supabase.from('aegis_audit_log').insert({
        action: `alert.${action}`,
        target_table: 'alerts',
        target_id: alertId,
        actor_type: 'user',
        new_values: { ...updateData, notes },
      }).then(() => {}); // fire-and-forget

      toast.success(`Alert ${action}d successfully`);
      setOpen(false);
      setAction('');
      setNotes('');
      onUpdated?.();
    } catch {
      toast.error('Unexpected error');
    } finally {
      setSubmitting(false);
    }
  };

  if (currentStatus === 'RESOLVED') {
    return (
      <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
        RESOLVED
      </Badge>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs font-mono gap-1.5">
          <Shield className="h-3 w-3" />
          Triage
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Triage Alert</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span>Alert: {alertId.slice(0, 8)}...</span>
            <Badge variant="outline" className={cn(
              'text-[10px]',
              currentSeverity === 'P1' && 'bg-red-500/20 text-red-400 border-red-500/30',
              currentSeverity === 'P2' && 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            )}>
              {currentSeverity}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{currentStatus}</Badge>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            {ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.value}
                  onClick={() => setAction(a.value)}
                  className={cn(
                    'rounded-md border p-3 text-left transition-all',
                    action === a.value
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border hover:border-border/80'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn('h-4 w-4', a.color)} />
                    <span className="text-xs font-semibold text-foreground">{a.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{a.description}</p>
                </button>
              );
            })}
          </div>

          {action === 'escalate' && (
            <div>
              <label className="text-[10px] text-muted-foreground font-mono uppercase mb-1 block">
                Escalate To
              </label>
              <Select value={escalateTo} onValueChange={setEscalateTo}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="P1">🔴 P1 — Critical</SelectItem>
                  <SelectItem value="P2">🟠 P2 — Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-[10px] text-muted-foreground font-mono uppercase mb-1 block">
              Notes (optional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add context about this triage action..."
              className="text-xs min-h-[60px] resize-none"
            />
          </div>

          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="flex-1 text-xs">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSubmit}
              disabled={!action || submitting}
              size="sm"
              className="flex-1 text-xs font-display font-semibold tracking-wider"
            >
              {submitting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
              {submitting ? 'Processing...' : 'Confirm'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

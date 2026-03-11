import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Shield, Wallet, Scan, Bell, Send, Check, Loader2,
  MessageSquare, ChevronDown, ChevronUp, Zap
} from 'lucide-react';

interface DetectedPosition {
  protocol_slug: string;
  protocol_name: string;
  protocol_id: string;
  source: 'token' | 'program_interaction';
  details: string;
}

type Step = 'connect' | 'scanning' | 'configure' | 'done';

/**
 * Build a structured message for wallet signature verification.
 * The edge function verifies: wallet match, timestamp freshness, Ed25519 sig.
 */
function buildSignMessage(walletAddress: string, action: string): string {
  return [
    'Aegis Alert Subscription',
    '',
    `Action: ${action}`,
    `Wallet: ${walletAddress}`,
    `Timestamp: ${new Date().toISOString()}`,
    '',
    'This signature does not authorize any blockchain transaction.',
  ].join('\n');
}

export function SubscriptionPanel() {
  const { publicKey, connected, signMessage: walletSignMessage } = useWallet();
  const [step, setStep] = useState<Step>('connect');
  const [positions, setPositions] = useState<DetectedPosition[]>([]);
  const [selectedProtocols, setSelectedProtocols] = useState<Set<string>>(new Set());
  const [telegramChatId, setTelegramChatId] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [minSeverity, setMinSeverity] = useState('P2');
  const [nickname, setNickname] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [existingSubscriber, setExistingSubscriber] = useState<any>(null);

  /**
   * Sign a message with the connected wallet and return base64 signature + message.
   */
  const signForAction = useCallback(async (action: string): Promise<{ signature: string; signed_message: string } | null> => {
    if (!publicKey || !walletSignMessage) {
      toast.error('Wallet does not support message signing');
      return null;
    }
    try {
      const message = buildSignMessage(publicKey.toBase58(), action);
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await walletSignMessage(messageBytes);
      // Convert to base64 for transport
      const signature = btoa(String.fromCharCode(...signatureBytes));
      return { signature, signed_message: message };
    } catch (err) {
      if (err instanceof Error && (err.message.includes('rejected') || err.message.includes('User rejected'))) {
        toast.error('Signature rejected — please approve to continue');
      } else {
        toast.error('Failed to sign message');
      }
      return null;
    }
  }, [publicKey, walletSignMessage]);

  const scanWallet = useCallback(async () => {
    if (!publicKey) return;
    setStep('scanning');

    try {
      // Scan is read-only, no signature needed
      const { data, error } = await supabase.functions.invoke('manage-aegis-subscriptions', {
        body: { action: 'scan', wallet_address: publicKey.toBase58() },
      });

      if (error) throw error;

      setPositions(data.positions || []);
      setSelectedProtocols(new Set((data.positions || []).map((p: DetectedPosition) => p.protocol_id)));
      setExistingSubscriber(data.existing_subscriber);

      if (data.existing_subscriber?.nickname) {
        setNickname(data.existing_subscriber.nickname);
      }

      setStep('configure');
    } catch (e) {
      console.error('Scan error:', e);
      toast.error('Failed to scan wallet positions');
      setStep('connect');
    }
  }, [publicKey]);

  const handleSubscribe = async () => {
    if (!publicKey || selectedProtocols.size === 0) {
      toast.error('Select at least one protocol');
      return;
    }
    if (!telegramChatId && !discordWebhook) {
      toast.error('Add at least one notification channel (Telegram or Discord)');
      return;
    }

    // Request wallet signature before subscribing
    const auth = await signForAction('subscribe');
    if (!auth) return;

    setSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-aegis-subscriptions', {
        body: {
          action: 'subscribe',
          wallet_address: publicKey.toBase58(),
          signature: auth.signature,
          signed_message: auth.signed_message,
          nickname: nickname || undefined,
          telegram_chat_id: telegramChatId || undefined,
          discord_webhook: discordWebhook || undefined,
          protocol_ids: Array.from(selectedProtocols),
          min_severity: minSeverity,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Subscribed to ${data.protocols_subscribed} protocols!`);
      setStep('done');
    } catch (e) {
      console.error('Subscribe error:', e);
      toast.error(e instanceof Error ? e.message : 'Subscription failed');
    } finally {
      setSubscribing(false);
    }
  };

  const toggleProtocol = (id: string) => {
    setSelectedProtocols(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Collapsed CTA state
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={cn(
          "w-full rounded-lg border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-lg",
          "flex items-center justify-between group cursor-pointer"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-display text-sm font-semibold text-foreground">
              Wallet-Native Alerts
            </h3>
            <p className="text-xs text-muted-foreground">
              Connect wallet → auto-detect positions → get alerts on Telegram/Discord
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
            <Zap className="h-3 w-3 mr-1" />
            NEW
          </Badge>
          <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">
              Subscribe to Aegis Alerts
            </h3>
            <p className="text-xs text-muted-foreground">
              {step === 'connect' && 'Connect your wallet to get started'}
              {step === 'scanning' && 'Scanning your on-chain positions...'}
              {step === 'configure' && `${positions.length} protocols detected — configure alerts`}
              {step === 'done' && 'You\'re subscribed! Alerts will be delivered in real-time.'}
            </p>
          </div>
        </div>
        <button onClick={() => setExpanded(false)}>
          <ChevronUp className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Step 1: Connect Wallet */}
        {step === 'connect' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Wallet className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Aegis scans your wallet's token holdings and recent transactions to auto-subscribe you to relevant protocol alerts.
            </p>
            {connected ? (
              <Button onClick={scanWallet} className="gap-2">
                <Scan className="h-4 w-4" />
                Scan My Positions
              </Button>
            ) : (
              <WalletMultiButton />
            )}
          </div>
        )}

        {/* Step 2: Scanning */}
        {step === 'scanning' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground font-mono">
              Scanning token accounts & recent transactions...
            </p>
          </div>
        )}

        {/* Step 3: Configure */}
        {step === 'configure' && (
          <>
            {existingSubscriber && (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-xs text-emerald-400 font-mono">
                  ✓ Existing subscription found — updating your preferences
                </p>
              </div>
            )}

            {/* Detected Protocols */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Detected Protocols
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {positions.map((pos) => (
                  <button
                    key={pos.protocol_id}
                    onClick={() => toggleProtocol(pos.protocol_id)}
                    className={cn(
                      "flex items-center gap-3 rounded-md border p-3 text-left transition-all",
                      selectedProtocols.has(pos.protocol_id)
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/50 bg-card hover:border-border"
                    )}
                  >
                    <div className={cn(
                      "flex h-6 w-6 items-center justify-center rounded border text-xs",
                      selectedProtocols.has(pos.protocol_id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted"
                    )}>
                      {selectedProtocols.has(pos.protocol_id) && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{pos.protocol_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{pos.details}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] shrink-0">
                      {pos.source === 'token' ? 'TOKEN' : 'INTERACTION'}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* Notification Channels */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Notification Channels
              </label>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-blue-400 shrink-0" />
                  <Input
                    placeholder="Telegram Chat ID (e.g. -1001234567890)"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-indigo-400 shrink-0" />
                  <Input
                    placeholder="Discord Webhook URL (optional)"
                    value={discordWebhook}
                    onChange={(e) => setDiscordWebhook(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Severity & Advanced */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Min Severity
                </label>
                <Select value={minSeverity} onValueChange={setMinSeverity}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P1">🔴 P1 — Critical only</SelectItem>
                    <SelectItem value="P2">🟠 P2 — Warnings & above</SelectItem>
                    <SelectItem value="P3">🟡 P3 — All alerts</SelectItem>
                    <SelectItem value="INFO">ℹ️ INFO — Everything</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-muted-foreground hover:text-foreground mt-5"
              >
                Advanced ▾
              </button>
            </div>

            {showAdvanced && (
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Nickname (optional)</label>
                <Input
                  placeholder="My Wallet"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="text-sm"
                />
              </div>
            )}

            {/* Auth notice */}
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5">
              <p className="text-[10px] text-amber-400 font-mono">
                🔐 You'll be asked to sign a message to prove wallet ownership. No transaction will be submitted.
              </p>
            </div>

            {/* Subscribe Button */}
            <Button
              onClick={handleSubscribe}
              disabled={subscribing || selectedProtocols.size === 0}
              className="w-full gap-2"
              size="lg"
            >
              {subscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              {subscribing
                ? 'Subscribing...'
                : `Sign & Subscribe to ${selectedProtocols.size} Protocol${selectedProtocols.size !== 1 ? 's' : ''}`}
            </Button>
          </>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-500/30 bg-emerald-500/10">
              <Check className="h-7 w-7 text-emerald-400" />
            </div>
            <h4 className="font-display text-lg font-semibold text-foreground">You're Protected</h4>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Aegis is now monitoring your positions. You'll receive alerts via your configured channels when anomalies are detected.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setStep('configure'); }}
              className="mt-2"
            >
              Edit Preferences
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

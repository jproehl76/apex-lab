import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, CheckCircle, Loader } from 'lucide-react';
import type { UserProfile } from '@/lib/userProfile';
import { readProfile, writeProfile, lookupVin } from '@/lib/userProfile';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@/lib/services/modelConfig';

interface Props {
  email: string;
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
}

type TestState = 'idle' | 'testing' | 'ok' | 'fail';

export function AISettings({ email, onClose, onSave }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [carName, setCarName]           = useState('');
  const [vin, setVin]                   = useState('');
  const [vinLoading, setVinLoading]     = useState(false);
  const [aiEnabled, setAiEnabled]       = useState(false);
  const [apiKey, setApiKey]             = useState('');
  const [showKey, setShowKey]           = useState(false);
  const [modelId, setModelId]           = useState<UserProfile['preferredModel']>(DEFAULT_MODEL);
  const [testState, setTestState]       = useState<TestState>('idle');
  const [testError, setTestError]       = useState('');
  const [saved, setSaved]               = useState(false);

  useEffect(() => {
    readProfile(email).then(p => {
      setLoading(false);
      if (!p) return;
      setProfile(p);
      setCarName(p.carName);
      setAiEnabled(p.aiCoachingEnabled);
      setApiKey(p.anthropicApiKey ?? '');
      setModelId(p.preferredModel ?? DEFAULT_MODEL);
    });
  }, [email]);

  async function handleVinLookup() {
    if (vin.length !== 17) return;
    setVinLoading(true);
    const result = await lookupVin(vin.toUpperCase());
    setVinLoading(false);
    if (result) setCarName(`${result.year} ${result.make} ${result.model}`.trim());
  }

  async function handleTestKey() {
    if (!apiKey.trim()) return;
    setTestState('testing');
    setTestError('');
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':                           'application/json',
          'x-api-key':                              apiKey.trim(),
          'anthropic-version':                      '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      modelId,
          max_tokens: 10,
          messages:   [{ role: 'user', content: 'Reply: ok' }],
        }),
      });
      if (res.ok) {
        setTestState('ok');
      } else {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
        setTestState('fail');
        setTestError(body?.error?.message ?? `HTTP ${res.status}`);
      }
    } catch (e) {
      setTestState('fail');
      setTestError(e instanceof Error ? e.message : 'Network error');
    }
  }

  async function handleSave() {
    const updated: UserProfile = {
      ...(profile ?? {}),
      email,
      carName:           carName.trim() || (profile?.carName ?? ''),
      aiCoachingEnabled: aiEnabled,
      anthropicApiKey:   apiKey.trim() || undefined,
      preferredModel:    modelId,
      updatedAt:         new Date().toISOString(),
    };
    await writeProfile(updated);
    setProfile(updated);
    onSave(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card overflow-hidden"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 style={{ fontFamily: 'BMWTypeNext', fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', color: '#F0F0FA' }}>
            Settings
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader size={18} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-5 space-y-6">

            {/* ── Car / Profile ─────────────────────────────────────────── */}
            <section className="space-y-3">
              <p style={{ fontFamily: 'BMWTypeNext', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#606080' }}>
                Car Profile
              </p>

              <div className="flex gap-2">
                <input
                  value={vin}
                  onChange={e => setVin(e.target.value.toUpperCase())}
                  placeholder="VIN (17 chars, optional)"
                  maxLength={17}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  style={{ fontFamily: 'JetBrains Mono', letterSpacing: '0.04em' }}
                />
                <button
                  onClick={handleVinLookup}
                  disabled={vinLoading || vin.length !== 17}
                  className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  style={{ fontFamily: 'BMWTypeNext' }}
                >
                  {vinLoading ? '…' : 'Lookup'}
                </button>
              </div>

              <input
                value={carName}
                onChange={e => setCarName(e.target.value)}
                placeholder="Car name (e.g. 2025 BMW M3 Competition)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ fontFamily: 'BMWTypeNext', fontSize: 12 }}
              />
            </section>

            {/* ── AI Coaching ───────────────────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <p style={{ fontFamily: 'BMWTypeNext', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#606080' }}>
                  AI Coaching
                </p>
                {/* Toggle */}
                <button
                  onClick={() => setAiEnabled(v => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${aiEnabled ? 'bg-primary' : 'bg-border'}`}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                    style={{ left: aiEnabled ? '1.25rem' : '0.125rem' }}
                  />
                </button>
              </div>

              {aiEnabled && (
                <div className="space-y-3">
                  {/* API key */}
                  <div className="space-y-1.5">
                    <label style={{ fontFamily: 'BMWTypeNext', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9090B0' }}>
                      Anthropic API Key
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={e => { setApiKey(e.target.value); setTestState('idle'); }}
                          placeholder="sk-ant-…"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-9 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          style={{ fontFamily: 'JetBrains Mono', letterSpacing: '0.04em' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(v => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                      <button
                        onClick={handleTestKey}
                        disabled={!apiKey.trim() || testState === 'testing'}
                        className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 flex items-center gap-1"
                        style={{ fontFamily: 'BMWTypeNext', whiteSpace: 'nowrap' }}
                      >
                        {testState === 'testing' && <Loader size={11} className="animate-spin" />}
                        {testState === 'ok'      && <CheckCircle size={11} className="text-green-500" />}
                        {testState === 'idle' || testState === 'fail' ? 'Test' : testState === 'ok' ? 'OK' : '…'}
                      </button>
                    </div>
                    {testState === 'fail' && (
                      <p style={{ fontFamily: 'BMWTypeNext', fontSize: 10, color: '#EF3340' }}>{testError}</p>
                    )}
                    <p style={{ fontFamily: 'BMWTypeNext', fontSize: 10, color: '#505070' }}>
                      Stored locally in your browser. Never sent anywhere except Anthropic.
                    </p>
                  </div>

                  {/* Model selector */}
                  <div className="space-y-1.5">
                    <label style={{ fontFamily: 'BMWTypeNext', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9090B0' }}>
                      Model
                    </label>
                    <div className="space-y-1.5">
                      {AVAILABLE_MODELS.map(m => (
                        <label
                          key={m.id}
                          className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            modelId === m.id
                              ? 'border-primary/40 bg-primary/8'
                              : 'border-border hover:border-border/80'
                          }`}
                          style={{ background: modelId === m.id ? 'rgba(28,105,212,0.08)' : undefined }}
                        >
                          <input
                            type="radio"
                            name="model"
                            value={m.id}
                            checked={modelId === m.id}
                            onChange={() => setModelId(m.id)}
                            className="mt-0.5 accent-primary"
                          />
                          <div>
                            <p style={{ fontFamily: 'BMWTypeNext', fontSize: 12, fontWeight: 600, color: modelId === m.id ? '#A8C4F8' : '#E0E0F0' }}>
                              {m.label}
                            </p>
                            <p style={{ fontFamily: 'BMWTypeNext', fontSize: 10, color: '#606080', marginTop: 1 }}>
                              {m.hint}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            style={{ fontFamily: 'BMWTypeNext', letterSpacing: '0.1em' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-lg text-sm text-white transition-colors flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(to right, #1C69D4, #6B2D9E)',
              fontFamily: 'BMWTypeNext',
              letterSpacing: '0.1em',
            }}
          >
            {saved && <CheckCircle size={13} />}
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

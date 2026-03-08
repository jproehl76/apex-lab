import { useState } from 'react';
import { lookupVin, writeProfile, DEFAULT_PROFILE, type UserProfile } from '@/lib/userProfile';

interface Props {
  email: string;
  onSave: (profile: UserProfile) => void;
}

export function ProfileSetup({ email, onSave }: Props) {
  const [vin, setVin]               = useState('');
  const [carName, setCarName]       = useState('');
  const [carHp, setCarHp]           = useState('');
  const [carWeight, setCarWeight]   = useState('');
  const [carDrivetrain, setCarDrivetrain] = useState<UserProfile['carDrivetrain']>(undefined);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  async function handleVinLookup() {
    if (vin.length !== 17) { setError('VIN must be 17 characters'); return; }
    setLoading(true);
    setError('');
    const result = await lookupVin(vin.toUpperCase());
    setLoading(false);
    if (!result) { setError('VIN not found — enter car name manually below'); return; }
    setCarName(`${result.year} ${result.make} ${result.model}`.trim());
  }

  async function handleSave() {
    if (!carName.trim()) { setError('Please enter your car name'); return; }
    const profile: UserProfile = {
      ...DEFAULT_PROFILE,
      email,
      carName: carName.trim(),
      ...(carHp      ? { carHp: Number(carHp) }         : {}),
      ...(carWeight  ? { carWeight: Number(carWeight) }  : {}),
      ...(carDrivetrain ? { carDrivetrain }              : {}),
      updatedAt: new Date().toISOString(),
    };
    await writeProfile(profile);
    onSave(profile);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-5"
        style={{ fontFamily: 'BMWTypeNext' }}
      >
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#F0F0FA', letterSpacing: '0.05em' }}>
            Welcome to JP Apex Lab
          </h2>
          <p style={{ fontSize: 11, color: '#9090B0', marginTop: 4, letterSpacing: '0.05em' }}>
            Tell us about your car to personalise the dashboard
          </p>
        </div>

        {/* VIN lookup */}
        <div className="space-y-2">
          <label style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9090B0' }}>
            VIN (optional — auto-fills car name)
          </label>
          <div className="flex gap-2">
            <input
              value={vin}
              onChange={e => setVin(e.target.value.toUpperCase())}
              placeholder="17-character VIN"
              maxLength={17}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ fontFamily: 'JetBrains Mono', fontSize: 12, letterSpacing: '0.05em' }}
            />
            <button
              onClick={handleVinLookup}
              disabled={loading || vin.length !== 17}
              className="px-3 py-2 rounded-lg border border-border text-xs tracking-wider text-muted-foreground hover:text-foreground hover:border-primary transition-colors disabled:opacity-40"
            >
              {loading ? '…' : 'Lookup'}
            </button>
          </div>
        </div>

        {/* Car name */}
        <div className="space-y-2">
          <label style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9090B0' }}>
            Car Name
          </label>
          <input
            value={carName}
            onChange={e => setCarName(e.target.value)}
            placeholder="e.g. 2025 BMW M3 Competition"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Car specs (optional) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9090B0' }}>
              Horsepower
            </label>
            <input
              value={carHp}
              onChange={e => setCarHp(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 503"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <label style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9090B0' }}>
              Weight (lbs)
            </label>
            <input
              value={carWeight}
              onChange={e => setCarWeight(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 3828"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}
              inputMode="numeric"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9090B0' }}>
            Drivetrain
          </label>
          <div className="flex gap-2">
            {(['FWD', 'RWD', 'AWD', '4WD'] as const).map(dt => (
              <button
                key={dt}
                type="button"
                onClick={() => setCarDrivetrain(carDrivetrain === dt ? undefined : dt)}
                className="flex-1 py-1.5 rounded-lg border text-xs tracking-wider transition-colors"
                style={{
                  borderColor: carDrivetrain === dt ? '#1C69D4' : 'hsl(var(--border))',
                  background: carDrivetrain === dt ? 'rgba(28,105,212,0.15)' : 'transparent',
                  color: carDrivetrain === dt ? '#60A5FA' : '#9090B0',
                  fontFamily: 'BMWTypeNext',
                  letterSpacing: '0.08em',
                }}
              >
                {dt}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p style={{ fontSize: 11, color: '#EF3340' }}>{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={!carName.trim()}
          className="w-full py-2.5 rounded-lg text-sm tracking-wider transition-colors disabled:opacity-40"
          style={{
            background: carName.trim() ? 'linear-gradient(to right, #1C69D4, #6B2D9E)' : undefined,
            color: carName.trim() ? '#fff' : undefined,
            border: carName.trim() ? 'none' : '1px solid hsl(var(--border))',
            fontFamily: 'BMWTypeNext',
            letterSpacing: '0.12em',
          }}
        >
          Save &amp; Continue
        </button>
      </div>
    </div>
  );
}

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dentivohq/ui';
import { useEffect, useMemo, useRef, useState, type FormEvent, type MutableRefObject } from 'react';
import { apiRequest } from '../lib/api';
import { environment } from '../lib/environment';

declare global {
  interface Window { turnstile?: { render(element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void }): string; reset(widgetId?: string): void } }
}

type Option = { id: string; name?: string; display_name?: string };
type Config = { clinic: { name: string }; locations: Option[]; services: Option[]; dentists: Option[]; combinations: Array<{ locationId: string; dentistId: string; serviceId: string }> };
type Slot = { startsAt: string; endsAt: string };
type Selection = { locationId: string; dentistId: string; serviceId: string; date: string; startsAt: string };

export function PublicBooking({ clinicSlug }: { clinicSlug: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [message, setMessage] = useState('Loading booking options…');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selection, setSelection] = useState<Selection>({ locationId: '', dentistId: '', serviceId: '', date: '', startsAt: '' });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileWidget = useRef<string | undefined>(undefined);
  const bookingAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => { void apiRequest<{ data: Config }>(`/api/v1/public/clinics/${clinicSlug}/booking-config`).then((result) => { setConfig(result.data); setMessage(''); }).catch((error: Error) => setMessage(error.message)); }, [clinicSlug]);

  function select(field: keyof Selection, value: string) {
    setSelection((current) => ({ ...current, [field]: value, ...(field === 'locationId' ? { dentistId: '', serviceId: '', startsAt: '' } : field === 'dentistId' ? { serviceId: '', startsAt: '' } : field === 'startsAt' ? {} : { startsAt: '' }) }));
    if (field !== 'startsAt') setSlots([]);
  }

  const locations = useMemo(() => config?.locations.filter((location) => config.combinations.some((item) => item.locationId === location.id)) ?? [], [config]);
  const dentists = useMemo(() => config?.dentists.filter((dentist) => config.combinations.some((item) => (!selection.locationId || item.locationId === selection.locationId) && item.dentistId === dentist.id)) ?? [], [config, selection.locationId]);
  const services = useMemo(() => config?.services.filter((service) => config.combinations.some((item) => (!selection.locationId || item.locationId === selection.locationId) && (!selection.dentistId || item.dentistId === selection.dentistId) && item.serviceId === service.id)) ?? [], [config, selection.dentistId, selection.locationId]);

  async function findTimes() {
    if (!selection.locationId || !selection.dentistId || !selection.serviceId || !selection.date) {
      setMessage('Choose a location, dentist, service, and date first.');
      return;
    }
    setLoadingSlots(true);
    setMessage('Finding available times…');
    const query = new URLSearchParams({ locationId: selection.locationId, dentistId: selection.dentistId, serviceId: selection.serviceId, date: selection.date });
    try {
      const result = await apiRequest<{ data: Slot[] }>(`/api/v1/public/clinics/${clinicSlug}/availability?${query}`);
      setSlots(result.data);
      setMessage(result.data.length ? 'Choose one of the available times.' : 'No times are available on this date.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load available times.');
    } finally {
      setLoadingSlots(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      locationId: selection.locationId, dentistId: selection.dentistId, serviceId: selection.serviceId, startsAt: selection.startsAt,
      patient: { name: form.get('name'), email: form.get('email'), phone: form.get('phone') },
      turnstileToken: turnstileToken || undefined
    };
    const fingerprint = JSON.stringify(payload);
    if (bookingAttempt.current?.fingerprint !== fingerprint) bookingAttempt.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const result = await apiRequest<{ data: { status: string } }>(`/api/v1/public/clinics/${clinicSlug}/appointments`, {
        method: 'POST', headers: { 'Idempotency-Key': bookingAttempt.current.key }, body: JSON.stringify(payload)
      });
      bookingAttempt.current = null;
      setMessage(result.data.status === 'PENDING' ? 'Your appointment request was received. The clinic will confirm it shortly.' : 'Your appointment is confirmed. Check your email for details.');
    } catch (error) { setTurnstileToken(''); window.turnstile?.reset(turnstileWidget.current); setMessage(error instanceof Error ? error.message : 'Unable to book this appointment.'); }
  }

  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-16"><a className="text-xl font-extrabold" href="/">DentivoHQ</a><Card className="mt-10"><CardHeader><CardTitle>Book a visit{config ? ` with ${config.clinic.name}` : ''}</CardTitle><CardDescription>Choose an available clinic service and time.</CardDescription></CardHeader><CardContent>
    {config ? <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      <SelectField label="Location" options={locations} value={selection.locationId} onChange={(value) => select('locationId', value)} /><SelectField disabled={!selection.locationId} label="Dentist" options={dentists} value={selection.dentistId} onChange={(value) => select('dentistId', value)} /><SelectField disabled={!selection.dentistId} label="Service" options={services} value={selection.serviceId} onChange={(value) => select('serviceId', value)} />
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Date<input className="h-10 rounded-lg border border-border px-3 font-normal" min={new Date().toISOString().slice(0, 10)} onChange={(event) => select('date', event.target.value)} type="date" value={selection.date} required /></label>
      <Button className="sm:col-span-2" disabled={loadingSlots} onClick={() => void findTimes()} type="button">{loadingSlots ? 'Finding times…' : 'Find available times'}</Button>
      <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">Available time<select className="h-10 rounded-lg border border-border bg-white px-3 font-normal" disabled={!slots.length} onChange={(event) => select('startsAt', event.target.value)} required value={selection.startsAt}><option value="">Choose an available time</option>{slots.map((slot) => <option key={slot.startsAt} value={slot.startsAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(slot.startsAt))}</option>)}</select></label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Name<input className="h-10 rounded-lg border border-border px-3 font-normal" name="name" required /></label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Email<input className="h-10 rounded-lg border border-border px-3 font-normal" name="email" type="email" required /></label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Phone<input className="h-10 rounded-lg border border-border px-3 font-normal" name="phone" required /></label>
      {environment.turnstileSiteKey ? <TurnstileWidget onToken={setTurnstileToken} widgetRef={turnstileWidget} /> : null}
      <Button className="sm:col-span-2" disabled={Boolean(environment.turnstileSiteKey && !turnstileToken)} type="submit">Request appointment</Button>
    </form> : null}
    {message ? <p className="mt-4 text-sm text-muted-foreground" role="status">{message}</p> : null}
  </CardContent></Card></main>;
}

function SelectField({ label, options, value, onChange, disabled = false }: { label: string; options: Option[]; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="flex flex-col gap-1.5 text-sm font-semibold">{label}<select className="h-10 rounded-lg border border-border bg-white px-3 font-normal disabled:opacity-50" disabled={disabled} onChange={(event) => onChange(event.target.value)} required value={value}><option value="">Choose {label.toLowerCase()}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name ?? option.display_name}</option>)}</select></label>;
}

function TurnstileWidget({ onToken, widgetRef }: { onToken: (token: string) => void; widgetRef: MutableRefObject<string | undefined> }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const render = () => {
      if (!cancelled && container.current && window.turnstile && environment.turnstileSiteKey && !widgetRef.current) widgetRef.current = window.turnstile.render(container.current, { sitekey: environment.turnstileSiteKey, callback: onToken, 'expired-callback': () => onToken('') });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-dentivohq-turnstile]');
    if (existing) { existing.addEventListener('load', render); render(); }
    else { const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.defer = true; script.dataset.dentivohqTurnstile = 'true'; script.addEventListener('load', render); document.head.appendChild(script); }
    return () => { cancelled = true; existing?.removeEventListener('load', render); };
  }, [onToken, widgetRef]);
  return <div className="sm:col-span-2" ref={container} />;
}

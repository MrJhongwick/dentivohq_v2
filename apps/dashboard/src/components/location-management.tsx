import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@dentivohq/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../lib/api';

type Location = { id: string; name: string; timezone: string; city?: string | null; active: boolean };

export function LocationManagement({ clinicId, onClose }: { clinicId: string; onClose: () => void }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [message, setMessage] = useState('');
  async function load() {
    const response = await apiRequest<{ data: Array<Record<string, unknown>> }>(`/api/v1/clinics/${clinicId}/locations`);
    setLocations(response.data.map((row) => ({ id: String(row.id), name: String(row.name), timezone: String(row.timezone), city: row.city ? String(row.city) : null, active: Boolean(row.active) })));
  }
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<{ data: Array<Record<string, unknown>> }>(`/api/v1/clinics/${clinicId}/locations`, { signal: controller.signal }).then((response) => setLocations(response.data.map((row) => ({ id: String(row.id), name: String(row.name), timezone: String(row.timezone), city: row.city ? String(row.city) : null, active: Boolean(row.active) })))).catch((error: Error) => { if (error.name !== 'AbortError') setMessage(error.message); });
    return () => controller.abort();
  }, [clinicId]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await apiRequest(`/api/v1/clinics/${clinicId}/locations`, { method: 'POST', body: JSON.stringify({ name: form.get('name'), timezone: form.get('timezone') }) });
    event.currentTarget.reset(); await load();
  }
  async function toggle(location: Location) { await apiRequest(`/api/v1/clinics/${clinicId}/locations/${location.id}`, { method: 'PATCH', body: JSON.stringify({ active: !location.active }) }); await load(); }
  async function rename(location: Location) {
    const name = window.prompt('Location name', location.name)?.trim();
    if (!name || name === location.name) return;
    await apiRequest(`/api/v1/clinics/${clinicId}/locations/${location.id}`, { method: 'PATCH', body: JSON.stringify({ name }) }); await load();
  }
  return <main className="mx-auto w-full max-w-5xl px-4 py-7">
    <div className="mb-5 flex items-center justify-between"><div><h1 className="text-2xl font-extrabold">Locations</h1><p className="text-sm text-muted-foreground">Manage timezone-aware clinic locations.</p></div><Button onClick={onClose} variant="outline">Back to dashboard</Button></div>
    <Card className="mb-5"><CardHeader><CardTitle>Add location</CardTitle></CardHeader><CardContent><form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => void create(event)}><Input aria-label="Location name" name="name" placeholder="Location name" required /><Input aria-label="Timezone" defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone} name="timezone" required /><Button type="submit">Add</Button></form></CardContent></Card>
    {message ? <p role="alert">{message}</p> : null}
    <div className="grid gap-3">{locations.map((location) => <Card key={location.id}><CardContent className="flex items-center justify-between gap-4 p-4"><div><strong>{location.name}</strong><p className="text-sm text-muted-foreground">{location.city ? `${location.city} · ` : ''}{location.timezone} · {location.active ? 'Active' : 'Archived'}</p></div><div className="flex gap-2"><Button onClick={() => void rename(location)} variant="outline">Edit</Button><Button onClick={() => void toggle(location)} variant="outline">{location.active ? 'Archive' : 'Reactivate'}</Button></div></CardContent></Card>)}</div>
  </main>;
}

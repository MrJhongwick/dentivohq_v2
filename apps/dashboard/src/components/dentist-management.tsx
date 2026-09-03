import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@dentivohq/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../lib/api';

type Option = { id: string; name: string };
type Dentist = { id: string; displayName: string; licenseNumber: string; active: boolean; locationIds: string[]; serviceIds: string[] };

export function DentistManagement({ clinicId, onClose }: { clinicId: string; onClose: () => void }) {
  const [dentists, setDentists] = useState<Dentist[]>([]); const [locations, setLocations] = useState<Option[]>([]); const [services, setServices] = useState<Option[]>([]); const [message, setMessage] = useState('');
  async function load() {
    const [dentistResponse, locationResponse, serviceResponse] = await Promise.all([
      apiRequest<{ data: Array<Record<string, unknown>> }>(`/api/v1/clinics/${clinicId}/dentists`), apiRequest<{ data: Array<Record<string, unknown>> }>(`/api/v1/clinics/${clinicId}/locations`), apiRequest<{ data: Array<Record<string, unknown>> }>(`/api/v1/clinics/${clinicId}/services`)
    ]);
    setDentists(dentistResponse.data.map((row) => ({ id: String(row.id), displayName: String(row.display_name), licenseNumber: String(row.license_number ?? ''), active: Boolean(row.active), locationIds: (row.location_ids as string[]) ?? [], serviceIds: (row.service_ids as string[]) ?? [] })));
    setLocations(locationResponse.data.filter((row) => row.active).map((row) => ({ id: String(row.id), name: String(row.name) })));
    setServices(serviceResponse.data.filter((row) => row.active).map((row) => ({ id: String(row.id), name: String(row.name) })));
  }
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      apiRequest<{ data: Array<Record<string, unknown>> }>(`/api/v1/clinics/${clinicId}/dentists`, { signal: controller.signal }), apiRequest<{ data: Array<Record<string, unknown>> }>(`/api/v1/clinics/${clinicId}/locations`, { signal: controller.signal }), apiRequest<{ data: Array<Record<string, unknown>> }>(`/api/v1/clinics/${clinicId}/services`, { signal: controller.signal })
    ]).then(([dentistResponse, locationResponse, serviceResponse]) => {
      setDentists(dentistResponse.data.map((row) => ({ id: String(row.id), displayName: String(row.display_name), licenseNumber: String(row.license_number ?? ''), active: Boolean(row.active), locationIds: (row.location_ids as string[]) ?? [], serviceIds: (row.service_ids as string[]) ?? [] })));
      setLocations(locationResponse.data.filter((row) => row.active).map((row) => ({ id: String(row.id), name: String(row.name) })));
      setServices(serviceResponse.data.filter((row) => row.active).map((row) => ({ id: String(row.id), name: String(row.name) })));
    }).catch((error: Error) => { if (error.name !== 'AbortError') setMessage(error.message); });
    return () => controller.abort();
  }, [clinicId]);
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await apiRequest(`/api/v1/clinics/${clinicId}/dentists`, { method: 'POST', body: JSON.stringify({ displayName: form.get('name'), licenseNumber: String(form.get('license') ?? '') || undefined }) }); event.currentTarget.reset(); await load(); }
  async function toggle(dentist: Dentist) { await apiRequest(`/api/v1/clinics/${clinicId}/dentists/${dentist.id}`, { method: 'PATCH', body: JSON.stringify({ active: !dentist.active }) }); await load(); }
  async function assign(event: FormEvent<HTMLFormElement>, dentist: Dentist) { event.preventDefault(); const form = new FormData(event.currentTarget); const locationId = String(form.get('locationId') ?? ''); const serviceId = String(form.get('serviceId') ?? ''); if (locationId) await apiRequest(`/api/v1/clinics/${clinicId}/dentist-locations`, { method: 'POST', body: JSON.stringify({ dentistId: dentist.id, locationId }) }); if (serviceId) await apiRequest(`/api/v1/clinics/${clinicId}/dentist-services`, { method: 'POST', body: JSON.stringify({ dentistId: dentist.id, serviceId }) }); await load(); }
  async function rename(dentist: Dentist) { const displayName = window.prompt('Dentist name', dentist.displayName)?.trim(); if (!displayName) return; await apiRequest(`/api/v1/clinics/${clinicId}/dentists/${dentist.id}`, { method: 'PATCH', body: JSON.stringify({ displayName }) }); await load(); }
  return <main className="mx-auto w-full max-w-5xl px-4 py-7"><div className="mb-5 flex items-center justify-between"><div><h1 className="text-2xl font-extrabold">Dentists</h1><p className="text-sm text-muted-foreground">Manage providers and their eligible locations and services.</p></div><Button onClick={onClose} variant="outline">Back to dashboard</Button></div>
    <Card className="mb-5"><CardHeader><CardTitle>Add dentist</CardTitle></CardHeader><CardContent><form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => void create(event)}><Input aria-label="Dentist name" name="name" placeholder="Dr. Alex Morgan" required /><Input aria-label="License number" name="license" placeholder="License number" /><Button type="submit">Add</Button></form></CardContent></Card>{message ? <p role="alert">{message}</p> : null}
    <div className="grid gap-3">{dentists.map((dentist) => <Card key={dentist.id}><CardContent className="grid gap-4 p-4"><div className="flex items-center justify-between gap-3"><div><strong>{dentist.displayName}</strong><p className="text-sm text-muted-foreground">{dentist.licenseNumber || 'No license recorded'} · {dentist.active ? 'Active' : 'Archived'}</p></div><div className="flex gap-2"><Button onClick={() => void rename(dentist)} variant="outline">Edit</Button><Button onClick={() => void toggle(dentist)} variant="outline">{dentist.active ? 'Archive' : 'Reactivate'}</Button></div></div><form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => void assign(event, dentist)}><select className="h-10 rounded-lg border border-border bg-background px-3" name="locationId"><option value="">Assign location…</option>{locations.filter((item) => !dentist.locationIds.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="h-10 rounded-lg border border-border bg-background px-3" name="serviceId"><option value="">Assign service…</option>{services.filter((item) => !dentist.serviceIds.includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Button type="submit">Assign</Button></form><p className="text-xs text-muted-foreground">{dentist.locationIds.length} location assignment(s) · {dentist.serviceIds.length} service assignment(s)</p></CardContent></Card>)}</div>
  </main>;
}

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@dentivohq/ui';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, type Appointment, type ClinicLocation } from '../lib/api';

type Dentist = { id: string; display_name: string };
type Service = { id: string; name: string };
type Patient = { id: string; display_name: string };
type ListResponse = { data: Appointment[]; meta: { total: number } };

const statuses = ['', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'];
const dateValue = (date: Date) => date.toISOString().slice(0, 10);

export function AppointmentWorkspace({ clinicId, onClose, onBook }: { clinicId: string; onClose: () => void; onBook: () => void }) {
  const [date, setDate] = useState(dateValue(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [locations, setLocations] = useState<ClinicLocation[]>([]);
  const [dentists, setDentists] = useState<Dentist[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filters, setFilters] = useState({ locationId: '', dentistId: '', serviceId: '', patientId: '', status: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      apiRequest<{ data: ClinicLocation[] }>(`/api/v1/clinics/${clinicId}/locations`, { signal: controller.signal }),
      apiRequest<{ data: Dentist[] }>(`/api/v1/clinics/${clinicId}/dentists`, { signal: controller.signal }),
      apiRequest<{ data: Service[] }>(`/api/v1/clinics/${clinicId}/services`, { signal: controller.signal }),
      apiRequest<{ data: Patient[] }>(`/api/v1/clinics/${clinicId}/patients?pageSize=100`, { signal: controller.signal })
    ]).then(([locationResult, dentistResult, serviceResult, patientResult]) => {
      setLocations(locationResult.data); setDentists(dentistResult.data); setServices(serviceResult.data); setPatients(patientResult.data);
    }).catch((error: unknown) => { if ((error as Error).name !== 'AbortError') setMessage(error instanceof Error ? error.message : 'Unable to load schedule filters.'); });
    return () => controller.abort();
  }, [clinicId]);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ date, pageSize: '100' });
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
    void apiRequest<ListResponse>(`/api/v1/clinics/${clinicId}/appointments?${query}`, { signal: controller.signal })
      .then((response) => { setAppointments(response.data); setMessage(''); })
      .catch((error: unknown) => { if ((error as Error).name !== 'AbortError') setMessage(error instanceof Error ? error.message : 'Unable to load appointments.'); });
    return () => controller.abort();
  }, [clinicId, date, filters]);

  const grouped = useMemo(() => appointments.reduce<Record<string, Appointment[]>>((result, appointment) => {
    const hour = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(appointment.startsAt));
    (result[hour] ??= []).push(appointment); return result;
  }, {}), [appointments]);
  const moveDate = (days: number) => { const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + days); setDate(dateValue(next)); };
  const setFilter = (name: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [name]: value }));

  return <main className="min-h-screen bg-background px-4 py-6 text-foreground lg:px-8">
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><Button onClick={onClose} size="sm" variant="ghost"><ArrowLeft />Dashboard</Button><h1 className="mt-3 text-2xl font-extrabold">Appointment calendar</h1><p className="text-sm text-muted-foreground">Navigate and filter the clinic’s live schedule.</p></div><Button onClick={onBook}>Book appointment</Button></div>
      <Card><CardHeader className="gap-4"><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><CalendarDays className="size-5" />Schedule</CardTitle><div className="flex items-center gap-2"><Button aria-label="Previous day" onClick={() => moveDate(-1)} size="sm" variant="outline"><ChevronLeft /></Button><Input aria-label="Schedule date" onChange={(event) => setDate(event.target.value)} type="date" value={date} /><Button aria-label="Next day" onClick={() => moveDate(1)} size="sm" variant="outline"><ChevronRight /></Button></div></div>
        <div className="grid gap-3 md:grid-cols-5">
          <Filter label="Location" onChange={(value) => setFilter('locationId', value)} options={locations.map((item) => [item.id, item.name])} value={filters.locationId} />
          <Filter label="Dentist" onChange={(value) => setFilter('dentistId', value)} options={dentists.map((item) => [item.id, item.display_name])} value={filters.dentistId} />
          <Filter label="Service" onChange={(value) => setFilter('serviceId', value)} options={services.map((item) => [item.id, item.name])} value={filters.serviceId} />
          <Filter label="Patient" onChange={(value) => setFilter('patientId', value)} options={patients.map((item) => [item.id, item.display_name])} value={filters.patientId} />
          <Filter label="Status" onChange={(value) => setFilter('status', value)} options={statuses.slice(1).map((item) => [item, item.replaceAll('_', ' ')])} value={filters.status} />
        </div>
      </CardHeader><CardContent>
        {message ? <p className="mb-3 text-sm text-red-700">{message}</p> : null}
        {!appointments.length ? <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">No appointments match this date and filter set.</div> : <div className="space-y-5">{Object.entries(grouped).map(([hour, items]) => <section className="grid gap-3 border-t pt-4 md:grid-cols-[100px_1fr]" key={hour}><strong className="text-sm">{hour}</strong><div className="grid gap-2">{items.map((appointment) => <article className="grid gap-2 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[1fr_auto]" key={appointment.id}><div><strong>{appointment.patientDisplayName}</strong><p className="mt-1 text-sm text-muted-foreground">{appointment.serviceName} · {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(appointment.startsAt))}–{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(appointment.endsAt))}</p></div><Badge>{appointment.status.replaceAll('_', ' ')}</Badge></article>)}</div></section>)}</div>}
      </CardContent></Card>
    </div>
  </main>;
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-xs font-semibold">{label}<select className="h-9 rounded-md border border-border bg-card px-2 text-sm font-normal" onChange={(event) => onChange(event.target.value)} value={value}><option value="">All</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
}

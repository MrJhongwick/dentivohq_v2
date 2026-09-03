import { Card, CardContent, Skeleton } from '@dentivohq/ui';
import { CalendarDays, CreditCard, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, type Clinic, type DashboardOverview } from '../lib/api';
import { ClinicSetupWizard } from './clinic-setup-wizard';
import { DashboardSidebar } from './dashboard/dashboard-sidebar';
import { DashboardTopbar } from './dashboard/dashboard-topbar';
import type { DashboardPreview, DashboardUser } from './dashboard/dashboard-types';
import { greetingName } from './dashboard/dashboard-types';
import { InventoryPanel, QuickActionsPanel, RecentBookingsPanel, RevenuePanel, TodayAppointmentsPanel, TreatmentMixPanel } from './dashboard/dashboard-panels';
import { MetricCard } from './dashboard/metric-card';
import { LocationManagement } from './location-management';
import { DentistManagement } from './dentist-management';
import { ServiceManagement } from './service-management';
import { ScheduleManagement } from './schedule-management';
import { PatientManagement } from './patient-management';

type Props = { user: DashboardUser; preview?: DashboardPreview };

export function DashboardApp({ user, preview }: Props) {
  const [clinics, setClinics] = useState<Clinic[]>(preview ? [preview.clinic] : []);
  const [currentClinicId, setCurrentClinicId] = useState(preview?.clinic.id ?? '');
  const [overview, setOverview] = useState<DashboardOverview | null>(preview?.overview ?? null);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [setupClinic, setSetupClinic] = useState<Clinic | undefined>();
  const [overviewRevision, setOverviewRevision] = useState(0);
  const [workspace, setWorkspace] = useState<'dashboard' | 'locations' | 'dentists' | 'services' | 'schedules' | 'patients'>('dashboard');

  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    void apiRequest<{ data: Clinic[] }>('/api/v1/clinics', { signal: controller.signal }).then((response) => {
      setClinics(response.data);
      setCurrentClinicId((current) => current || response.data[0]?.id || '');
      if (response.data.length === 0) setLoading(false);
    }).catch((caught: unknown) => {
      if ((caught as Error).name !== 'AbortError') {
        setError(caught instanceof Error ? caught.message : 'Unable to load clinic access.');
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [preview]);

  useEffect(() => {
    if (preview || !currentClinicId) return;
    const controller = new AbortController();
    void apiRequest<{ data: DashboardOverview }>(`/api/v1/clinics/${currentClinicId}/dashboard`, { signal: controller.signal }).then((response) => setOverview(response.data)).catch((caught: unknown) => {
      if ((caught as Error).name !== 'AbortError') setError(caught instanceof Error ? caught.message : 'Unable to load the dashboard.');
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [currentClinicId, overviewRevision, preview]);

  const clinic = clinics.find((item) => item.id === currentClinicId) ?? clinics[0];
  const normalizedQuery = query.trim().toLowerCase();
  const todayAppointments = useMemo(() => overview?.todayAppointments.filter((appointment) => !normalizedQuery || `${appointment.patientDisplayName} ${appointment.serviceName} ${appointment.status}`.toLowerCase().includes(normalizedQuery)) ?? [], [normalizedQuery, overview?.todayAppointments]);
  const recentBookings = useMemo(() => overview?.recentBookings.filter((appointment) => !normalizedQuery || `${appointment.patientDisplayName} ${appointment.serviceName}`.toLowerCase().includes(normalizedQuery)) ?? [], [normalizedQuery, overview?.recentBookings]);

  function handleAction(label: string) {
    if (label === 'Clinic Settings') { setWorkspace('locations'); return; }
    if (label === 'Treatments') { setWorkspace('dentists'); return; }
    if (label === 'Services') { setWorkspace('services'); return; }
    if (label === 'Schedules') { setWorkspace('schedules'); return; }
    if (label === 'Patients' || label === 'Add patient') { setWorkspace('patients'); return; }
    if (label === 'Book appointment' && clinic) {
      window.location.assign(`/book/${clinic.slug}`);
      return;
    }
    setNotice(`${label} is ready for its dedicated workflow in the next dashboard screen.`);
    window.setTimeout(() => setNotice(''), 4000);
  }

  function handleClinicChange(clinicId: string) {
    setLoading(true);
    setError('');
    setCurrentClinicId(clinicId);
  }

  if (!loading && (!clinic || setupClinic)) return <ClinicSetupWizard
    initialClinic={setupClinic}
    onClinicCreated={(createdClinic) => {
      setClinics((current) => [...current, createdClinic]);
      setCurrentClinicId(createdClinic.id);
      setSetupClinic(createdClinic);
    }}
    onComplete={() => {
      setSetupClinic(undefined);
      setOverview(null);
      setLoading(true);
      setOverviewRevision((current) => current + 1);
    }}
  />;

  if (!loading && clinic && !overview?.location && (clinic.role === 'CLINIC_OWNER' || clinic.role === 'CLINIC_ADMIN')) return <ClinicSetupWizard
    initialClinic={clinic}
    onClinicCreated={() => undefined}
    onComplete={() => {
      setOverview(null);
      setLoading(true);
      setOverviewRevision((current) => current + 1);
    }}
  />;

  const plan = String(overview?.subscription?.plan ?? 'FREE');
  if (clinic && workspace === 'locations') return <LocationManagement clinicId={clinic.id} onClose={() => setWorkspace('dashboard')} />;
  if (clinic && workspace === 'dentists') return <DentistManagement clinicId={clinic.id} onClose={() => setWorkspace('dashboard')} />;
  if (clinic && workspace === 'services') return <ServiceManagement clinicId={clinic.id} onClose={() => setWorkspace('dashboard')} />;
  if (clinic && workspace === 'schedules') return <ScheduleManagement clinicId={clinic.id} onClose={() => setWorkspace('dashboard')} />;
  if (clinic && workspace === 'patients') return <PatientManagement clinicId={clinic.id} onClose={() => setWorkspace('dashboard')} />;
  return <div className="dashboard-shell min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[238px_minmax(0,1fr)]">
    <DashboardSidebar clinics={clinics} currentClinicId={currentClinicId} currentPlan={plan} onClinicChange={handleClinicChange} onClose={() => setMobileNavigationOpen(false)} onNavigate={handleAction} open={mobileNavigationOpen} />
    <div className="min-w-0">
      <DashboardTopbar onAction={handleAction} onMenu={() => setMobileNavigationOpen(true)} onQueryChange={setQuery} query={query} user={user} />
      <main className="mx-auto w-full max-w-[1560px] px-4 py-5 lg:px-7 lg:py-7">
        <section className="mb-5 flex items-center justify-between gap-5"><div><h1 className="m-0 text-[23px] font-extrabold tracking-[-0.03em] lg:text-[27px]">Good morning, {greetingName(user.name)} 👋</h1><p className="mt-1 text-sm text-muted-foreground">Here’s what’s happening at {clinic?.name ?? 'your clinic'} today.</p></div><button className="hidden rounded-lg border border-border bg-card px-3 py-2 text-sm text-[#53627d] sm:flex sm:items-center sm:gap-2" type="button"><CalendarDays className="size-4" />{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())}</button></section>
        {notice ? <div className="mb-4 rounded-lg border border-primary/20 bg-secondary px-3 py-2 text-xs text-secondary-foreground" role="status">{notice}</div> : null}
        {error ? <Card className="mb-4"><CardContent className="p-4 text-sm text-red-700">{error}</CardContent></Card> : null}
        {loading ? <DashboardLoading /> : overview ? <>
          <section className="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={CalendarDays} secondary={[{ label: 'Completed', value: overview.metrics.completed }, { label: 'In Progress', value: overview.metrics.inProgress }]} title="Today’s Appointments" value={overview.metrics.todayScheduled} />
            <MetricCard detail="new clinic patients this month" icon={Users} title="New Patients (Month)" value={overview.metrics.newPatientsThisMonth} />
            <MetricCard available={false} detail="Billing not configured" icon={CreditCard} title="Production (Month)" value="—" />
            <MetricCard available={false} detail="Billing not configured" icon={CreditCard} title="Collections (Month)" value="—" />
          </section>
          <section className="dashboard-primary-grid grid gap-4"><TodayAppointmentsPanel appointments={todayAppointments} onAction={handleAction} /><RevenuePanel onAction={handleAction} /><TreatmentMixPanel onAction={handleAction} treatmentMix={overview.treatmentMix} /></section>
          <section className="dashboard-secondary-grid mt-4 grid gap-4"><RecentBookingsPanel appointments={recentBookings} onAction={handleAction} /><InventoryPanel onAction={handleAction} /><QuickActionsPanel bookingHref={`/book/${clinic?.slug ?? ''}`} onAction={handleAction} /></section>
        </> : null}
      </main>
    </div>
  </div>;
}

function DashboardLoading() {
  return <div className="flex flex-col gap-4"><section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton className="h-[152px]" key={index} />)}</section><section className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-[350px]" /><Skeleton className="h-[350px]" /><Skeleton className="h-[350px]" /></section></div>;
}

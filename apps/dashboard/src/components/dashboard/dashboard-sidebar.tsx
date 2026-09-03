import { Button, cn } from '@dentivohq/ui';
import { BarChart3, Boxes, CalendarDays, ChevronDown, ClipboardList, CreditCard, Home, Megaphone, PackageSearch, Settings, ShoppingCart, Stethoscope, Users, X } from 'lucide-react';
import type { Clinic } from '../../lib/api';

const mainNavigation = [
  { label: 'Dashboard', icon: Home }, { label: 'Calendar', icon: CalendarDays }, { label: 'Patients', icon: Users },
  { label: 'Appointments', icon: ClipboardList }, { label: 'Treatments', icon: Stethoscope }, { label: 'Services', icon: Stethoscope }, { label: 'Billing & Payments', icon: CreditCard }
];
const sections = [
  { title: 'Clinic operations', items: [{ label: 'Team', icon: Users }, { label: 'Referrals', icon: BarChart3 }, { label: 'Marketing', icon: Megaphone }, { label: 'Reports & Analytics', icon: BarChart3 }] },
  { title: 'Inventory', items: [{ label: 'Inventory', icon: Boxes }, { label: 'Suppliers', icon: PackageSearch }, { label: 'Purchase Orders', icon: ShoppingCart }] },
  { title: 'Settings', items: [{ label: 'Clinic Settings', icon: Settings }, { label: 'Integrations', icon: Stethoscope }] }
];

type Props = {
  clinics: Clinic[];
  currentClinicId: string;
  currentPlan: string;
  open: boolean;
  onClose: () => void;
  onClinicChange: (clinicId: string) => void;
  onNavigate: (label: string) => void;
};

export function DashboardSidebar({ clinics, currentClinicId, currentPlan, open, onClose, onClinicChange, onNavigate }: Props) {
  const clinic = clinics.find((item) => item.id === currentClinicId) ?? clinics[0];
  return <>
    {open ? <button aria-label="Close navigation" className="fixed inset-0 bg-slate-950/30 lg:hidden" onClick={onClose} type="button" /> : null}
    <aside className={cn('dashboard-sidebar fixed inset-y-0 left-0 flex w-[238px] flex-col border-r border-border bg-card px-4 pb-5 pt-5 transition-transform lg:visible lg:sticky lg:top-0 lg:translate-x-0', open ? 'visible translate-x-0' : 'invisible -translate-x-full')}>
      <div className="mb-5 flex items-center justify-between px-2">
        <a className="flex items-center gap-2.5 text-xl font-extrabold text-[#0c2146]" href="/"><span className="dentivo-mark" aria-hidden /><span>Dentivo<span className="text-primary">HQ</span></span></a>
        <Button aria-label="Close navigation" className="lg:hidden" onClick={onClose} size="sm" variant="ghost"><X /></Button>
      </div>
      <label className="mb-4 grid grid-cols-[32px_1fr_16px] items-center gap-2 rounded-xl border border-border px-3 py-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-secondary text-primary"><Stethoscope className="size-4" /></span>
        <span className="min-w-0"><span className="block truncate text-xs font-bold">{clinic?.name ?? 'Select clinic'}</span><span className="block truncate text-[10px] text-muted-foreground">{clinic?.role?.replaceAll('_', ' ') ?? 'Clinic workspace'}</span></span>
        <ChevronDown className="size-4 text-muted-foreground" />
        <select aria-label="Active clinic" className="absolute inset-x-4 top-[72px] h-[54px] cursor-pointer opacity-0" onChange={(event) => onClinicChange(event.target.value)} value={currentClinicId}>{clinics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </label>
      <nav aria-label="Main navigation" className="flex flex-col gap-1">{mainNavigation.map(({ label, icon: Icon }) => <button className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] text-[#263958] transition-colors hover:bg-muted', label === 'Dashboard' && 'bg-secondary font-bold text-primary')} key={label} onClick={() => { onNavigate(label); onClose(); }} type="button"><Icon className="size-[17px]" />{label}</button>)}</nav>
      {sections.map((section) => <div key={section.title}><p className="mb-2 mt-5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#91a0b8]">{section.title}</p><nav className="flex flex-col gap-1">{section.items.map(({ label, icon: Icon }) => <button className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-[#263958] transition-colors hover:bg-muted" key={label} onClick={() => { onNavigate(label); onClose(); }} type="button"><Icon className="size-[17px]" />{label}</button>)}</nav></div>)}
      <div className="flex-1" />
      <button className="mx-1 mt-5 rounded-xl border border-border p-3 text-left" onClick={() => onNavigate('Billing & Payments')} type="button"><strong className="block text-xs">◇ You’re on {currentPlan.toLowerCase().replace(/^./, (letter) => letter.toUpperCase())} Plan</strong><small className="mt-1 block text-[10px] text-muted-foreground">Manage your subscription</small></button>
    </aside>
  </>;
}

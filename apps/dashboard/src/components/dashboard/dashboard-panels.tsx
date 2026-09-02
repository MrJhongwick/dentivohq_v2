import { Button, Card, CardContent, CardHeader, CardTitle } from '@dentivohq/ui';
import { CalendarPlus, FileText, PackagePlus, ReceiptText, Send, UserPlus } from 'lucide-react';
import type { Appointment, DashboardOverview } from '../../lib/api';
import { BookingRows, TodayAppointmentRows } from './appointment-rows';
import { serviceColors } from './dashboard-types';

function PanelHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <CardHeader className="flex-row items-center justify-between gap-3 p-4 pb-1"><CardTitle className="text-sm">{title}</CardTitle>{action ? <button className="text-[11px] font-bold text-primary" onClick={onAction} type="button">{action}</button> : null}</CardHeader>;
}

export function TodayAppointmentsPanel({ appointments, onAction }: { appointments: Appointment[]; onAction: (label: string) => void }) {
  return <Card className="dashboard-panel"><PanelHeader action="View Calendar" onAction={() => onAction('Calendar')} title="Today’s Appointments" /><CardContent className="p-4 pt-2"><TodayAppointmentRows appointments={appointments} /><button className="mt-2 text-[11px] font-bold text-primary" onClick={() => onAction('Appointments')} type="button">View full schedule →</button></CardContent></Card>;
}

export function RevenuePanel({ onAction }: { onAction: (label: string) => void }) {
  return <Card className="dashboard-panel min-h-[350px]"><PanelHeader title="Revenue Overview" /><CardContent className="p-4 pt-2"><div className="flex items-start justify-between"><p className="text-xs text-muted-foreground">Total Revenue<strong className="mt-1 block text-2xl text-foreground">—</strong><span className="text-[10px]">Billing data is not configured</span></p><button className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-[#53627d]" onClick={() => onAction('Billing & Payments')} type="button">This Month</button></div><svg aria-label="Revenue chart unavailable" className="my-3 h-[170px] w-full" preserveAspectRatio="none" viewBox="0 0 360 170"><path d="M38 18H350M38 55H350M38 92H350M38 129H350M38 166H350" stroke="#e9edf3" /><path d="M38 142 L80 132 L120 137 L165 115 L215 122 L265 91 L310 99 L344 78" fill="none" stroke="#cbd5e1" strokeDasharray="6 6" strokeWidth="2" /><text fill="#8996ab" fontSize="9" x="130" y="70">Connect billing to populate revenue</text></svg><div className="grid grid-cols-3 gap-2">{['Production', 'Collections', 'Outstanding'].map((label, index) => <div className={index === 1 ? 'rounded-lg bg-[#eaf9f3] p-2.5' : index === 2 ? 'rounded-lg bg-[#fff6e8] p-2.5' : 'rounded-lg bg-secondary p-2.5'} key={label}><span className="block text-[9px] text-[#5d6c84]">{label}</span><b className="mt-1 block text-xs">—</b></div>)}</div></CardContent></Card>;
}

export function TreatmentMixPanel({ treatmentMix, onAction }: { treatmentMix: DashboardOverview['treatmentMix']; onAction: (label: string) => void }) {
  const gradient = treatmentMix.length ? `conic-gradient(${treatmentMix.map((item, index) => {
    const before = treatmentMix.slice(0, index).reduce((total, entry) => total + entry.percentage, 0);
    return `${serviceColors[index]} ${before}% ${before + item.percentage}%`;
  }).join(',')})` : '#eef2f7';
  const total = treatmentMix.reduce((sum, item) => sum + item.appointmentCount, 0);
  return <Card className="dashboard-panel"><PanelHeader title="Treatment Mix (This Month)" /><CardContent className="p-4 pt-2"><div className="grid min-h-[255px] items-center gap-4 sm:grid-cols-[160px_1fr]"><div className="relative mx-auto size-[156px] rounded-full" style={{ background: gradient }}><span className="absolute inset-[38px] grid place-items-center rounded-full bg-card text-center text-[10px] text-muted-foreground">Total<b className="block text-base text-foreground">{total}</b></span></div><div className="flex flex-col gap-3">{treatmentMix.length ? treatmentMix.map((item, index) => <div className="grid grid-cols-[8px_1fr_auto] items-center gap-2 text-[10px]" key={item.name}><span className="size-1.5 rounded-full" style={{ background: serviceColors[index] }} /><span>{item.name}<small className="block text-muted-foreground">{item.appointmentCount} appointments</small></span><b className="text-[11px]">{item.percentage}%</b></div>) : <p className="text-center text-xs text-muted-foreground">Treatment activity will appear after appointments are booked.</p>}</div></div><button className="text-[11px] font-bold text-primary" onClick={() => onAction('Reports & Analytics')} type="button">View full report →</button></CardContent></Card>;
}

export function RecentBookingsPanel({ appointments, onAction }: { appointments: Appointment[]; onAction: (label: string) => void }) {
  return <Card className="dashboard-panel"><PanelHeader action="View All" onAction={() => onAction('Appointments')} title="Recent Bookings" /><CardContent className="p-4 pt-2"><BookingRows appointments={appointments} /></CardContent></Card>;
}

export function InventoryPanel({ onAction }: { onAction: (label: string) => void }) {
  return <Card className="dashboard-panel"><PanelHeader action="View Inventory" onAction={() => onAction('Inventory')} title="Inventory Summary" /><CardContent className="flex min-h-[230px] flex-col items-center justify-center p-5 text-center"><span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground"><PackagePlus className="size-5" /></span><strong className="mt-3 text-sm">Inventory is not configured</strong><p className="mt-1 max-w-64 text-[11px] leading-5 text-muted-foreground">Inventory tracking is reserved for a later DentivoHQ phase.</p></CardContent></Card>;
}

const quickActions = [
  { label: 'Book Appointment', icon: CalendarPlus }, { label: 'Add Patient', icon: UserPlus }, { label: 'New Invoice', icon: ReceiptText },
  { label: 'Send Recall', icon: Send }, { label: 'Patient Forms', icon: FileText }, { label: 'Inventory Order', icon: PackagePlus }
];

export function QuickActionsPanel({ bookingHref, onAction }: { bookingHref: string; onAction: (label: string) => void }) {
  return <Card className="dashboard-panel"><PanelHeader title="Quick Actions" /><CardContent className="grid grid-cols-2 gap-2 p-4 pt-2 sm:grid-cols-3">{quickActions.map(({ label, icon: Icon }, index) => index === 0 ? <Button asChild className="h-[82px] flex-col rounded-xl border border-[#edf1f6] bg-[#f9fbfe] px-2 text-[10px] text-foreground shadow-none hover:bg-secondary" key={label} variant="outline"><a href={bookingHref}><span className="grid size-[30px] place-items-center rounded-lg bg-secondary text-primary"><Icon className="size-4" /></span>{label}</a></Button> : <Button className="h-[82px] flex-col rounded-xl border border-[#edf1f6] bg-[#f9fbfe] px-2 text-[10px] text-foreground shadow-none hover:bg-muted" key={label} onClick={() => onAction(label)} variant="outline"><span className="grid size-[30px] place-items-center rounded-lg bg-muted text-primary"><Icon className="size-4" /></span>{label}</Button>)}</CardContent></Card>;
}

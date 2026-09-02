import { Card, CardContent } from '@dentivohq/ui';
import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  detail?: string;
  secondary?: Array<{ label: string; value: number }>;
  available?: boolean;
};

export function MetricCard({ title, value, icon: Icon, detail, secondary, available = true }: Props) {
  return <Card className="min-h-[152px] rounded-[14px] shadow-[0_1px_2px_rgba(16,33,63,.03),0_8px_26px_rgba(16,33,63,.035)]"><CardContent className="p-4">
    <div className="flex items-start justify-between gap-3"><span className="text-xs font-bold">{title}</span><span className="grid size-[34px] place-items-center rounded-[10px] bg-secondary text-primary"><Icon className="size-4" /></span></div>
    <div className="mt-2 text-[28px] font-extrabold tracking-[-0.03em]">{value}</div>
    {secondary ? <div className="mt-4 flex gap-10">{secondary.map((item) => <span key={item.label}><b className="block text-sm">{item.value}</b><small className="text-[11px] text-muted-foreground">{item.label}</small></span>)}</div> : <><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p><svg aria-hidden className="mt-2 h-9 w-full" preserveAspectRatio="none" viewBox="0 0 220 36"><path d={available ? 'M0 27 L18 23 L36 25 L54 18 L72 20 L90 16 L108 21 L126 13 L144 18 L162 9 L180 12 L198 5 L220 8' : 'M0 25 L45 25 L90 25 L135 25 L180 25 L220 25'} fill="none" stroke={available ? '#246bfe' : '#cbd5e1'} strokeDasharray={available ? undefined : '5 5'} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg></>}
  </CardContent></Card>;
}

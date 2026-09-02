import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@dentivohq/ui';
import { useEffect, useState } from 'react';
import { getPlatformOverview } from '../lib/api';
import { authClient } from '../lib/auth-client';

type Overview = Awaited<ReturnType<typeof getPlatformOverview>>;

export function ConsoleApp() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; void getPlatformOverview().then((value) => { if (active) setOverview(value); }).catch((caught: Error) => { if (active) setError(caught.message); }); return () => { active = false; }; }, []);
  const metrics = overview ? [['Clinics', overview.clinics], ['Users', overview.users], ['Appointments today', overview.appointmentsToday]] as const : [];
  return <div className="min-h-screen bg-[#f4f6f5] text-[#1c2522]">
    <header className="flex h-20 items-center justify-between bg-[#171d1b] px-6 text-white lg:px-9"><div><span className="text-xs text-[#9faca7]">Internal operations</span><h1 className="mt-1 text-xl font-bold">DentivoHQ Console</h1></div><Button variant="outline" onClick={() => void authClient.signOut()}>Sign out</Button></header>
    <div className="lg:grid lg:min-h-[calc(100vh-80px)] lg:grid-cols-[210px_1fr]"><aside className="hidden bg-[#222a27] p-4 lg:block"><nav className="flex flex-col gap-1">{['Overview', 'Clinics', 'Subscriptions', 'Audit', 'System'].map((item, index) => <a className={`rounded-lg px-3 py-2.5 text-sm ${index === 0 ? 'bg-[#303b37] text-white' : 'text-[#aebbb6]'}`} href={`#${item.toLowerCase()}`} key={item}>{item}</a>)}</nav></aside>
      <main className="w-full max-w-6xl p-5 lg:p-8">
        {error ? <Card><CardContent className="pt-5 text-sm text-red-700">{error}</CardContent></Card> : null}
        <section className="grid gap-4 sm:grid-cols-3">{overview ? metrics.map(([label, value]) => <Card key={label}><CardContent className="pt-5"><span className="text-sm text-muted-foreground">{label}</span><strong className="mt-2 block text-3xl">{value}</strong></CardContent></Card>) : [1, 2, 3].map((key) => <Skeleton className="h-28" key={key} />)}</section>
        <Card className="mt-5"><CardHeader><CardTitle>Platform controls</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">This surface is server-restricted to PLATFORM_ADMIN accounts. Clinic operations remain in the clinic dashboard.</CardContent></Card>
      </main>
    </div>
  </div>;
}

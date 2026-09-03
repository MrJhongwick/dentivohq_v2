import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dentivohq/ui';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { AuthPanel } from './components/auth-panel';
import { DashboardApp } from './components/dashboard-app';
import { ClinicSetupWizard } from './components/clinic-setup-wizard';
import { InvitationAcceptance } from './components/invitation-acceptance';
import { dashboardPreview } from './components/dashboard/dashboard-preview-data';
import { PublicBooking } from './components/public-booking';
import { authClient } from './lib/auth-client';
import './styles.css';

export function App() {
  const bookingMatch = window.location.pathname.match(/^\/book\/([a-z0-9-]+)$/);
  const invitationRoute = window.location.pathname === '/accept-invitation';
  const session = authClient.useSession();
  const [connectionTimedOut, setConnectionTimedOut] = useState(false);
  useEffect(() => {
    if (!session.isPending) return;
    const timeout = window.setTimeout(() => setConnectionTimedOut(true), 5000);
    return () => window.clearTimeout(timeout);
  }, [session.isPending]);
  if (bookingMatch?.[1]) return <PublicBooking clinicSlug={bookingMatch[1]} />;
  if (import.meta.env.DEV && window.location.pathname === '/accept-invitation-preview') return <InvitationAcceptance authenticated token={'a'.repeat(64)} preview />;
  if (import.meta.env.DEV && window.location.pathname === '/dashboard-preview') return <DashboardApp preview={dashboardPreview} user={{ name: 'Dr. Alex Morgan', email: 'alex.morgan@example.test' }} />;
  if (import.meta.env.DEV && window.location.pathname === '/onboarding-preview') return <ClinicSetupWizard onClinicCreated={() => undefined} onComplete={() => { window.location.assign('/dashboard-preview'); }} />;
  if (session.isPending && !connectionTimedOut) return <main className="p-8 text-sm text-muted-foreground">Loading DentivoHQ…</main>;
  if (session.isPending || session.error) return <main className="mx-auto min-h-screen max-w-lg px-5 py-20"><Card><CardHeader><CardTitle>Unable to reach DentivoHQ</CardTitle><CardDescription>The API did not respond. Check the configured API URL and try again.</CardDescription></CardHeader><CardContent><button className="text-sm font-semibold text-primary" onClick={() => window.location.reload()} type="button">Retry connection</button></CardContent></Card></main>;
  if (invitationRoute) return <InvitationAcceptance authenticated={Boolean(session.data)} token={new URLSearchParams(window.location.search).get('token') ?? ''} />;
  return session.data ? <DashboardApp user={{ name: session.data.user.name, email: session.data.user.email }} /> : <AuthPanel />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dentivohq/ui';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { AccessPanel } from './components/access-panel';
import { ConsoleApp } from './components/console-app';
import { authClient } from './lib/auth-client';
import './styles.css';

export function App() {
  const session = authClient.useSession();
  const [connectionTimedOut, setConnectionTimedOut] = useState(false);
  useEffect(() => {
    if (!session.isPending) return;
    const timeout = window.setTimeout(() => setConnectionTimedOut(true), 5000);
    return () => window.clearTimeout(timeout);
  }, [session.isPending]);
  if (session.isPending && !connectionTimedOut) return <main className="p-8 text-sm text-muted-foreground">Loading DentivoHQ Console…</main>;
  if (session.isPending || session.error) return <main className="mx-auto min-h-screen max-w-lg px-5 py-20"><Card><CardHeader><CardTitle>Unable to reach DentivoHQ Console</CardTitle><CardDescription>The API did not respond. Check the configured API URL and try again.</CardDescription></CardHeader><CardContent><button className="text-sm font-semibold text-primary" onClick={() => window.location.reload()} type="button">Retry connection</button></CardContent></Card></main>;
  return session.data ? <ConsoleApp /> : <AccessPanel />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

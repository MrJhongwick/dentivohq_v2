import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dentivohq/ui';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { apiRequest, type Clinic } from '../lib/api';
import { AuthPanel } from './auth-panel';

type Props = { authenticated: boolean; token: string; preview?: boolean };

export function InvitationAcceptance({ authenticated, token, preview }: Props) {
  const [state, setState] = useState<'idle' | 'accepting' | 'accepted' | 'error'>('idle');
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [message, setMessage] = useState('');
  const acceptanceStarted = useRef(false);

  useEffect(() => {
    if (!authenticated || !token || acceptanceStarted.current) return;
    acceptanceStarted.current = true;
    setState('accepting');
    void apiRequest<{ data: { clinicId: string } }>('/api/v1/invitations/accept', {
      method: 'POST', body: JSON.stringify({ token })
    }).then(async (response) => {
      const clinics = await apiRequest<{ data: Clinic[] }>('/api/v1/clinics');
      setClinic(clinics.data.find((item) => item.id === response.data.clinicId) ?? null);
      setState('accepted');
    }).catch((caught: unknown) => {
      setMessage(caught instanceof Error ? caught.message : 'This invitation could not be accepted.');
      setState('error');
    });
  }, [authenticated, token]);

  if (!token) return <InvitationCard title="Invitation link is incomplete" message="Ask the clinic administrator to send a new invitation." />;
  if (!authenticated) return <AuthPanel description="Sign in with the invited email address to accept your clinic invitation." />;
  if (state === 'accepting' || state === 'idle') return <InvitationCard loading title="Accepting invitation" message="We’re securely adding you to the clinic…" />;
  if (state === 'error') return <InvitationCard title="Invitation unavailable" message={message} />;

  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-5">
    <Card className="w-full"><CardHeader><CheckCircle2 className="mb-2 size-9 text-primary" /><CardTitle>Invitation accepted</CardTitle><CardDescription>You now have access to {clinic?.name ?? 'the invited clinic'}.</CardDescription></CardHeader><CardContent><Button className="w-full" onClick={() => { window.location.assign(preview ? '/dashboard-preview' : '/'); }}>Continue to dashboard</Button></CardContent></Card>
  </main>;
}

function InvitationCard({ loading, message, title }: { loading?: boolean; message: string; title: string }) {
  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-5"><Card className="w-full"><CardHeader>{loading ? <LoaderCircle className="mb-2 size-8 animate-spin text-primary" /> : null}<CardTitle>{title}</CardTitle><CardDescription>{message}</CardDescription></CardHeader><CardContent><Button className="w-full" onClick={() => window.location.assign('/')} variant="outline">Return to DentivoHQ</Button></CardContent></Card></main>;
}

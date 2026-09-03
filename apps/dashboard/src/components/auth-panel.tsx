import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dentivohq/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../lib/api';
import { authClient } from '../lib/auth-client';

export function AuthPanel({ description = 'Secure access for clinic team members.' }: { description?: string }) {
  const [mode, setMode] = useState<'sign-in' | 'register' | 'forgot'>('sign-in');
  const [message, setMessage] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<{ data: { google: boolean } }>('/api/v1/auth/capabilities', { signal: controller.signal })
      .then((response) => setGoogleEnabled(response.data.google))
      .catch(() => setGoogleEnabled(false));
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
    if (mode === 'forgot') {
      const result = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` });
      setMessage(result.error?.message ?? 'If an account exists for that email, a reset link is on its way.');
      return;
    }
    const password = String(form.get('password'));
    const result = mode === 'sign-in'
      ? await authClient.signIn.email({ email, password })
      : await authClient.signUp.email({ email, password, name: String(form.get('name')), callbackURL: `${window.location.origin}/verify-email` });
    if (mode === 'register' && !result.error) setVerificationEmail(email);
    setMessage(result.error?.message ?? (mode === 'register' ? 'Check your email to verify your account.' : 'Signed in.'));
  }

  return <main className="mx-auto flex min-h-screen max-w-md items-center px-5">
    <Card className="w-full">
      <CardHeader><CardTitle>{mode === 'sign-in' ? 'Sign in to DentivoHQ' : mode === 'register' ? 'Create your DentivoHQ account' : 'Reset your password'}</CardTitle><CardDescription>{mode === 'forgot' ? 'Enter your email and we’ll send a secure reset link.' : description}</CardDescription></CardHeader>
      <CardContent>
        {googleEnabled ? <><Button className="mb-4 w-full" onClick={() => { void authClient.signIn.social({ provider: 'google', callbackURL: window.location.href }); }} type="button" variant="outline">Continue with Google</Button><div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" /></div></> : null}
        <form className="flex flex-col gap-4" onSubmit={submit}>
          {mode === 'register' ? <label className="flex flex-col gap-1.5 text-sm font-semibold">Name<input className="h-10 rounded-lg border border-border bg-background px-3 font-normal" name="name" required /></label> : null}
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Email<input className="h-10 rounded-lg border border-border bg-background px-3 font-normal" name="email" type="email" required /></label>
          {mode !== 'forgot' ? <label className="flex flex-col gap-1.5 text-sm font-semibold">Password<input className="h-10 rounded-lg border border-border bg-background px-3 font-normal" minLength={8} name="password" type="password" required /></label> : null}
          <Button type="submit">{mode === 'sign-in' ? 'Sign in' : mode === 'register' ? 'Register' : 'Send reset link'}</Button>
          {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
          {verificationEmail ? <Button onClick={() => { void authClient.sendVerificationEmail({ email: verificationEmail, callbackURL: `${window.location.origin}/verify-email` }).then((result) => setMessage(result.error?.message ?? 'A new verification email is on its way.')); }} type="button" variant="outline">Resend verification email</Button> : null}
        </form>
        {mode === 'sign-in' ? <Button className="mt-3 w-full" variant="ghost" onClick={() => setMode('forgot')}>Forgot password?</Button> : null}
        <Button className="mt-1 w-full" variant="ghost" onClick={() => setMode(mode === 'sign-in' ? 'register' : 'sign-in')}>{mode === 'sign-in' ? 'Create an account' : 'Return to sign in'}</Button>
      </CardContent>
    </Card>
  </main>;
}

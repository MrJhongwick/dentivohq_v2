import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@dentivohq/ui';
import { useState, type FormEvent, type ReactNode } from 'react';
import { authClient } from '../lib/auth-client';

export function ResetPasswordPanel({ token }: { token: string }) {
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) { setMessage('This password-reset link is missing or expired. Request a new one.'); return; }
    const password = String(new FormData(event.currentTarget).get('password'));
    const result = await authClient.resetPassword({ newPassword: password, token });
    if (result.error) setMessage(result.error.message ?? 'This password-reset link is invalid or expired.');
    else { setComplete(true); setMessage('Your password has been reset. You can now sign in.'); }
  }
  return <AuthCard title="Reset your password" description="Choose a new password for your DentivoHQ account."><form className="flex flex-col gap-4" onSubmit={submit}><label className="flex flex-col gap-1.5 text-sm font-semibold">New password<Input minLength={8} name="password" required type="password" /></label><Button disabled={complete} type="submit">Reset password</Button>{message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}<ReturnButton /></form></AuthCard>;
}

export function VerificationResultPanel({ error }: { error: string | null }) {
  const invalid = Boolean(error);
  return <AuthCard title={invalid ? 'Verification link unavailable' : 'Email verified'} description={invalid ? 'This verification link is invalid or expired. Sign in to request a new verification email.' : 'Your email is verified and your DentivoHQ account is ready.'}><ReturnButton /></AuthCard>;
}

export function SessionExpiredPanel() { return <AuthCard title="Your session expired" description="For your security, please sign in again to continue."><ReturnButton /></AuthCard>; }
function ReturnButton() { return <Button className="w-full" onClick={() => window.location.assign('/')} type="button" variant="outline">Return to sign in</Button>; }
function AuthCard({ children, description, title }: { children: ReactNode; description: string; title: string }) { return <main className="mx-auto flex min-h-screen max-w-md items-center px-5"><Card className="w-full"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card></main>; }

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dentivohq/ui';
import { useState, type FormEvent } from 'react';
import { authClient } from '../lib/auth-client';

export function AuthPanel({ description = 'Secure access for clinic team members.' }: { description?: string }) {
  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));
    const result = mode === 'sign-in'
      ? await authClient.signIn.email({ email, password })
      : await authClient.signUp.email({ email, password, name: String(form.get('name')) });
    setMessage(result.error?.message ?? (mode === 'register' ? 'Check your email to verify your account.' : 'Signed in.'));
  }

  return <main className="mx-auto flex min-h-screen max-w-md items-center px-5">
    <Card className="w-full">
      <CardHeader><CardTitle>{mode === 'sign-in' ? 'Sign in to DentivoHQ' : 'Create your DentivoHQ account'}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          {mode === 'register' ? <label className="flex flex-col gap-1.5 text-sm font-semibold">Name<input className="h-10 rounded-lg border border-border bg-background px-3 font-normal" name="name" required /></label> : null}
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Email<input className="h-10 rounded-lg border border-border bg-background px-3 font-normal" name="email" type="email" required /></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Password<input className="h-10 rounded-lg border border-border bg-background px-3 font-normal" minLength={8} name="password" type="password" required /></label>
          <Button type="submit">{mode === 'sign-in' ? 'Sign in' : 'Register'}</Button>
          {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
        </form>
        <Button className="mt-3 w-full" variant="ghost" onClick={() => setMode(mode === 'sign-in' ? 'register' : 'sign-in')}>{mode === 'sign-in' ? 'Create an account' : 'Use an existing account'}</Button>
      </CardContent>
    </Card>
  </main>;
}

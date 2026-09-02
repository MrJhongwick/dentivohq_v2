import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dentivohq/ui';
import { useState, type FormEvent } from 'react';
import { authClient } from '../lib/auth-client';

export function AccessPanel() {
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({ email: String(form.get('email')), password: String(form.get('password')) });
    if (result.error) setMessage(result.error.message ?? 'Sign in failed.');
  }
  return <main className="mx-auto flex min-h-screen max-w-md items-center px-5"><Card className="w-full"><CardHeader><CardTitle>DentivoHQ Console</CardTitle><CardDescription>Platform administrator access only.</CardDescription></CardHeader><CardContent><form className="flex flex-col gap-4" onSubmit={submit}><label className="flex flex-col gap-1.5 text-sm font-semibold">Email<input className="h-10 rounded-lg border border-border px-3 font-normal" name="email" type="email" required /></label><label className="flex flex-col gap-1.5 text-sm font-semibold">Password<input className="h-10 rounded-lg border border-border px-3 font-normal" name="password" type="password" required /></label><Button type="submit">Sign in</Button>{message ? <p className="text-sm text-red-700">{message}</p> : null}</form></CardContent></Card></main>;
}

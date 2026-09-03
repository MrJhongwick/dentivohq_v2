import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  cn
} from '@dentivohq/ui';
import { Building2, Check, ChevronRight, LoaderCircle, MapPin } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { apiRequest, type Clinic, type ClinicLocation } from '../lib/api';

type Props = {
  initialClinic?: Clinic;
  onClinicCreated: (clinic: Clinic) => void;
  onComplete: (location: ClinicLocation) => void;
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const suggestedTimezones = [
  'Asia/Manila',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Australia/Sydney'
];

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/g, '');
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function ClinicSetupWizard({ initialClinic, onClinicCreated, onComplete }: Props) {
  const [clinic, setClinic] = useState<Clinic | undefined>(initialClinic);
  const [clinicName, setClinicName] = useState(initialClinic?.name ?? '');
  const [slug, setSlug] = useState(initialClinic?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(Boolean(initialClinic));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function changeClinicName(value: string) {
    setClinicName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function createClinic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slugPattern.test(slug)) {
      setError('Use lowercase letters, numbers, and single hyphens for the clinic URL.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await apiRequest<{ data: Clinic }>('/api/v1/clinics', {
        method: 'POST',
        body: JSON.stringify({ name: clinicName, slug })
      });
      setClinic(response.data);
      onClinicCreated(response.data);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Unable to create your clinic.');
    } finally {
      setSubmitting(false);
    }
  }

  async function createLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clinic) return;
    setSubmitting(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => String(form.get(name) ?? '').trim() || undefined;
    try {
      const response = await apiRequest<{ data: ClinicLocation }>(`/api/v1/clinics/${clinic.id}/locations`, {
        method: 'POST',
        body: JSON.stringify({
          name: String(form.get('locationName')).trim(),
          timezone: String(form.get('timezone')).trim(),
          addressLine1: optional('addressLine1'),
          city: optional('city'),
          region: optional('region'),
          postalCode: optional('postalCode'),
          countryCode: optional('countryCode')
        })
      });
      onComplete(response.data);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Unable to create the clinic location.');
    } finally {
      setSubmitting(false);
    }
  }

  const locationStep = Boolean(clinic);
  return <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-14">
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3"><span aria-hidden className="dentivo-mark" /><div><p className="text-sm font-extrabold tracking-tight">DentivoHQ</p><p className="text-xs text-muted-foreground">Clinic setup</p></div></div>
        <p className="text-xs font-semibold text-muted-foreground">Step {locationStep ? 2 : 1} of 2</p>
      </header>

      <ol aria-label="Clinic setup progress" className="grid grid-cols-2 gap-3">
        <SetupStep complete={locationStep} current={!locationStep} icon={Building2} label="Clinic details" />
        <SetupStep complete={false} current={locationStep} icon={MapPin} label="First location" />
      </ol>

      {!clinic ? <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl tracking-tight">Create your clinic</CardTitle>
          <CardDescription>This becomes your secure DentivoHQ workspace. You can add more locations and team members later.</CardDescription>
        </CardHeader>
        <form onSubmit={createClinic}>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="clinic-name">Clinic name</FieldLabel>
                <Input autoComplete="organization" autoFocus id="clinic-name" maxLength={120} minLength={2} onChange={(event) => changeClinicName(event.target.value)} placeholder="Bright Smile Dental" required value={clinicName} />
              </Field>
              <Field data-invalid={Boolean(error && !slugPattern.test(slug))}>
                <FieldLabel htmlFor="clinic-slug">Booking page URL</FieldLabel>
                <div className="flex min-w-0 items-center rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-ring">
                  <span className="shrink-0 pl-3 text-sm text-muted-foreground">/book/</span>
                  <Input aria-invalid={Boolean(error && !slugPattern.test(slug))} className="min-w-0 border-0 pl-1 focus-visible:ring-0" id="clinic-slug" maxLength={80} onChange={(event) => { setSlugEdited(true); setSlug(slugify(event.target.value)); }} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="bright-smile-dental" required value={slug} />
                </div>
                <FieldDescription>You can share this address with patients after setup.</FieldDescription>
              </Field>
              {error ? <FieldError role="alert">{error}</FieldError> : null}
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button disabled={submitting} type="submit">{submitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}{submitting ? 'Creating clinic…' : 'Continue to location'}{submitting ? null : <ChevronRight data-icon="inline-end" />}</Button>
          </CardFooter>
        </form>
      </Card> : <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl tracking-tight">Add your first location</CardTitle>
          <CardDescription>{clinic.name} is ready. Add the location where appointments will take place so scheduling uses the correct local time.</CardDescription>
        </CardHeader>
        <form onSubmit={createLocation}>
          <CardContent>
            <FieldGroup>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="location-name">Location name</FieldLabel>
                  <Input autoFocus id="location-name" maxLength={120} minLength={2} name="locationName" placeholder="Main clinic" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
                  <Input defaultValue={browserTimezone()} id="timezone" list="timezone-options" maxLength={100} name="timezone" required />
                  <datalist id="timezone-options">{suggestedTimezones.map((timezone) => <option key={timezone} value={timezone} />)}</datalist>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="address-line-1">Street address <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
                <Input autoComplete="street-address" id="address-line-1" maxLength={200} name="addressLine1" placeholder="123 Main Street" />
              </Field>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="city">City <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Input autoComplete="address-level2" id="city" maxLength={100} name="city" /></Field>
                <Field><FieldLabel htmlFor="region">State / province <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Input autoComplete="address-level1" id="region" maxLength={100} name="region" /></Field>
                <Field><FieldLabel htmlFor="postal-code">Postal code <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Input autoComplete="postal-code" id="postal-code" maxLength={20} name="postalCode" /></Field>
                <Field><FieldLabel htmlFor="country-code">Country code <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Input autoComplete="country" id="country-code" maxLength={2} minLength={2} name="countryCode" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase(); }} placeholder="PH" /></Field>
              </div>
              {error ? <FieldError role="alert">{error}</FieldError> : null}
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button disabled={submitting} type="submit">{submitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}{submitting ? 'Saving location…' : 'Finish setup'}{submitting ? null : <Check data-icon="inline-end" />}</Button>
          </CardFooter>
        </form>
      </Card>}
      <p className="text-center text-xs leading-5 text-muted-foreground">Clinic data is isolated to your DentivoHQ workspace. Only authorized members can access it.</p>
    </div>
  </main>;
}

function SetupStep({ complete, current, icon: Icon, label }: { complete: boolean; current: boolean; icon: typeof Building2; label: string }) {
  return <li aria-current={current ? 'step' : undefined} className={cn('flex min-w-0 items-center gap-3 rounded-xl border bg-card px-3 py-3 text-sm', current ? 'border-primary' : 'border-border')}>
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', complete || current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{complete ? <Check /> : <Icon />}</span>
    <span className={cn('truncate font-semibold', current || complete ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
  </li>;
}

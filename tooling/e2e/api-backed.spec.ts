import { expect, test, type Page } from '@playwright/test';

const apiUrl = process.env.E2E_API_URL;
const dashboardUrl = process.env.E2E_DASHBOARD_URL;
const email = process.env.E2E_OWNER_EMAIL;
const password = process.env.E2E_OWNER_PASSWORD;
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const slug = `e2e-clinic-${suffix}`;

test('verified preview owner completes real clinic setup and receives a public booking', async ({ page }, testInfo) => {
  test.skip(!apiUrl || !dashboardUrl || !email || !password, 'Preview URLs and owner credentials are required for real API-backed E2E coverage.');
  test.skip(testInfo.project.name !== 'chromium', 'The API-backed journey runs once; viewport coverage is exercised separately.');

  await page.goto(dashboardUrl!);
  await page.getByLabel('Email').fill(email!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeHidden();

  const clinic = await api<{ data: { id: string } }>(page, '/api/v1/clinics', { method: 'POST', body: { name: 'Gate Four Dental', slug } });
  const clinicId = clinic.data.id;
  if (!clinicId) throw new Error('The preview clinic was not created.');
  const location = await api<{ data: { id: string } }>(page, `/api/v1/clinics/${clinicId}/locations`, { method: 'POST', body: { name: 'Main Clinic', timezone: 'UTC' } });
  const locationId = location.data.id;
  const dentist = await api<{ data: { id: string } }>(page, `/api/v1/clinics/${clinicId}/dentists`, { method: 'POST', body: { displayName: 'Dr Gate Four' } });
  const service = await api<{ data: { id: string } }>(page, `/api/v1/clinics/${clinicId}/services`, { method: 'POST', body: { name: 'Preview consultation', durationMinutes: 30 } });
  await api(page, `/api/v1/clinics/${clinicId}/dentist-locations`, { method: 'POST', body: { dentistId: dentist.data.id, locationId } });
  await api(page, `/api/v1/clinics/${clinicId}/dentist-services`, { method: 'POST', body: { dentistId: dentist.data.id, serviceId: service.data.id } });
  const appointmentDate = new Date();
  appointmentDate.setUTCDate(appointmentDate.getUTCDate() + 14);
  const date = appointmentDate.toISOString().slice(0, 10);
  await api(page, `/api/v1/clinics/${clinicId}/schedules`, { method: 'POST', body: { dentistId: dentist.data.id, locationId, dayOfWeek: appointmentDate.getUTCDay(), startsAtLocal: '09:00', endsAtLocal: '12:00', effectiveFrom: date, effectiveTo: date } });

  await page.goto(`${dashboardUrl}/book/${slug}`);
  await expect(page.getByRole('heading', { name: 'Book a visit with Gate Four Dental' })).toBeVisible();
  await page.getByLabel('Location').selectOption({ label: 'Main Clinic' });
  await page.getByLabel('Dentist').selectOption({ label: 'Dr Gate Four' });
  await page.getByLabel('Service').selectOption({ label: 'Preview consultation' });
  await page.getByLabel('Date').fill(date);
  await page.getByRole('button', { name: 'Find available times' }).click();
  await expect(page.getByRole('status')).toContainText('Choose one');
  await page.getByLabel('Available time').selectOption({ index: 1 });
  await page.getByLabel('Name').fill('Synthetic Patient');
  await page.getByLabel('Email').fill(`patient-${suffix}@example.test`);
  await page.getByLabel('Phone').fill('+15555550123');
  const requestAppointment = page.getByRole('button', { name: 'Request appointment' });
  await expect(requestAppointment).toBeEnabled();
  await requestAppointment.click();
  await expect(page.getByRole('status')).toContainText('appointment request was received');

  const appointments = await api<{ data: Array<{ status: string; patientDisplayName: string }> }>(page, `/api/v1/clinics/${clinicId}/appointments`);
  expect(appointments.data).toEqual([expect.objectContaining({ status: 'PENDING', patientDisplayName: 'Synthetic Patient' })]);
});

async function api<T = unknown>(page: Page, path: string, options?: { method?: string; body?: unknown }) {
  return page.evaluate(async ({ path: requestPath, options: requestOptions, baseUrl }) => {
    const response = await fetch(`${baseUrl}${requestPath}`, {
      method: requestOptions?.method ?? 'GET',
      credentials: 'include',
      headers: requestOptions?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: requestOptions?.body ? JSON.stringify(requestOptions.body) : undefined
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(payload));
    return payload;
  }, { path, options, baseUrl: apiUrl }) as Promise<T>;
}

import { expect, test } from '@playwright/test';

test('dashboard preview matches the operational shell and filters appointments', async ({ page }, testInfo) => {
  await page.goto('http://127.0.0.1:5173/dashboard-preview');
  await expect(page.getByRole('heading', { name: /Good morning, Dr\. Morgan/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Today’s Appointments' })).toBeVisible();

  if (!testInfo.project.name.startsWith('mobile')) {
    await expect(page.getByText('Bright Smile Dental').first()).toBeVisible();
    await page.getByRole('textbox', { name: 'Search dashboard' }).fill('Michael');
    await expect(page.getByText('Michael Chen')).toBeVisible();
    await expect(page.getByText('Emily Johnson')).toBeHidden();
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Add patient', exact: true })).toBeVisible();
  } else {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByText('Bright Smile Dental').first()).toBeVisible();
  }
});

test('verified user can create a clinic and proceed through initial location setup', async ({ page }) => {
  await page.route('**/api/v1/clinics', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 201,
      body: JSON.stringify({ data: { id: '18cb5f8f-251f-4e47-83fe-d881ba0f318f', name: 'Harbor Dental', slug: 'harbor-dental', role: 'CLINIC_OWNER' } })
    });
  });
  await page.route('**/api/v1/clinics/18cb5f8f-251f-4e47-83fe-d881ba0f318f/locations', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 201,
      body: JSON.stringify({ data: { id: 'f5559484-882a-469b-b738-58e1451e72bc', name: 'Main clinic', timezone: 'Asia/Manila' } })
    });
  });

  await page.goto('http://127.0.0.1:5173/onboarding-preview');
  await expect(page.getByRole('heading', { name: 'Create your clinic' })).toBeVisible();
  await page.getByLabel('Clinic name').fill('Harbor Dental');
  await expect(page.getByLabel('Booking page URL')).toHaveValue('harbor-dental');
  await page.getByRole('button', { name: 'Continue to location' }).click();

  await expect(page.getByRole('heading', { name: 'Add your first location' })).toBeVisible();
  await page.getByLabel('Location name').fill('Main clinic');
  await page.getByLabel('Timezone').fill('Asia/Manila');
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await expect(page).toHaveURL(/\/dashboard-preview$/);
});

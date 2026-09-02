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

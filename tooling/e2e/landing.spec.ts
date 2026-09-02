import { expect, test } from '@playwright/test';

test('landing page uses the DentivoHQ brand and configurable dashboard link', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/DentivoHQ/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Bookings, schedules');
  await expect(page.getByRole('link', { name: 'Open dashboard' })).toHaveAttribute('href', /5173/);
});

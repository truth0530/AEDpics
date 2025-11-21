import { test, expect } from '@playwright/test';

test('should render simple test page', async ({ page }) => {
    const response = await page.goto('http://localhost:3000/security-pledge');
    console.log('Status:', response?.status());
    console.log('Current URL:', page.url());
    console.log('Page Content:', await page.content());
    await expect(page.locator('div', { hasText: 'Test Page' })).toBeVisible();
});

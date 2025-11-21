import { test, expect } from '@playwright/test';

test.describe('Security Pledge Page', () => {
    test('should display pledge content, signature pad, and handle agreement logic', async ({ page }) => {
        // Navigate to the security pledge page
        await page.goto('http://localhost:3000/security-pledge');

        // Verify page title
        await expect(page.getByText('보안 서약서 및 개인정보 수집 동의', { exact: true })).toBeVisible();

        // Check for checkboxes
        const privacyCheckbox = page.locator('#privacy-agreement');
        const securityCheckbox = page.locator('#security-agreement');

        await expect(privacyCheckbox).toBeVisible();
        await expect(securityCheckbox).toBeVisible();

        // Check for signature canvas
        await expect(page.locator('canvas')).toBeVisible();

        // Button should be disabled initially
        const submitButton = page.getByRole('button', { name: '동의하고 점검 시작하기' });
        await expect(submitButton).toBeDisabled();

        // Check checkboxes
        await privacyCheckbox.click();
        await securityCheckbox.click();

        // Button should be enabled now (based on current logic which only checks checkboxes for button state)
        // Note: The signature validation happens on click, not on button enable state in the current code.
        await expect(submitButton).toBeEnabled();
    });
});

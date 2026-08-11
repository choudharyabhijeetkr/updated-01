/**
 * Bahrain Visa Application - E2E Test
 *
 * Refactored to use shared baseTest and captcha helper.
 */

import { test, expect, getUploadFile, captureScreenshot } from '../../utils/baseTest';
import { getArrivalDate, getPassportExpiryDate } from '../../utils/date';

test('Bahrain Visa Application', async ({ page, waitForCaptcha }) => {

    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // NAVIGATE
    // =====================================

    await page.goto('https://bahrain-visas.com/application/');
    try {
  await page.waitForLoadState('networkidle', { timeout: 5000 });
} catch {
  console.log('Network never went idle, continuing anyway');
}

    // Capture initial home page screenshot if enabled
    await captureScreenshot(page, 'home-page');


    // =====================================
    // GENERAL DETAILS
    // =====================================

    await page.getByRole('textbox', { name: 'Name *' })
        .fill('testing');

    await page.getByRole('textbox', { name: 'Email ID *' })
        .fill('dm443790@gmail.com');

    await page.getByRole('combobox', { name: 'Selected country' })
        .click();

    await page.getByRole('combobox', { name: 'Search' })
        .fill('ind');

    await page.getByRole('option', { name: 'India +' })
        .click();

    await page.getByRole('textbox', { name: 'Phone *' })
        .fill('9876543210');

    const arrival = getArrivalDate();

    await page.getByLabel('Arrival Year')
        .selectOption(arrival.year);

    await page.getByLabel('Arrival Month')
        .selectOption(arrival.month);

    await page.locator('#nationality_gen')
        .selectOption('45');


    // =====================================
    // CAPTCHA
    // =====================================

    const captcha = await captchaPromise;

    await page.getByRole('textbox', { name: 'Captcha' })
        .fill(captcha);


    // =====================================
    // REGISTER
    // =====================================

    await page.getByRole('button', { name: 'Register' })
        .click();

    await page.waitForLoadState('networkidle');

    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).waitFor();


    // =====================================
    // PASSPORT
    // =====================================

    await page.getByRole('textbox', {
        name: 'Name as per Passport',
        exact: true
    }).fill('testing');

    const expiry = getPassportExpiryDate();

    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);

    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);

    await page.locator('#pass_no_0')
        .fill('111');

    await page.locator('#occupation_0')
        .selectOption('MILITARY');

    await page.locator('#emp_designation_0')
        .fill('testing');

    await page.locator('#emp_address_0')
        .fill('testing');

    // Capture application form filled screenshot
    await captureScreenshot(page, 'application-form');

    // =====================================
    // PREVIEW
    // =====================================

    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();

    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Confirm & Submit' })
        .click();

    await page.waitForLoadState('networkidle');


    // =====================================
    // UPLOAD FILE
    // =====================================

    const uploadFile = getUploadFile();

    const uploadSections = [
        { idPrefix: 'passport_form_',          label: 'Passport document' },
        { idPrefix: 'travel_itinerary_form_',  label: 'Travel itinerary' },
        { idPrefix: 'hotel_booking_form_',     label: 'Hotel booking' },
        { idPrefix: 'funds_form_',             label: 'Proof of funds' },
    ];

    for (const section of uploadSections) {

        const sectionLocator = page.locator(
            `[id^="${section.idPrefix}"]`
        );

        await sectionLocator
            .locator('input[type="file"]')
            .setInputFiles(uploadFile);

        await expect(sectionLocator).toContainText(/Uploaded/i, { timeout: 30000 });

        console.log(`${section.label} uploaded`);
    }


    // =====================================
    // PAYMENT
    // =====================================

    await page.reload();

    await page.getByRole('button', { name: 'Save & Continue' })
        .click();

    await page.waitForLoadState('networkidle');

    await expect(
        page.getByRole('heading', {
            name: 'Pay Application Processing Fee'
        })
    ).toBeVisible({ timeout: 30000 });

    // Capture payment page screenshot
    await captureScreenshot(page, 'payment-page');

    console.log(
        `\n================ PAYMENT PAGE URL ================\n` +
        `${page.url()}\n` +
        `====================================================\n`
    );

});
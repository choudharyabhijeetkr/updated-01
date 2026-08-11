/**
 * Benin Visa Application - E2E Test
 *
 * Refactored to use shared baseTest and captcha helper.
 */

import { test, expect, getUploadFile } from '../../utils/baseTest';
import path from 'path';
import { getArrivalDate, getPassportExpiryDate } from '../../utils/date';

test('Benin Visa Application', async ({ page, waitForCaptcha }) => {

    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // NAVIGATE
    // =====================================

    await page.goto('https://benin-e-visa.com/application/');
    try {
  await page.waitForLoadState('networkidle', { timeout: 5000 });
} catch {
  console.log('Network never went idle, continuing anyway');
}



    // =====================================
    // GENERAL DETAILS
    // =====================================

    await page.getByRole('textbox', { name: 'name' })
        .fill('testing');

    await page.getByRole('textbox', { name: 'email' })
        .fill('dm443790@gmail.com');

    await page.getByRole('combobox', { name: 'Selected country' })
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('ind');
    await page.getByRole('option', { name: 'India +' })
        .click();

    await page.getByRole('textbox', { name: 'phone' })
        .fill('9876543210');

    const arrival = getArrivalDate();
    await page.getByLabel('Year')
        .selectOption(arrival.year);
    await page.getByLabel('Mon')
        .selectOption(arrival.month);
    await page.getByLabel('Day', { exact: true })
        .selectOption(arrival.day);

    await page.locator('#nationality_gen')
        .selectOption('41');


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

    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('testing');

    const expiry = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);

    await page.locator('#pass_no_0')
        .fill('111');

    await page.locator('#occupation_0')
        .selectOption('JOURNALIST');

    await page.locator('#address_0')
        .fill('testing');

    await page.locator('#appli_country_0')
        .selectOption('44');
    await page.locator('#depart_country_0')
        .selectOption('45');
    await page.locator('#purpose_of_visit_0')
        .selectOption('SUMMER CAMP');

    await page.locator('#return_ticket_0')
        .fill('testing');
    await page.locator('#accomodation_address_0')
        .fill('testing');
    await page.locator('#maintenance_means_0')
        .fill('testing');
    await page.locator('#destination_0')
        .fill('testing');


    // =====================================
    // UPLOAD FILE
    // =====================================

    const uploadFile = getUploadFile();
    const fileName = path.basename(uploadFile);

    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
        await fileInput.first().setInputFiles(uploadFile);
    } else {
        await page.getByRole('button', { name: 'Choose File' })
            .setInputFiles(uploadFile);
    }

    await expect(fileInput.first()).toHaveValue(new RegExp(fileName.replace('.', '\\.')));


    // =====================================
    // PREVIEW
    // =====================================

    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();

    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();


    // =====================================
    // PAYMENT
    // =====================================

    await expect(
        page.getByRole('heading', {
            name: 'Pay Application Processing Fee'
        })
    ).toBeVisible({ timeout: 30000 });

    console.log(
        `\n================ PAYMENT PAGE URL ================\n` +
        `${page.url()}\n` +
        `====================================================\n`
    );

});
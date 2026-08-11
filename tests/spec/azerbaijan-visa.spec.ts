/**
 * Azerbaijan Visa Application - E2E Test
 *
 * Refactored to use shared baseTest and captcha helper.
 */

import { test, expect, captureScreenshot } from '../../utils/baseTest';
import { getArrivalDate, getPassportExpiryDate } from '../../utils/date';
import path from 'path';

test('Azerbaijan Visa Application', async ({ page, waitForCaptcha, getUploadFile }) => {

    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // NAVIGATE (triggers captcha API call)
    // =====================================

    await page.goto('https://azerbaijan-visa.info/apply/');

    await captureScreenshot(page, 'home-page');


    // =====================================
    // GENERAL DETAILS
    // (Fill while captcha loads in background)
    // =====================================

    await page.getByRole('textbox', { name: 'name' })
        .fill('testing');

    await page.getByRole('textbox', { name: 'email' })
        .fill('dm443790@gmail.com');

    await page.getByRole('combobox', { name: 'Selected country' })
        .locator('div')
        .nth(1)
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

    await page.locator('#nationality_gen')
        .selectOption('61');


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

    // Wait for passport form
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

    await page.getByRole('textbox', {
        name: 'Surname as per Passport'
    }).fill('testing');

    const expiry = getPassportExpiryDate();

    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);

    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);

    await page.locator('#pass_no_0')
        .fill('111');

    await page.locator('#travel_document_0')
        .selectOption('Diplomatic passport');

    await page.locator('#occupation_0')
        .selectOption('MILITARY');

    await page.locator('#not_above_house_no_0')
        .fill('testing');


    // =====================================
    // UPLOAD FILE
    // =====================================

    const uploadFile = getUploadFile();

    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
        await fileInput.first().setInputFiles(uploadFile);
    } else {
        await page.getByRole('button', {
            name: 'Choose File'
        }).setInputFiles(uploadFile);
    }

    // Wait for upload success
    const fileName = path.basename(uploadFile);
    await expect(fileInput.first()).toHaveValue(new RegExp(fileName.replace('.', '\\.')));


    // =====================================
    // PREVIEW
    // =====================================

    await page.getByRole('button', {
        name: 'Submit & Preview'
    }).click();

    await expect(
        page.locator('#order_id_spn')
    ).toBeVisible();


    // =====================================
    // PAYMENT
    // =====================================

    await page.getByRole('button', {
        name: 'Confirm & Submit'
    }).click();

    await expect(
        page.getByRole('heading', {
            name: 'Pay Visa Processing Fee'
        })
    ).toBeVisible();

    await expect(
        page.getByRole('heading', {
            name: 'Application Detail'
        })
    ).toBeVisible();

    await captureScreenshot(page, 'payment-page');


    // =====================================
    // PAYMENT URL IS AUTO-CAPTURED
    // by baseTest.ts afterEach hook
    // (page.url() at this point = payment URL)
    // =====================================

    console.log(
        `\n================ PAYMENT PAGE URL ================\n${page.url()}\n====================================================\n`
    );

});
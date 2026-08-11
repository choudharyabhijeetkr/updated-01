/**
 * Brazil Visa Application - E2E Test
 *
 * Refactored to use shared baseTest and captcha helper.
 */

import { test, expect, getUploadFile } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDepartureDate,
    getDateOfBirth,
    getPassportIssueDate,
    getPassportExpiryDate
} from '../../utils/date';

test('Brazil Visa Application', async ({ page, waitForCaptcha }) => {

    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // NAVIGATE
    // =====================================

    await page.goto('https://brazil-evisa.info/apply-evisa/');
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

    await page.getByRole('textbox', { name: 'phone' })
        .fill('9876543210');

    await page.locator('#nationality_gen')
        .selectOption('28');

    const departure = getDepartureDate();
    await page.locator('#yr_departure')
        .selectOption(departure.year);
    await page.locator('#mon_departure')
        .selectOption(departure.month);

    const arrival = getArrivalDate();
    await page.locator('#yr_arrival')
        .selectOption(arrival.year);
    await page.locator('#mon_arrival')
        .selectOption(arrival.month);


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

    await page.locator('#pass_no_0')
        .fill('111');

    await page.locator('#city_of_birth_0')
        .fill('testing');

    const expiry = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);

    const dob = getDateOfBirth();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);

    const issue = getPassportIssueDate();
    await page.locator('#yr_pass_issue_0')
        .selectOption(issue.year);
    await page.locator('#mon_pass_issue_0')
        .selectOption(issue.month);

    await page.locator('#occupation_0')
        .selectOption('LAWYER');

    await page.locator('#city_0')
        .fill('testing');
    await page.locator('#not_above_house_no_0')
        .fill('testing');
    await page.locator('#address_0')
        .fill('testing');
    await page.locator('#postal_code_0')
        .fill('testing');
    await page.locator('#not_above_city_0')
        .fill('testing');
    await page.locator('#not_above_state_0')
        .fill('testing');

    await page.getByRole('textbox', { name: 'Air/Land/Sea' })
        .fill('testing');

    await page.locator('#father_name_0')
        .fill('testing');

    await page.locator('div')
        .filter({ hasText: /^Mother Name \* Edit$/ })
        .locator('div')
        .first()
        .click();
    await page.locator('#mother_name_0')
        .fill('testing');

    await page.locator('#accomodation_0')
        .click();
    await page.locator('#accomodation_0')
        .fill('testing');


    // =====================================
    // PREVIEW
    // =====================================

    await page.getByRole('button', { name: 'Next' })
        .click();

    await page.locator('#accomodation_address_0')
        .fill('testing');

    await page.getByRole('textbox', { name: 'DD-MM-YYYY' })
        .click();
    await page.getByRole('link', { name: '4' })
        .click();

    await page.locator('#accomodation_0')
        .click();
    await page.locator('#accomodation_0')
        .fill('testing');

    await page.locator('#accommodation_nationality_0')
        .selectOption('44');

    await page.locator('#ref_name_in_0')
        .fill('testing');
    await page.locator('#ref_add_in_0')
        .fill('testing');
    await page.locator('#ref_name_cn_0')
        .fill('testing');
    await page.locator('#ref_relationsip_in_0')
        .fill('testing');
    await page.locator('#your_contry_address_0')
        .fill('testing');
    await page.locator('#ref_phone_in_0')
        .fill('testing');

    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();

    await expect(page.locator('[id^="passport_form_"]'))
        .toBeVisible({ timeout: 15000 });


    // =====================================
    // UPLOAD FILE
    // =====================================

    const uploadFile = getUploadFile();

    await page.locator('[id^="passport_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await expect(page.getByText('Document has been uploaded!'))
        .toBeVisible();
    console.log('Passport document uploaded');

    await page.locator('[id^="photo_form_"] input[type="file"]')
        .setInputFiles(uploadFile);
    await expect(page.getByText('Document has been uploaded!'))
        .toBeVisible();
    console.log('Photo uploaded');

    await page.waitForLoadState('networkidle');


    // =====================================
    // PAYMENT
    // =====================================

    await page.getByRole('button', { name: 'Save & Continue' })
        .click();

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
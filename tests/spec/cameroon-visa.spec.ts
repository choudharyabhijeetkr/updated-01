import { test, expect, getUploadFile } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDateOfBirth,
    getPassportExpiryDate
} from '../../utils/date';

test('Cameroon Visa Application', async ({ page, waitForCaptcha }) => {

    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // NAVIGATE
    // =====================================

    await page.goto('https://cameroon-visa.info/application/');
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
        console.log('Network never went idle, continuing anyway');
    }


    // =====================================
    // GENERAL DETAILS
    // =====================================

    await page.locator('#name')
        .fill('testing');

    await page.locator('#email_id')
        .fill('dm443790@gmail.com');

    await page.getByRole('textbox', { name: 'Your Working Contact/WhatsApp' })
        .click();
    await page.getByRole('combobox', { name: 'Selected country' })
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('india');
    await page.getByRole('option', { name: 'India +' })
        .click();
    await page.getByRole('textbox', { name: 'Your Working Contact/WhatsApp' })
        .click();
    await page.getByRole('textbox', { name: 'Your Working Contact/WhatsApp' })
        .fill('9876543210');

    const arrival = getArrivalDate();
    await page.locator('#yr_arrival')
        .selectOption(arrival.year);
    await page.locator('#mon_arrival')
        .selectOption(arrival.month);
    await page.locator('#day_arrival')
        .selectOption(arrival.day);

    await page.locator('#nationality_gen')
        .selectOption('42');

    await page.locator('#chk')
        .click();


    // =====================================
    // CAPTCHA
    // =====================================

    const captcha = await captchaPromise;
    await page.locator('#chk')
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

    const dob = getDateOfBirth();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);

    const expiry = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);

    await page.locator('#pass_no_0')
        .fill('111');

    await page.locator('#occupation_0')
        .selectOption('CHARITY-SOCIAL WORKER');

    await page.locator('#not_above_house_no_0')
        .fill('testing');

    await page.locator('#purpose_of_visit_0')
        .selectOption('Mission');


    // =====================================
    // PREVIEW
    // =====================================

    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();

    await page.getByRole('button', { name: 'Confirm & Submit' })
        .click();


    // =====================================
    // UPLOAD FILE
    // =====================================

    const uploadFile = getUploadFile();

    const uploadSections = [
        'passport_form_',
        'round_ticket_form_',
        'vaccine_certificate_form_',
        'hotel_booking_form_',
        'funds_form_',
        'business_invitation_form_'
    ];

    for (const section of uploadSections) {
        await page.locator(`[id^="${section}"] input[type="file"]`)
            .setInputFiles(uploadFile);
        await expect(page.locator(`[id^="${section}"]`))
            .toContainText('✓ Uploaded');
    }


    // =====================================
    // PAYMENT
    // =====================================

    await page.getByRole('button', { name: 'Save & Continue' })
        .click();

    await expect(
        page.getByRole('heading', { name: 'Pay Application Processing Fee' })
    ).toBeVisible();

});
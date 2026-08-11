import { test, expect, getUploadFile } from '../../utils/baseTest';
import {
    getArrivalDate,
    getPassportExpiryDate
} from '../../utils/date';

test('Congo Visa Application', async ({ page, waitForCaptcha }) => {

    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // NAVIGATE
    // =====================================

    await page.goto('https://congo-evisa.com/apply-evisa/');
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
        .fill('IND');
    await page.getByRole('option', { name: 'India +' })
        .click();
    await page.getByRole('textbox', { name: 'Your Working Contact/WhatsApp' })
        .click();
    await page.getByRole('textbox', { name: 'Your Working Contact/WhatsApp' })
        .fill('9876543210');

    await page.locator('#nationality_gen')
        .selectOption('45');

    const arrival = getArrivalDate();
    await page.locator('#yr_arrival')
        .selectOption(arrival.year);
    await page.locator('#mon_arrival')
        .selectOption(arrival.month);
    await page.locator('#day_arrival')
        .selectOption(arrival.day);


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

    const expiry = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);

    await page.getByRole('textbox', { name: 'Surname as per Passport' })
        .fill('testing');

    await page.locator('#pass_no_0')
        .fill('111');

    await page.locator('#address_0')
        .fill('testing');

    await page.locator('#occupation_0')
        .selectOption('LABOUR');

    await page.locator('#purpose_of_visit_0')
        .selectOption('Tourist');

    await page.locator('#accomodation_address_0')
        .fill('testing');

    await page.locator('#accommodation_city_0')
        .selectOption('Married');

    await page.getByRole('combobox', { name: 'Selected country' })
        .click();
    await page.getByRole('combobox', { name: 'Search' })
        .fill('IND');
    await page.getByRole('option', { name: 'India +' })
        .click();

    await page.locator('#accommodation_phone_0')
        .fill('9876543210');

    await page.locator('#accommodation_email_0')
        .fill('testing@test.com');

    await page.locator('#accomodation_0')
        .fill('testing');

    await page.locator('#accommodation_state_0')
        .selectOption('Visa Resident');


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
        'photo_form_',
        'visit_confirming_form_',
        'passport_immigration_form_',
        'passport_immigration_countersigning_form_'
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
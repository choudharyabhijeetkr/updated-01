import { test, expect, getUploadFile } from '../../utils/baseTest';
import {
    getArrivalDate,
    getDepartureDate,
    getDateOfBirth,
    getPassportIssueDate,
    getPassportExpiryDate
} from '../../utils/date';

test('E-Visa Application', async ({ page, waitForCaptcha }) => {

    // =====================================
    // SET UP CAPTCHA LISTENER BEFORE NAV
    // =====================================

    const captchaPromise = waitForCaptcha(page);


    // =====================================
    // NAVIGATE
    // =====================================

    await page.goto('https://cambodia-evisa.info/apply-evisa/');
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
    await page.locator('#yr_arrival')
        .selectOption(arrival.year);
    await page.locator('#mon_arrival')
        .selectOption(arrival.month);
    await page.locator('#day_arrival')
        .selectOption(arrival.day);

    const departure = getDepartureDate();
    await page.locator('#yr_departure')
        .selectOption(departure.year);
    await page.locator('#mon_departure')
        .selectOption(departure.month);
    await page.locator('#day_departure')
        .selectOption(departure.day);

    await page.locator('#nationality_gen')
        .selectOption('38');


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

    const dob = getDateOfBirth();
    await page.locator('#yr_dob_0')
        .selectOption(dob.year);
    await page.locator('#mon_dob_0')
        .selectOption(dob.month);

    await page.locator('#gender_0')
        .selectOption('Other');

    const issue = getPassportIssueDate();
    await page.locator('#yr_pass_issue_0')
        .selectOption(issue.year);
    await page.locator('#mon_pass_issue_0')
        .selectOption(issue.month);
    await page.locator('#day_pass_issue_0')
        .selectOption(issue.day);

    const expiry = getPassportExpiryDate();
    await page.locator('#yr_pass_exp_0')
        .selectOption(expiry.year);
    await page.locator('#mon_pass_exp_0')
        .selectOption(expiry.month);
    await page.locator('#day_pass_exp_0')
        .selectOption(expiry.day);

    await page.locator('#pass_no_0')
        .fill('111');

    await page.locator('#address_0')
        .fill('testing');

    await page.locator('#state_0')
        .fill('testing');

    await page.locator('#occupation_0')
        .selectOption('MEDIA');

    await page.locator('#accomodation_address_0')
        .fill('testing');


    // =====================================
    // PREVIEW
    // =====================================

    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();
    await page.getByRole('button', { name: 'Submit & Preview' })
        .click();


    // =====================================
    // UPLOAD FILE
    // =====================================

    const uploadFile = getUploadFile();

    // Passport
    const passportInput = page.locator('[id^="passport_form_"] input[type="file"]');
    await passportInput.setInputFiles(uploadFile);
    await expect(page.locator('[id^="passport_result_"]').getByText('Document has been uploaded!')).toBeVisible();

    // Photo
    const photoInput = page.locator('[id^="photo_form_"] input[type="file"]');
    await photoInput.setInputFiles(uploadFile);
    await expect(page.locator('[id^="photo_result_"]').getByText('Document has been uploaded!')).toBeVisible();

    // Flight itinerary
    const flightInput = page.locator('[id^="flight_itinerary_form_"] input[type="file"]');
    await flightInput.setInputFiles(uploadFile);
    await expect(page.locator('[id^="flight_itinerary_result_"]').getByText('Document has been uploaded!')).toBeVisible();

    // Hotel booking
    const hotelInput = page.locator('[id^="hotel_booking_form_"] input[type="file"]');
    await hotelInput.setInputFiles(uploadFile);
    await expect(page.locator('[id^="hotel_booking_result_"]').getByText('Document has been uploaded!')).toBeVisible();


    // =====================================
    // PAYMENT
    // =====================================

    await page.getByRole('button', { name: 'Save & Continue' })
        .click({
            modifiers: ['ControlOrMeta']
        });

    await expect(
        page.getByRole('heading', { name: 'Pay Processing Fee' })
    ).toBeVisible();

});
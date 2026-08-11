/**
 * Date Utility
 *
 * Stateless helper methods.
 * Safe for parallel Playwright execution.
 */

export interface DateParts {
    day: string;
    month: string;
    year: string;
}

/**
 * Safe helper to add/subtract months without day-of-month rollover bugs
 * (e.g., Jan 31 + 1 month -> Feb 28/29 instead of Mar 3).
 */
function addMonths(baseDate: Date, months: number): Date {
    const result = new Date(baseDate.getTime());
    const targetDay = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + months);
    const maxDaysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(targetDay, maxDaysInMonth));
    return result;
}

/**
 * Returns a date after N months from today.
 */
export function getFutureDate(
    monthsAhead: number = 9
): DateParts {

    const date = addMonths(new Date(), monthsAhead);

    return {
        day: String(date.getDate()).padStart(2, '0'),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        year: String(date.getFullYear())
    };

}


/**
 * Arrival Date
 * Default = 9 months from today.
 */
export function getArrivalDate(): DateParts {

    return getFutureDate(9);

}


/**
 * Departure Date
 * Default = 30 days after arrival.
 */
export function getDepartureDate(
    gapDays: number = 30,
    arrivalMonths: number = 9
): DateParts {

    const date = addMonths(new Date(), arrivalMonths);

    date.setDate(date.getDate() + gapDays);

    return {
        day: String(date.getDate()).padStart(2, '0'),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        year: String(date.getFullYear())
    };

}


/**
 * Passport Expiry
 *
 * Must be beyond 9 months.
 *
 * Default = 5 years after today.
 */
export function getPassportExpiryDate(): DateParts {

    const date = new Date();

    date.setFullYear(date.getFullYear() + 5);

    return {
        day: String(date.getDate()).padStart(2, '0'),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        year: String(date.getFullYear())
    };

}


/**
 * Passport Issue Date
 *
 * Default = 6 months before today.
 */
export function getPassportIssueDate(): DateParts {

    const date = addMonths(new Date(), -6);

    return {
        day: String(date.getDate()).padStart(2, '0'),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        year: String(date.getFullYear())
    };

}


/**
 * Date of Birth
 *
 * Default = 25 years old.
 * (Always >=18 years)
 */
export function getDateOfBirth(
    age: number = 25
): DateParts {

    if (age < 18) {
        age = 18;
    }

    const date = new Date();

    date.setFullYear(date.getFullYear() - age);

    return {
        day: String(date.getDate()).padStart(2, '0'),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        year: String(date.getFullYear())
    };

}
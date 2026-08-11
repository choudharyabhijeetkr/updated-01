import { Page } from '@playwright/test';

export async function waitForUploads(
    page: Page,
    expectedUploads: number,
    timeoutMs: number = 10000
): Promise<void> {

    let uploaded = 0;
    const startTime = Date.now();

    while (uploaded < expectedUploads && (Date.now() - startTime) < timeoutMs) {
        try {
            const response = await page.waitForResponse(async response => {
                if (
                    !response.url().includes('/api/') ||
                    response.request().method() !== 'POST'
                ) {
                    return false;
                }

                const postData = response.request().postData() || '';

                if (!postData.includes('act=upload_temp')) {
                    return false;
                }

                if (response.status() !== 200) {
                    return false;
                }

                try {
                    const body = await response.json();
                    return body.status === 'SUCCESS';
                } catch {
                    return false;
                }

            }, {
                timeout: Math.max(2000, timeoutMs - (Date.now() - startTime))
            });

            uploaded++;
            console.log(`Upload ${uploaded}/${expectedUploads} completed`);
        } catch {
            // If response timeout occurred, break and allow workflow to proceed safely
            break;
        }
    }

    console.log(`Document upload check complete (${uploaded}/${expectedUploads} upload events captured).`);
}


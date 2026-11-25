import { test } from '@playwright/test';
import { validateDstBackOfficeSearch } from '../../../../../flows/smb/dstBackOfficeSearch';

test('SAM-24830 @dst @cl @base-store @backoffice @pilot - Order and product basic and advanced search', async ({ page }, testInfo) => {
  test.setTimeout(600000);
  await validateDstBackOfficeSearch(page, testInfo, { market: 'CL', id: 'SAM-24830' });
});

import { test } from '@playwright/test';
import { validateDstBackOfficeSearch } from '../../../../../flows/smb/dstBackOfficeSearch';

test('SAM-24920 @dst @co @base-store @backoffice @pilot - Order and product basic and advanced search', async ({ page }, testInfo) => {
  test.setTimeout(600000);
  await validateDstBackOfficeSearch(page, testInfo, { market: 'CO', id: 'SAM-24920' });
});

import { test, expect, request } from '@playwright/test';

const waitForHealthy = async (url: string, retries = 20, delayMs = 500) => {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url, { method: 'HEAD' });
      if (resp && (resp.ok || resp.status === 405 || resp.status === 400)) return true;
    } catch (e) {
      // ignore
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
};

test.describe('Payee validation BFFs', () => {
  test('mobile BFF validatePayee', async () => {
    const endpoint = 'http://localhost:4001/';
    const healthy = await waitForHealthy(endpoint);
    test.expect(healthy).toBeTruthy();

    const req = await request.newContext();
    const query = `query($input: ValidatePayeeInput!){ validatePayee(input: $input) { isValid matchLevel confidence suggestedName } }`;
    const post = await req.post(endpoint, {
      data: { query, variables: { input: { accountNumber: '12345678', accountName: 'Acme Corporation', bankCode: '010' } } }
    });
    test.expect(post.ok()).toBeTruthy();
    const body = await post.json();
    test.expect(body).toHaveProperty('data.validatePayee');
    test.expect(body.data.validatePayee).toHaveProperty('confidence');
  });

  test('web BFF validatePayee', async () => {
    const endpoint = 'http://localhost:4002/graphql';
    const healthy = await waitForHealthy(endpoint);
    test.expect(healthy).toBeTruthy();

    const req = await request.newContext();
    const query = `query($input: ValidatePayeeInput!){ validatePayee(input: $input) { isValid matchLevel confidence suggestedName validationId } }`;
    const post = await req.post(endpoint, {
      data: { query, variables: { input: { accountNumber: '11111111', accountName: 'Jon Doe', bankCode: '020' } } }
    });
    test.expect(post.ok()).toBeTruthy();
    const body = await post.json();
    test.expect(body).toHaveProperty('data.validatePayee');
  });
});

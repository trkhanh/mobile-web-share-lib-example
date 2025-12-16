import { createServices } from '../src/factories/service-factory';

async function run() {
  // factory will pick gateway based on USE_WIREMOCK env or defaults to MockGateway
  const { paymentService } = createServices();

  console.log('Creating payment (valid)');
  const r = await paymentService.createPayment({ amount: 100, currency: 'USD', fromAccount: '1111', toAccount: '2222' } as any);
  console.log('Result:', r);
  if (!r.success) {
    console.error('Test failed: expected success for valid payment');
    process.exitCode = 2;
    return;
  }

  console.log('Creating payment (invalid amount)');
  const r2 = await paymentService.createPayment({ amount: 0, currency: 'USD', fromAccount: '1111', toAccount: '2222' } as any);
  console.log('Result:', r2);
  if (r2.success) {
    console.error('Test failed: expected failure for invalid amount');
    process.exitCode = 2;
    return;
  }

  console.log('Payment tests passed');
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

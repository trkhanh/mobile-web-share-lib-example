import { createPayeeService } from '../src/services/payee-service';

const mockDataSource = {
  fetchRegisteredName: async (accountNumber: string, bankCode: string) => {
    // Simple mocked lookup
    if (accountNumber === '12345678' && bankCode === '010') return 'Acme Corp';
    if (accountNumber === '11111111') return 'John Doe';
    return 'Unknown Account Holder';
  }
};

const logger = {
  info: (msg: string, meta?: any) => console.log('[logger] INFO', msg, meta),
  error: (msg: string, err?: any) => console.error('[logger] ERROR', msg, err)
};

async function main() {
  const service = createPayeeService({ dataSource: mockDataSource, logger });

  const inputs = [
    { accountNumber: '12345678', accountName: 'Acme Corporation', bankCode: '010' },
    { accountNumber: '11111111', accountName: 'Jon Doe', bankCode: '020' },
    { accountNumber: 'abc', accountName: 'Nope', bankCode: '020' }
  ];

  for (const input of inputs) {
    try {
      const result = await service.validatePayee(input as any);
      console.log('Input:', input, '\nResult:', result, '\n');
    } catch (err) {
      console.error('Validation failed for', input, err);
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});

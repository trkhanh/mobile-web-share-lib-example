import { calculateNameSimilarity, validatePayeeName, validateAccountNumberFormat } from '../src/helpers/payee-helpers';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('Test failed:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
}

// calculateNameSimilarity
const sim1 = calculateNameSimilarity('Acme Corp', 'Acme Corporation');
console.log('sim1', sim1);
assert(sim1 > 0.5, 'similarity should be > 0.5');

// validatePayeeName
const res = validatePayeeName('Jon Doe', 'John Doe');
console.log('validatePayeeName', res);
assert(res.confidence > 0.5, 'expected some similarity');

// validateAccountNumberFormat
assert(validateAccountNumberFormat('12345678', '020') === true, 'valid numeric account');
assert(validateAccountNumberFormat('abcdef', '020') === false, 'non-numeric should fail');

console.log('All tests passed.');

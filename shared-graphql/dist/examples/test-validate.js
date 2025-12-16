"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const payee_helpers_1 = require("../src/helpers/payee-helpers");
function assert(cond, msg) {
    if (!cond) {
        console.error('Test failed:', msg);
        process.exitCode = 1;
        throw new Error(msg);
    }
}
// calculateNameSimilarity
const sim1 = (0, payee_helpers_1.calculateNameSimilarity)('Acme Corp', 'Acme Corporation');
console.log('sim1', sim1);
assert(sim1 > 0.5, 'similarity should be > 0.5');
// validatePayeeName
const res = (0, payee_helpers_1.validatePayeeName)('Jon Doe', 'John Doe');
console.log('validatePayeeName', res);
assert(res.confidence > 0.5, 'expected some similarity');
// validateAccountNumberFormat
assert((0, payee_helpers_1.validateAccountNumberFormat)('12345678', '020') === true, 'valid numeric account');
assert((0, payee_helpers_1.validateAccountNumberFormat)('abcdef', '020') === false, 'non-numeric should fail');
console.log('All tests passed.');

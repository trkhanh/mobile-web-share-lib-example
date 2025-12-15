"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPayeeService = exports.PayeeService = void 0;
const payee_resolvers_1 = require("../resolvers/payee-resolvers");
class PayeeService {
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async validatePayee(input) {
        try {
            const isAccountValid = (0, payee_resolvers_1.validateAccountNumberFormat)(input.accountNumber, input.bankCode);
            if (!isAccountValid) {
                return {
                    isValid: false,
                    matchLevel: 'NO_MATCH',
                    confidence: 0,
                    suggestedName: undefined
                };
            }
            const registeredName = await this.dependencies.dataSource.fetchRegisteredName(input.accountNumber, input.bankCode);
            const validationResult = (0, payee_resolvers_1.validatePayeeName)(input.accountName, registeredName);
            this.dependencies.logger?.info('Payee validation completed', {
                accountNumber: input.accountNumber,
                result: validationResult
            });
            return validationResult;
        }
        catch (error) {
            this.dependencies.logger?.error('Payee validation failed', error);
            throw error;
        }
    }
    async getPayee(id) {
        return { id, name: 'John Doe', accountNumber: '00000000', bankCode: '000' };
    }
}
exports.PayeeService = PayeeService;
const createPayeeService = (dependencies) => {
    return new PayeeService(dependencies);
};
exports.createPayeeService = createPayeeService;

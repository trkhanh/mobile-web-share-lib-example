import { PayeeServiceDependencies, ValidatePayeeInput, ValidatePayeeResult } from '../types/payee';
export declare class PayeeService {
    private dependencies;
    constructor(dependencies: PayeeServiceDependencies);
    validatePayee(input: ValidatePayeeInput): Promise<ValidatePayeeResult>;
    getPayee(id: string): Promise<{
        id: string;
        name: string;
        accountNumber: string;
        bankCode: string;
    }>;
}
export declare const createPayeeService: (dependencies: PayeeServiceDependencies) => PayeeService;

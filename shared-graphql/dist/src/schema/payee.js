"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payeeTypeDefs = void 0;
exports.payeeTypeDefs = `
type Payee {
  id: ID!
  name: String!
  accountNumber: String!
  bankCode: String!
  accountType: AccountType!
}

enum AccountType {
  CHECKING
  SAVINGS
}

type ValidatePayeeResult {
  isValid: Boolean!
  matchLevel: MatchLevel!
  confidence: Float!
  suggestedName: String
}

enum MatchLevel {
  EXACT
  CLOSE
  NO_MATCH
}

input ValidatePayeeInput {
  accountNumber: String!
  accountName: String!
  bankCode: String!
}

type Query {
  validatePayee(input: ValidatePayeeInput!): ValidatePayeeResult!
  getPayee(id: ID!): Payee
}

type Mutation {
  _empty: String
}
`;

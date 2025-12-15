export const paymentTypeDefs = `
input CreatePaymentInput {
  amount: Float!
  currency: String!
  fromAccount: String!
  toAccount: String!
}

type CreatePaymentResult {
  success: Boolean!
  paymentId: ID
  reason: String
}

extend type Mutation {
  createPayment(input: CreatePaymentInput!): CreatePaymentResult!
}
`;

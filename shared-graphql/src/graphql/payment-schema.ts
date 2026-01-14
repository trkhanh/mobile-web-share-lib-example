import gql from 'graphql-tag';

export const paymentTypeDefs = gql`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key", "@shareable"])

  type Payment @key(fields: "id") {
    id: ID!
    amount: Float!
    currency: String!
    fromAccount: String!
    toAccount: String!
    status: String!
    createdAt: String!
    userId: ID!
    user: User
  }

  # Extend User from user-subgraph to add payments field
  extend type User @key(fields: "id") {
    id: ID! @external
    payments: [Payment!]!
  }

  input CreatePaymentInput {
    amount: Float!
    currency: String!
    fromAccount: String!
    toAccount: String!
    userId: ID!
  }

  type CreatePaymentResult {
    success: Boolean!
    paymentId: ID
    reason: String
  }

  type Query {
    payment(id: ID!): Payment
    payments: [Payment!]!
    paymentsByUser(userId: ID!): [Payment!]!
  }

  type Mutation {
    createPayment(input: CreatePaymentInput!): CreatePaymentResult!
  }
`;


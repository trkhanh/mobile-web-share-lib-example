import gql from 'graphql-tag';

export const userTypeDefs = gql`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key", "@shareable"])

  type User @key(fields: "id") {
    id: ID!
    email: String!
    name: String!
    createdAt: String!
  }

  type Query {
    user(id: ID!): User
    users: [User!]!
    me: User
  }
`;

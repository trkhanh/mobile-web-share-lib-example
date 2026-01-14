import fetch from 'node-fetch';

// ============================================================================
// Phase 2 SuperGraph Client Demo
// ============================================================================

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000/graphql';

interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
}

async function queryGateway<T = any>(query: string, variables?: any): Promise<T> {
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'user-1'
    },
    body: JSON.stringify({ query, variables })
  });

  const result: GraphQLResponse<T> = await response.json();
  
  if (result.errors) {
    console.error('❌ GraphQL Errors:', JSON.stringify(result.errors, null, 2));
    throw new Error(result.errors[0].message);
  }

  return result.data!;
}

async function demoPhase2() {
  console.log('\n🌐 Phase 2 SuperGraph Demo');
  console.log('================================\n');

  try {
    // Demo 1: Cross-subgraph query - User with Payments
    console.log('📊 Demo 1: Cross-Subgraph Query (User + Payments)');
    console.log('Query spans User subgraph AND Payment subgraph\n');

    const userWithPayments = await queryGateway(`
      query GetUserWithPayments {
        user(id: "user-1") {
          id
          name
          email
          payments {
            id
            amount
            currency
            status
          }
        }
      }
    `);

    console.log('Result:', JSON.stringify(userWithPayments, null, 2));
    console.log('✅ Gateway automatically composed data from both subgraphs!\n');

    // Demo 2: Create payment and query it back
    console.log('📊 Demo 2: Create Payment via Gateway');
    
    const createResult = await queryGateway(`
      mutation CreatePayment($input: CreatePaymentInput!) {
        createPayment(input: $input) {
          success
          paymentId
          reason
        }
      }
    `, {
      input: {
        amount: 100.50,
        currency: 'USD',
        fromAccount: 'acc-123',
        toAccount: 'acc-456',
        userId: 'user-1'
      }
    });

    console.log('Create Result:', JSON.stringify(createResult, null, 2));

    if (createResult.createPayment.success) {
      const paymentId = createResult.createPayment.paymentId;
      
      // Query the payment with user info
      console.log('\n📊 Demo 3: Query Payment with User (Cross-Subgraph)');
      const paymentWithUser = await queryGateway(`
        query GetPaymentWithUser($id: ID!) {
          payment(id: $id) {
            id
            amount
            currency
            status
            user {
              id
              name
              email
            }
          }
        }
      `, { id: paymentId });

      console.log('Result:', JSON.stringify(paymentWithUser, null, 2));
      console.log('✅ Payment subgraph resolved User reference automatically!\n');
    }

    // Demo 4: List all users
    console.log('📊 Demo 4: List Users from User Subgraph');
    const allUsers = await queryGateway(`
      query GetAllUsers {
        users {
          id
          name
          email
        }
      }
    `);

    console.log('Result:', JSON.stringify(allUsers, null, 2));
    console.log('✅ User subgraph responding through gateway!\n');

    console.log('\n🎉 Phase 2 SuperGraph Demo Complete!');
    console.log('Key Features Demonstrated:');
    console.log('  ✅ Single Gateway endpoint for all queries');
    console.log('  ✅ Cross-subgraph queries (User + Payments)');
    console.log('  ✅ Entity references resolved automatically');
    console.log('  ✅ Gateway handles query planning & composition');

  } catch (error: any) {
    console.error('\n❌ Demo failed:', error.message);
    console.error('Make sure gateway and subgraphs are running:');
    console.error('  - Gateway: http://localhost:4000');
    console.error('  - Payment Subgraph: http://localhost:4001');
    console.error('  - User Subgraph: http://localhost:4002');
    process.exit(1);
  }
}

// Run demo
demoPhase2();

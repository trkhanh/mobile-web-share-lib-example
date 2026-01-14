import { UserService } from './user-service';

export const createUserResolvers = (userService: UserService) => {
  return {
    User: {
      // Federation entity resolver
      __resolveReference: async (reference: { id: string }) => {
        return await userService.getUser(reference.id);
      }
    },

    Query: {
      user: async (_: any, { id }: { id: string }) => {
        return await userService.getUser(id);
      },

      users: async () => {
        return await userService.listUsers();
      },

      me: async (_: any, __: any, context: any) => {
        // Get user from context (passed from gateway)
        const userId = context.userId || context.headers?.['x-user-id'] || 'user-1';
        return await userService.getUser(userId);
      }
    }
  };
};

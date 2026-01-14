export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export class UserService {
  private users: Map<string, User>;

  constructor() {
    // Mock user data
    this.users = new Map([
      ['user-1', {
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice Johnson',
        createdAt: '2024-01-01T00:00:00Z'
      }],
      ['user-2', {
        id: 'user-2',
        email: 'bob@example.com',
        name: 'Bob Smith',
        createdAt: '2024-01-02T00:00:00Z'
      }],
      ['mobile-user-123', {
        id: 'mobile-user-123',
        email: 'mobile@example.com',
        name: 'Mobile Demo User',
        createdAt: '2024-01-03T00:00:00Z'
      }],
      ['web-user-admin', {
        id: 'web-user-admin',
        email: 'admin@example.com',
        name: 'Web Admin User',
        createdAt: '2024-01-04T00:00:00Z'
      }]
    ]);
  }

  async getUser(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    return ids.map(id => this.users.get(id)).filter(u => u !== undefined) as User[];
  }
}

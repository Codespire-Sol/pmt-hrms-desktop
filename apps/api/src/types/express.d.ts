declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roleId: string;
        branchId?: string | null;
        roleName?: string | null;
        role?: {
          id: string;
          name: string;
          displayName: string;
        };
      };
    }
  }
}

export {};

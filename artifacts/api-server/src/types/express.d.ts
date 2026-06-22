import type { Profile } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireAuth` / `requireProfile`. */
      clerkId?: string;
      /** Set by `requireProfile`. */
      profile?: Profile;
      /** Set by `attachStaffSession` (username/password admin login). */
      staffUser?: {
        id: number;
        username: string;
        staffRole: string;
        displayName: string;
      };
    }
  }
}

export {};

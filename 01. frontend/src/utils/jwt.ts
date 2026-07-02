export type UserRole = 'ADMIN' | 'CUSTOMER';

export interface JwtUserClaims {
  username: string;
  role: UserRole;
  ownerName: string | null;
}

export function parseJwtClaims(token: string): JwtUserClaims | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;

    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(normalized)) as {
      username?: string;
      role?: UserRole;
      ownerName?: string | null;
    };

    if (!json.username || !json.role) return null;

    return {
      username: json.username,
      role: json.role,
      ownerName: json.ownerName ?? null,
    };
  } catch {
    return null;
  }
}

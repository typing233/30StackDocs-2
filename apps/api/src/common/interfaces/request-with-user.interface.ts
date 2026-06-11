import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  roles: string[];
}

export interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
    tenantId: string;
    roles: string[];
  };
}

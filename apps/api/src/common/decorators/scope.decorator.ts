import { SetMetadata } from '@nestjs/common';
import { API_TOKEN_SCOPE_KEY } from '../guards/api-token.guard';

export const RequireScope = (scope: string) => SetMetadata(API_TOKEN_SCOPE_KEY, scope);

import { SetMetadata } from '@nestjs/common';

export type BackofficeRole = 'SUPER_ADMIN' | 'ADMIN' | 'OWNER' | 'VIEWER';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: BackofficeRole[]) => SetMetadata(ROLES_KEY, roles);

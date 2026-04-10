import { SetMetadata } from '@nestjs/common';

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);

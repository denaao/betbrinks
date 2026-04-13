import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, BackofficeRole } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // If endpoint is @Public(), skip role check
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // If no @Roles() decorator, allow access (only JWT required)
    const requiredRoles = this.reflector.getAllAndOverride<BackofficeRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // Extract user from request (set by JwtStrategy.validate())
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Acesso negado: usuário não autenticado.');
    }

    // Check if user's role matches any of the required roles
    const userRole = (user.role || '').toUpperCase();

    const hasRole = requiredRoles.some((role) => {
      // SUPER_ADMIN has access to everything
      if (userRole === 'SUPER_ADMIN') return true;
      // ADMIN has access to ADMIN and OWNER endpoints
      if (userRole === 'ADMIN' && (role === 'ADMIN' || role === 'OWNER')) return true;
      // Exact match
      return userRole === role;
    });

    if (!hasRole) {
      throw new ForbiddenException(
        `Acesso negado: papel '${user.role || 'USER'}' não tem permissão para este recurso. Requer: ${requiredRoles.join(', ')}.`,
      );
    }

    return true;
  }
}

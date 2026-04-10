import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findById(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        isVerified: true,
        level: true,
        xp: true,
        createdAt: true,
        lastLoginAt: true,
        balance: { select: { points: true, diamonds: true } },
      },
    });

    if (!user) throw new NotFoundException('Usuario nao encontrado.');

    return {
      ...user,
      points: user.balance?.points ?? 0,
      diamonds: user.balance?.diamonds ?? 0,
      balance: undefined,
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario nao encontrado.');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        isVerified: true,
        level: true,
        xp: true,
      },
    });

    return updated;
  }
}

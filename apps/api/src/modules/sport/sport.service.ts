import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SportService {
  constructor(private prisma: PrismaService) {}

  // ─── Public: Get active sports (for mobile app) ──────────────────────

  async getActiveSports() {
    return this.prisma.sport.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, icon: true },
    });
  }

  // ─── Admin: Get all sports ───────────────────────────────────────────

  async getAllSports() {
    return this.prisma.sport.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { leagues: true } } },
    });
  }

  // ─── Admin: Create sport ─────────────────────────────────────────────

  async createSport(name: string, icon?: string, key?: string) {
    const existing = await this.prisma.sport.findUnique({ where: { name } });
    if (existing) throw new BadRequestException('Modalidade já existe');

    // Auto-generate key from name if not provided
    const sportKey = key || name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');

    // Auto-increment sort order
    const last = await this.prisma.sport.findFirst({ orderBy: { sortOrder: 'desc' } });
    const sortOrder = (last?.sortOrder || 0) + 1;

    return this.prisma.sport.create({
      data: { name, key: sportKey, icon, sortOrder },
    });
  }

  // ─── Admin: Update sport ─────────────────────────────────────────────

  async updateSport(id: number, data: { name?: string; icon?: string; sortOrder?: number }) {
    const sport = await this.prisma.sport.findUnique({ where: { id } });
    if (!sport) throw new BadRequestException('Modalidade não encontrada');

    return this.prisma.sport.update({
      where: { id },
      data,
    });
  }

  // ─── Admin: Toggle active ───────────────────────────────────────────

  async toggleSport(id: number) {
    const sport = await this.prisma.sport.findUnique({ where: { id } });
    if (!sport) throw new BadRequestException('Modalidade não encontrada');

    return this.prisma.sport.update({
      where: { id },
      data: { isActive: !sport.isActive },
    });
  }

  // ─── Admin: Delete sport ─────────────────────────────────────────────

  async deleteSport(id: number) {
    // Unlink leagues first
    await this.prisma.activeLeague.updateMany({
      where: { sportId: id },
      data: { sportId: null },
    });

    return this.prisma.sport.delete({ where: { id } });
  }
}

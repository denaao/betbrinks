import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ConvertDiamondsToLeagueDto {
  @ApiProperty({ example: 1, description: 'Liga ID' })
  @IsInt()
  @Min(1, { message: 'Liga invalida.' })
  leagueId: number;

  @ApiProperty({ example: 100, description: 'Quantidade de diamantes para converter' })
  @IsInt()
  @Min(1, { message: 'Minimo de 1 diamante para conversao.' })
  diamonds: number;
}

import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBetDto {
  @ApiProperty({ example: 1, description: 'Fixture ID' })
  @IsInt()
  fixtureId: number;

  @ApiProperty({ example: 1, description: 'Odd ID to bet on' })
  @IsInt()
  oddId: number;

  @ApiProperty({ example: 100, description: 'Points to wager (min 10, max 10000)' })
  @IsInt()
  @Min(10, { message: 'Aposta minima: 10 pontos' })
  @Max(10000, { message: 'Aposta maxima: 10.000 pontos' })
  amount: number;

  @ApiProperty({ example: 1, description: 'League ID (optional, defaults to Liga Oficial)' })
  @IsInt()
  @IsOptional()
  leagueId?: number;
}

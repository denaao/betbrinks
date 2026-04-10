import { IsInt, IsArray, ValidateNested, Min, Max, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BetSlipSelection {
  @ApiProperty({ example: 1, description: 'Fixture ID' })
  @IsInt()
  fixtureId: number;

  @ApiProperty({ example: 1, description: 'Odd ID to bet on' })
  @IsInt()
  oddId: number;
}

export class CreateBetSlipDto {
  @ApiProperty({
    type: [BetSlipSelection],
    description: 'Array of selections (1 to 20)',
    example: [
      { fixtureId: 1, oddId: 1 },
      { fixtureId: 2, oddId: 5 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Bilhete precisa de pelo menos 1 selecao.' })
  @ArrayMaxSize(20, { message: 'Maximo de 20 selecoes por bilhete.' })
  @ValidateNested({ each: true })
  @Type(() => BetSlipSelection)
  selections: BetSlipSelection[];

  @ApiProperty({ example: 100, description: 'Total points to wager on the slip (min 10, max 10000)' })
  @IsInt()
  @Min(10, { message: 'Aposta minima: 10 pontos' })
  @Max(10000, { message: 'Aposta maxima: 10.000 pontos' })
  amount: number;
}

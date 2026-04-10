import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class JoinLeagueDto {
  @ApiProperty({ example: 'ABC123', description: 'Código de convite (6 caracteres)' })
  @IsString()
  @Length(6, 6, { message: 'Código de convite deve ter 6 caracteres' })
  inviteCode: string;
}

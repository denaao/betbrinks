import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BackofficeLoginDto {
  @ApiProperty({ example: '12345678900', description: 'CPF (apenas dígitos ou formatado)' })
  @IsString()
  @MinLength(11)
  cpf: string;

  @ApiProperty({ example: 'senha123' })
  @IsString()
  @MinLength(6)
  password: string;
}

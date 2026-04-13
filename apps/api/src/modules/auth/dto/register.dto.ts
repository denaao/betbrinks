import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Joao Silva' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Nome deve ter no minimo 2 caracteres' })
  @MaxLength(100, { message: 'Nome deve ter no maximo 100 caracteres' })
  name: string;

@ApiProperty({ example: 'jogador@email.com', required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Email invalido' })
  email?: string;

  @ApiProperty({ example: '12345678901' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/, { message: 'CPF deve estar no formato 12345678901 ou 123.456.789-01' })
  cpf: string;

  @ApiProperty({ example: '+5511999999999' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+55\d{10,11}$/, { message: 'Telefone deve estar no formato +55XXXXXXXXXXX' })
  phone: string;

  @ApiProperty({ example: 'Senha@123', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { mes
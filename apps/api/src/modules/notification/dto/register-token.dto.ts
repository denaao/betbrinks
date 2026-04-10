import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterTokenDto {
  @ApiProperty({ example: 'fMp7...:APA91b...', description: 'FCM device token' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'android', description: 'Device platform' })
  @IsString()
  @IsIn(['android', 'ios'])
  platform: string;
}

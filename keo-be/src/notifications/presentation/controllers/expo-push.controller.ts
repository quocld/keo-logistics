import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayloadType } from '../../../auth/strategies/types/jwt-payload.type';
import { RegisterExpoPushDeviceDto } from '../dto/register-expo-push-device.dto';
import { ExpoPushTokenService } from '../services/expo-push-token.service';

@ApiBearerAuth()
@ApiTags('Expo Push Notifications')
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'notifications',
  version: '1',
})
export class ExpoPushController {
  constructor(private readonly expoPushTokenService: ExpoPushTokenService) {}

  @Post('expo/register')
  @HttpCode(HttpStatus.OK)
  register(
    @Request() request: { user: JwtPayloadType },
    @Body() dto: RegisterExpoPushDeviceDto,
  ) {
    return this.expoPushTokenService.registerToken(request.user, dto);
  }
}

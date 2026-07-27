import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CreateUserDto } from './dtos/create-user.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //create a new user
  @Post('register')
  async createUser(@Body() body: CreateUserDto) {
    return this.authService.createUser(body);
  }
}

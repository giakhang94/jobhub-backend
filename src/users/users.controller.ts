import { Body, Controller } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dtos/create-user.dto.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  //get all users
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  //create a new user
  async createUser(@Body() body: CreateUserDto) {
    return this.usersService.createUser(body);
  }
}

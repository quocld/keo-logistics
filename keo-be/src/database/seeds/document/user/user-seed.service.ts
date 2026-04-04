import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { RoleEnum } from '../../../../roles/roles.enum';
import { StatusEnum } from '../../../../statuses/statuses.enum';
import { UserSchemaClass } from '../../../../users/infrastructure/persistence/document/entities/user.schema';

@Injectable()
export class UserSeedService {
  constructor(
    @InjectModel(UserSchemaClass.name)
    private readonly model: Model<UserSchemaClass>,
  ) {}

  async run() {
    const admin = await this.model.findOne({
      email: 'admin@example.com',
    });

    if (!admin) {
      const salt = await bcrypt.genSalt();
      const password = await bcrypt.hash('secret', salt);

      const data = new this.model({
        email: 'admin@example.com',
        password: password,
        firstName: 'Super',
        lastName: 'Admin',
        role: {
          _id: RoleEnum.admin.toString(),
        },
        status: {
          _id: StatusEnum.active.toString(),
        },
      });
      await data.save();
    }

    const owner = await this.model.findOne({
      email: 'john.doe@example.com',
    });

    if (!owner) {
      const salt = await bcrypt.genSalt();
      const password = await bcrypt.hash('secret', salt);

      const data = new this.model({
        email: 'john.doe@example.com',
        password: password,
        firstName: 'John',
        lastName: 'Doe',
        role: {
          _id: RoleEnum.owner.toString(),
        },
        status: {
          _id: StatusEnum.active.toString(),
        },
      });

      await data.save();
    }

    const driver = await this.model.findOne({
      email: 'driver@example.com',
    });

    if (!driver) {
      const salt = await bcrypt.genSalt();
      const password = await bcrypt.hash('secret', salt);

      const data = new this.model({
        email: 'driver@example.com',
        password: password,
        firstName: 'Demo',
        lastName: 'Driver',
        role: {
          _id: RoleEnum.driver.toString(),
        },
        status: {
          _id: StatusEnum.active.toString(),
        },
      });

      await data.save();
    }
  }
}

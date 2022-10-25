import { DataSourceOptions, DataSource } from 'typeorm';
import { Game } from './entities/Game.entity';
import { User } from './entities/User.entity';

const cfg = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_POST as string, 10),
  database: 'postgres',
  username: 'postgres',
  password: 'postgres',
  logging: true,
  entities: [User, Game],
  synchronize: true,
} as DataSourceOptions;

export default new DataSource(cfg);

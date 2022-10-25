import { ObjectType, Field } from 'type-graphql';
import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  BaseEntity,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
// eslint-disable-next-line import/no-cycle
import { Game } from './Game.entity';

@ObjectType()
@Entity()
export class User {
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  @Field()
  @Column({ unique: true })
  username!: string;

  @Column()
  password!: string;

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Game, (game) => game.user)
  games: Game[];

  @OneToOne(() => Game)
  @JoinColumn()
  currentGame: Game;
}

export type UserEntity = User & BaseEntity;

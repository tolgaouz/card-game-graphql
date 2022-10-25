import * as argon2 from 'argon2';
import { MinLength, IsAlphanumeric, IsLowercase, Matches, IsString } from 'class-validator';
import omit from 'lodash/omit';
import parse from 'parse-duration';
import { Arg, Ctx, Mutation, Resolver, Query, ObjectType, Field, InputType } from 'type-graphql';
import { MoreThanOrEqual } from 'typeorm';
import { SESSION_COOKIE_NAME } from '../constants';
import RequireAuth from '../decorators/RequireAuth';
import { Game } from '../entities/Game.entity';
import { User } from '../entities/User.entity';
import { GraphQLContext } from '../types';

@ObjectType()
export class Stats {
  @Field()
  gamesPlayed: number;

  @Field()
  gamesWon: number;

  @Field()
  gamesLost: number;
}

@InputType()
export class UserInput {
  @Field()
  username: string;

  @Field()
  password: string;
}

@InputType()
export class RegisterInput extends UserInput {
  @MinLength(5)
  @IsAlphanumeric('en-US')
  @IsLowercase()
  @IsString()
  username: string;

  @IsString()
  @Matches(new RegExp(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!.@$%^&*-]).{8,}$/gm), {
    message: `Password should be minimum 8 chars long,
    contain at least one upper-case letter, one lower-case letter, one digit and one special char.`,
  })
  password: string;
}

const ERRORS = {
  INCORRECT_PASSWORD: 'Incorrect password',
  USER_NOT_FOUND: 'No user found with the specified username',
  ALREADY_SIGNED_IN: 'You are already signed in',
};

@Resolver(User)
export class UserResolver {
  @Mutation(() => User)
  async register(
    @Ctx() { db, req }: GraphQLContext,
    @Arg('data') userInput: RegisterInput
  ): Promise<Omit<User, 'password'>> {
    const user = db.create(User);
    user.username = userInput.username;
    const hashedPassword = await argon2.hash(userInput.password);
    user.password = hashedPassword;
    return db.save(user).then((createdUser) => {
      req.session.userId = createdUser.id;
      return omit(user, ['password']);
    });
  }

  @Mutation(() => User)
  async login(
    @Ctx() { db, req }: GraphQLContext,
    @Arg('data') userInput: UserInput
  ): Promise<Omit<User, 'password'>> {
    if (req.session?.userId) throw new Error(ERRORS.ALREADY_SIGNED_IN);
    const { username, password } = userInput;
    return db
      .findOne(User, {
        where: {
          username,
        },
      })
      .then(async (user) => {
        if (!user) throw new Error(ERRORS.USER_NOT_FOUND);
        const validPassword = await argon2.verify(user.password, password);
        if (!validPassword) throw new Error(ERRORS.INCORRECT_PASSWORD);
        req.session.userId = user.id;
        // Omitting password could also be done using class-transformer
        // library and selecting which properties to expose
        return omit(user, ['password']);
      });
  }

  @RequireAuth()
  @Query(() => Stats)
  async stats(@Ctx() { db, req }: GraphQLContext, @Arg('since') duration: string) {
    return db
      .find(Game, {
        where: {
          user: { id: req.session.userId },
          createdAt: MoreThanOrEqual(new Date(Date.now() - parse(duration))),
          finished: true,
        },
      })
      .then((games: Game[]) => {
        return {
          gamesPlayed: games.length,
          gamesWon: games.filter((game) => game.userWon).length,
          gamesLost: games.filter((game) => !game.userWon).length,
        };
      });
  }

  @RequireAuth()
  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: GraphQLContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(SESSION_COOKIE_NAME);
        if (err) {
          resolve(false);
          return;
        }

        resolve(true);
      })
    );
  }
}

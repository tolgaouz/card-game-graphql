import { ApolloServer } from 'apollo-server-express';
import * as argon2 from 'argon2';
import { buildSchema } from 'type-graphql';
import { DataSource } from 'typeorm';
import { ERRORS } from '../../constants';
import { Game } from '../../entities/Game.entity';
import { User } from '../../entities/User.entity';
import { GameResolver } from '../Game.resolver';
import { RegisterInput, UserInput, UserResolver } from '../User.resolver';

const dataSource = new DataSource({
  type: 'better-sqlite3',
  database: ':memory:',
  entities: [User, Game],
  synchronize: true,
  dropSchema: true,
});

beforeEach(async () => {
  await dataSource.initialize();
});

afterEach(async () => {
  await dataSource.destroy();
});

const QUERIES = {
  REGISTER(params: RegisterInput) {
    return {
      query: `
        mutation($data:RegisterInput!){
          register(data:$data){
            id
          }
        }`,
      variables: { data: params },
    };
  },
  LOGIN(params: UserInput) {
    return {
      query: `
        mutation($data:UserInput!){
          login(data:$data){
            id
          }
        }`,
      variables: { data: params },
    };
  },
  STATS(since: string) {
    return {
      query: `
        query($since:String!){
          stats(since:$since){
            gamesPlayed
            gamesWon
            gamesLost
          }
        }`,
      variables: { since },
    };
  },
};

describe('User Resolver', () => {
  describe('register', () => {
    it('writes to db and attaches session with correct input', async () => {
      const testServer = new ApolloServer({
        schema: await buildSchema({
          resolvers: [UserResolver, GameResolver],
        }),
        context: {
          req: {
            session: {},
          },
          db: dataSource.manager,
        },
      });

      const registerResponse = await testServer.executeOperation(
        QUERIES.REGISTER({
          username: 'username',
          password: 'Mockpassword1!',
        })
      );

      expect(registerResponse.errors).toBe(undefined);
      const user = await dataSource.manager.findOne(User, {
        where: { id: registerResponse.data?.register.id },
      });

      expect(user?.id).toBe(registerResponse.data?.register.id);

      const statsResponse = await testServer.executeOperation(QUERIES.STATS('1d'));
      // Implicitly checking for session here since the stats route requires authentication
      expect((statsResponse.errors ?? [])[0]?.message).not.toBe(ERRORS.NOT_AUTHENTICATED);
    });

    it('throws validation error on incorrect input', async () => {
      const testServer = new ApolloServer({
        schema: await buildSchema({
          resolvers: [UserResolver, GameResolver],
        }),
        context: {
          req: {
            session: {},
          },
          db: dataSource.manager,
        },
      });

      const register = await testServer.executeOperation(
        QUERIES.REGISTER({
          username: 'user',
          password: 'mock',
        })
      );

      const validationErrors = (register.errors ?? [])[0].extensions?.exception.validationErrors;

      expect(validationErrors.length).toBe(2);
    });

    it('hashes the password before writing to db', async () => {
      const testServer = new ApolloServer({
        schema: await buildSchema({
          resolvers: [UserResolver, GameResolver],
        }),
        context: {
          req: {
            session: {},
          },
          db: dataSource.manager,
        },
      });

      const register = await testServer.executeOperation(
        QUERIES.REGISTER({
          username: 'username',
          password: 'Mockpassword1!',
        })
      );

      expect(register.errors).toBe(undefined);

      const user = await dataSource.manager.findOne(User, {
        where: { id: register.data?.register.id },
      });

      expect(await argon2.verify(user?.password as string, 'Mockpassword1!')).toBe(true);
    });
  });

  describe('login', () => {
    it('logs the user in successfully and sets session', async () => {
      const testServer = new ApolloServer({
        schema: await buildSchema({
          resolvers: [UserResolver, GameResolver],
        }),
        context: {
          req: {
            session: {},
          },
          db: dataSource.manager,
        },
      });

      // Dont want to use register mutation here since it'll set the session
      const user = await dataSource.manager.create(User);
      user.username = 'username';
      user.password = await argon2.hash('Mockpassword1!');
      await dataSource.manager.save(user);

      const login = await testServer.executeOperation(
        QUERIES.LOGIN({
          username: 'username',
          password: 'Mockpassword1!',
        })
      );

      expect(login.errors).toBe(undefined);
      const statsResponse = await testServer.executeOperation(QUERIES.STATS('1d'));

      // Implicitly checking for session here since the stats route requires authentication
      expect((statsResponse.errors ?? [])[0]?.message).not.toBe(ERRORS.NOT_AUTHENTICATED);
    });

    it('throws error if user is already signed-in', async () => {
      const testServer = new ApolloServer({
        schema: await buildSchema({
          resolvers: [UserResolver, GameResolver],
        }),
        context: {
          req: {
            session: { userId: 1 },
          },
          db: dataSource.manager,
        },
      });

      // Dont want to use register mutation here since it'll set the session
      const user = await dataSource.manager.create(User);
      user.username = 'username';
      user.password = await argon2.hash('Mockpassword1!');
      await dataSource.manager.save(user);

      const login = await testServer.executeOperation(
        QUERIES.LOGIN({
          username: 'username',
          password: 'Mockpassword1!',
        })
      );

      expect((login.errors ?? [])[0].message).toBe('You are already signed in');
    });

    it('throws error if user is not found', async () => {
      const testServer = new ApolloServer({
        schema: await buildSchema({
          resolvers: [UserResolver, GameResolver],
        }),
        context: {
          req: {
            session: {},
          },
          db: dataSource.manager,
        },
      });

      const login = await testServer.executeOperation(
        QUERIES.LOGIN({
          username: 'username',
          password: 'Mockpassword1!',
        })
      );

      expect((login.errors ?? [])[0].message).toBe('No user found with the specified username');
    });

    it('throws error if password is incorrect', async () => {
      const testServer = new ApolloServer({
        schema: await buildSchema({
          resolvers: [UserResolver, GameResolver],
        }),
        context: {
          req: {
            session: {},
          },
          db: dataSource.manager,
        },
      });

      // Dont want to use register mutation here since it'll set the session
      const user = await dataSource.manager.create(User);
      user.username = 'username';
      user.password = await argon2.hash('Mockpassword1!');
      await dataSource.manager.save(user);

      const login = await testServer.executeOperation(
        QUERIES.LOGIN({
          username: 'username',
          password: 'wrong',
        })
      );

      expect((login.errors ?? [])[0].message).toBe('Incorrect password');
    });
  });

  describe('stats', () => {
    it('displays stats correctly', async () => {
      const testServer = new ApolloServer({
        schema: await buildSchema({
          resolvers: [UserResolver, GameResolver],
        }),
        context: {
          req: {
            session: { userId: 1 },
          },
          db: dataSource.manager,
        },
      });

      // Add user
      let user = dataSource.manager.create(User);
      user.username = 'username';
      user.password = await argon2.hash('Mockpassword1!');
      user = await dataSource.manager.save(user);

      // Generate 4 games, 1 win, 2 lose, 1 left incomplete
      await Promise.all(
        [...new Array(4)].map((_, i) => {
          const game = dataSource.manager.create(Game);
          if (user) game.user = user;
          if (i < 3) game.finished = true;
          if (i === 0) game.userWon = true;
          return dataSource.manager.save(game);
        })
      );

      const statsResponse = await testServer.executeOperation(QUERIES.STATS('1d'));

      expect((statsResponse.data ?? {}).stats).toMatchObject({
        gamesPlayed: 3,
        gamesWon: 1,
        gamesLost: 2,
      });
    });
  });
});

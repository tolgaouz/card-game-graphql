import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { DataSource } from 'typeorm';
import { Game } from '../../entities/Game.entity';
import { User } from '../../entities/User.entity';
import { GameResolver } from '../Game.resolver';

const dataSource = new DataSource({
  type: 'better-sqlite3',
  database: ':memory:',
  entities: [User, Game],
  synchronize: true,
  dropSchema: true,
});

beforeEach(async () => {
  await dataSource.initialize();
  const user = dataSource.manager.create(User, { username: 'mock', password: 'Mockpassword1!' });
  await dataSource.manager.save(user);
});

afterEach(async () => {
  await dataSource.destroy();
});

const QUERIES = {
  START_GAME: `
  mutation {
    startGame{
      id
      round
      userWon
      finished
      hand{kind}
    }
  }`,
  DEAL: `
  mutation {
    deal{
      message
      details {
        round
        deck {kind}
      }
    }
  }`,
  CURRENT_GAME: `
  query {
    currentGame{
      id
      round
      userWon
      finished
      hand{kind}
    }
  }`,
  RESET: `
  mutation{
    reset{
      message
      details{
        id
        round
        finished
        userWon
      }
    }
  }`,
};

describe('Game Resolver', () => {
  describe('startGame', () => {
    it('should start a game and assign the game to the user', async () => {
      const testServer = new ApolloServer({
        schema: await buildSchema({
          resolvers: [GameResolver],
        }),
        context: {
          req: {
            session: { userId: 1 },
          },
          db: dataSource.manager,
        },
      });

      const result = await testServer.executeOperation({
        query: QUERIES.START_GAME,
      });

      const user = await dataSource.manager.findOne(User, {
        where: { id: 1 },
        relations: { currentGame: true },
      });
      const game = await dataSource.manager.findOne(Game, {
        where: { user: { id: 1 } },
        relations: { user: true },
      });
      expect(game).not.toBeNull();
      expect(result.errors).toBe(undefined);
      expect(game?.user.id).toBe(1);
      expect(user?.currentGame.id).toBe((game as Game).id);
    });
  });

  describe('deal', () => {
    it('deals from the current game of the user', async () => {
      const testServer = new ApolloServer({
        schema: await buildSchema({
          resolvers: [GameResolver],
        }),
        context: {
          req: {
            session: {
              userId: 1,
            },
          },
          db: dataSource.manager,
        },
      });

      const startGameResponse = await testServer.executeOperation({
        query: QUERIES.START_GAME,
      });

      const result = await testServer.executeOperation({
        query: QUERIES.DEAL,
      });

      const gameId = startGameResponse.data?.startGame.id;

      const game = await dataSource.manager.findOne(Game, {
        where: { id: gameId },
      });

      const { errors = [], data = {} } = result;
      expect(errors.length).toBe(0);
      expect(data?.deal.message).toBe('Check gameStatus for your hand. Game is still active!');
      expect(data?.deal.details.deck.length).toBe(42);
      expect(game?.deck.length).toBe(data?.deal.details.deck.length);
    });
  });

  describe('currentGame', () => {
    it('retrieves the current game correctly', async () => {
      const testServer = new ApolloServer({
        schema: await buildSchema({
          resolvers: [GameResolver],
        }),
        context: {
          req: {
            session: {
              userId: 1,
            },
          },
          db: dataSource.manager,
        },
      });

      const startGameResponse = await testServer.executeOperation({
        query: QUERIES.START_GAME,
      });

      const currentGameResponse = await testServer.executeOperation({
        query: QUERIES.CURRENT_GAME,
      });
      expect(currentGameResponse.errors).toBe(undefined);
      expect(currentGameResponse.data?.currentGame).toMatchObject(
        startGameResponse.data?.currentGame ?? {}
      );
    });
  });

  describe('reset', () => {
    it('resets the current game', async () => {
      const testServer = new ApolloServer({
        schema: await buildSchema({
          resolvers: [GameResolver],
        }),
        context: {
          req: {
            session: {
              userId: 1,
            },
          },
          db: dataSource.manager,
        },
      });

      await testServer.executeOperation({
        query: QUERIES.START_GAME,
      });

      await testServer.executeOperation({
        query: QUERIES.DEAL,
      });

      const currentGameResponse = await testServer.executeOperation({
        query: QUERIES.CURRENT_GAME,
      });

      const resetResponse = await testServer.executeOperation({
        query: QUERIES.RESET,
      });
      expect(resetResponse.errors).toBe(undefined);
      expect(resetResponse.data?.reset.message).toBe(
        `Your latest game has been reset successfully!`
      );
      expect(resetResponse.data?.reset.details.id).toBe(currentGameResponse.data?.currentGame.id);
      expect(resetResponse.data?.reset.details.round).toBe(1);
      expect(resetResponse.data?.reset.details.finished).toBe(false);
      expect(resetResponse.data?.reset.details.userWon).toBe(false);
    });
  });
});

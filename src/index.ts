import { ApolloServer } from 'apollo-server-express';
import connectRedis from 'connect-redis';
import * as dotenv from 'dotenv';
import express, { Response } from 'express';
import session from 'express-session';
import { createClient } from 'redis';
import { buildSchema } from 'type-graphql';
import { SESSION_COOKIE_NAME } from './constants';
import dataSource from './ormconfig';
import { GameResolver } from './resolvers/Game.resolver';
import { UserResolver } from './resolvers/User.resolver';
import { FormattedError, GraphQLContext, RequestWithSession } from './types';

dotenv.config();

dataSource.initialize().then(async ({ manager: db }) => {
  const server = new ApolloServer({
    schema: await buildSchema({
      resolvers: [GameResolver, UserResolver],
    }),
    playground: true,
    context: ({ req, res }: { req: RequestWithSession; res: Response }): GraphQLContext => ({
      req,
      res,
      db,
    }),
    formatError(error) {
      const formattedError: FormattedError = {
        message: error.message,
        path: error.path,
      };
      // If query is in the exception, that means it's a database error
      if ('query' in error.extensions.exception) {
        formattedError.detail = error.extensions.exception.detail;
      }
      if (error.message.includes('Validation')) {
        formattedError.validationErrors = error.extensions.exception.validationErrors;
      }
      return formattedError;
    },
  });

  const app = express();

  const PORT = 4000;

  const RedisStore = connectRedis(session);
  const redisClient = createClient({
    legacyMode: true,
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  });
  redisClient.connect().catch(console.error);

  app.use(
    session({
      name: SESSION_COOKIE_NAME,
      store: new RedisStore({
        client: redisClient,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        httpOnly: true,
        sameSite: 'lax', // csrf
        secure: false,
      },
      saveUninitialized: false,
      secret: 'Session secret',
      resave: false,
    })
  );

  server.applyMiddleware({ app });
  // Start the server
  app.listen({ port: PORT }, () =>
    // eslint-disable-next-line no-console
    console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`)
  );
});

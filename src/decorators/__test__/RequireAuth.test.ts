import 'reflect-metadata';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema, Ctx, Field, Int, ObjectType, Query, Resolver } from 'type-graphql';
import { ERRORS } from '../../constants';
import { GraphQLContext } from '../../types';
import RequireAuth from '../RequireAuth';

@ObjectType()
class MockEntity {
  @Field()
  mock: string;
}

@Resolver(MockEntity)
class MockResolver {
  @RequireAuth()
  @Query(() => Int, { nullable: true })
  mock(@Ctx() { req }: GraphQLContext) {
    return req.session.userId;
  }
}

const QUERY = `
  query{
    mock
  }
`;

describe('RequireAuth', () => {
  it('throws error when not logged in', async () => {
    const testServer = new ApolloServer({
      schema: await buildSchema({
        resolvers: [MockResolver],
      }),
      context: {
        req: {
          session: {},
        },
      },
    });
    const result = await testServer.executeOperation({ query: QUERY });

    const { errors = [] } = result;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toBe(ERRORS.NOT_AUTHENTICATED);
  });

  it('allows further when logged in', async () => {
    const testServer = new ApolloServer({
      schema: await buildSchema({
        resolvers: [MockResolver],
      }),
      context: {
        req: {
          session: { userId: 1 },
        },
      },
    });
    const result = await testServer.executeOperation({ query: QUERY });
    const { errors = [], data = {} } = result;
    expect(errors.length).toBe(0);
    expect(data?.mock).toBe(1);
  });
});

import { Resolver, Mutation, Ctx, ObjectType, Field, Query } from 'type-graphql';
import RequireAuth from '../decorators/RequireAuth';
import { Game } from '../entities/Game.entity';
import { User } from '../entities/User.entity';
import { GraphQLContext } from '../types';

@ObjectType()
class GameStatusResponse {
  @Field()
  message: string;

  @Field(() => Game)
  details: Game;
}

const constructGameResponse = (game: Game): GameStatusResponse => {
  let message = `Check gameStatus for your hand. Game is still active!`;
  if (game.finished) {
    if (game.userWon) message = 'Winner!';
    else if (game.round < 11)
      message = `Game over. All the aces have been dealt. You can still call deal() if you're curious to see what you'll get.`;
    else message = 'You lost. Better luck next time!';
  }
  return {
    message,
    details: game,
  };
};

const ERRORS = {
  NO_ACTIVE_GAME: 'You dont have any active game! Why dont you start one?',
  INVALID_SESSION: 'Your session is invalid. Please log in again.',
};

@Resolver(Game)
export class GameResolver {
  @RequireAuth()
  @Query(() => Game, { nullable: true })
  currentGame(@Ctx() { req, db }: GraphQLContext): Promise<Game> | null {
    return db
      .findOne(User, { where: { id: req.session.userId }, relations: { currentGame: true } })
      .then((user) => {
        if (!user?.currentGame) throw new Error(ERRORS.NO_ACTIVE_GAME);
        return user.currentGame;
      });
  }

  /**
   * Starts a new game,
   * If a user is logged in, the game is automatically attached to the user,
   * Otherwise, deal() should be called with an id.
   */
  @RequireAuth()
  @Mutation(() => Game)
  async startGame(@Ctx() { db, req }: GraphQLContext): Promise<Game> {
    const game = db.create(Game);
    game.user = { id: req.session.userId } as User;
    game.startGame();
    return db.save(game).then(async (savedGame) => {
      await db.update(User, { id: req.session.userId }, { currentGame: { id: savedGame.id } });
      return savedGame;
    });
  }

  /**
   * Authenticated route.
   * Will return the most recent game started by the player sending the request.
   * If gameId is specified, this resolver will try to return a game with that id and user.
   * @param gameId Game Id
   * @returns
   */
  @RequireAuth()
  @Mutation(() => GameStatusResponse)
  async deal(@Ctx() { db, req }: GraphQLContext): Promise<GameStatusResponse> {
    const user = await db.findOne(User, {
      where: { id: req.session.userId },
      relations: { currentGame: true },
    });
    if (!user) throw new Error(ERRORS.INVALID_SESSION);
    if (!user.currentGame?.id) throw new Error(ERRORS.NO_ACTIVE_GAME);
    const game = new Game(user.currentGame);
    game.deal();
    return db.save(game).then((savedGame) => constructGameResponse(savedGame));
  }

  @RequireAuth()
  @Mutation(() => GameStatusResponse)
  async reset(@Ctx() { db, req }: GraphQLContext): Promise<GameStatusResponse> {
    return db
      .findOne(User, {
        where: { id: req.session.userId },
        relations: { currentGame: true },
      })
      .then((user) => {
        if (!user?.currentGame) throw new Error(ERRORS.NO_ACTIVE_GAME);
        const game = new Game(user.currentGame);
        game.reset();
        return db.save(game);
      })
      .then((game) => ({
        message: `Your latest game has been reset successfully!`,
        details: game,
      }));
  }
}

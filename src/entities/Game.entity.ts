import sampleSize from 'lodash/sampleSize';
import shuffle from 'lodash/shuffle';
import { ObjectType, Field, registerEnumType, Int } from 'type-graphql';
import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  BaseEntity,
  ManyToOne,
} from 'typeorm';
// eslint-disable-next-line import/no-cycle
import { User } from './User.entity';

export enum CardKind {
  CLUBS = 'Clubs',
  DIAMONDS = 'Diamonds',
  HEARTS = 'Hearts',
  SPADES = 'Spades',
}

export type Ace = { number: 1; kind: CardKind };
export type King = { number: 13; kind: CardKind };
export type Queen = { number: 12; kind: CardKind };
export type Jack = { number: 11; kind: CardKind };

enum CardName {
  Ace = 'Ace',
  King = 'King',
  Queen = 'Queen',
  Jack = 'Jack',
}

registerEnumType(CardKind, {
  name: 'CardKind',
  description: 'Kind of a card. One of [Clubs,Diamonds,Hearts,Spades].',
});

registerEnumType(CardName, {
  name: 'CardName',
  description:
    'Name of a special card. This attribute is only available when the card is one of Ace,King,Queen or Jack.',
});

export type CardNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

@ObjectType()
export class Card {
  @Field(() => CardKind)
  kind: CardKind;

  @Field(() => Int)
  number: CardNumber;

  @Field(() => CardName, { nullable: true })
  name?: CardName;
}

export type InitialGame = Pick<Game, 'id' | 'hand' | 'deck' | 'finished' | 'userWon' | 'round'>;

@ObjectType()
@Entity()
export class Game {
  constructor(game?: InitialGame) {
    if (!game) this.startGame();
    else {
      this.id = game.id;
      this.hand = game.hand;
      this.deck = game.deck;
      this.finished = game.finished;
      this.userWon = game.userWon;
      this.round = game.round;
    }
  }

  static cardNumbersToNames = new Map([
    [1, CardName.Ace],
    [11, CardName.Jack],
    [12, CardName.Queen],
    [13, CardName.King],
  ]);

  static generateDeck(): Card[] {
    const deck = [CardKind.CLUBS, CardKind.DIAMONDS, CardKind.HEARTS, CardKind.SPADES]
      .map((val) => {
        return [...new Array(13)].map((_, idx) => ({ kind: val, number: (idx + 1) as CardNumber }));
      })
      .flat();
    return Game.setNamesForSpecialCards(deck);
  }

  static setNamesForSpecialCards(cards: Card[]): Card[] {
    return cards.map((card) => {
      const name: CardName | undefined = Game.cardNumbersToNames.get(card.number);
      if (name) return { ...card, name };
      return card;
    });
  }

  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;

  @Field(() => [Card])
  @Column('simple-json')
  deck!: Card[];

  @Field(() => [Card])
  @Column('simple-json')
  hand!: Card[];

  @Field()
  @Column('boolean')
  finished: boolean;

  @Field()
  @Column('boolean', { default: true })
  incomplete: boolean;

  @Field()
  @Column('boolean')
  userWon: boolean;

  @Field(() => [Card])
  acesInDeck: Ace[];

  @Field()
  @Column('int', { default: 1 })
  round: number;

  @ManyToOne(() => User, (user) => user.games)
  user: User;

  get deckCardCount(): number {
    return this.deck.length;
  }

  startGame() {
    this.deck = shuffle(Game.generateDeck());
    const { deck, hand, acesInDeck } = this.drawFromDeck();
    this.deck = deck;
    this.hand = hand;
    this.acesInDeck = acesInDeck;
    this.finished = false;
    this.userWon = false;
    this.round = 1;
  }

  drawFromDeck(count = 5) {
    const dealt = sampleSize(this.deck, Math.min(count, this.deck.length));
    const newDeck = this.deck.filter((card) => {
      return !dealt.includes(card);
    });
    return {
      deck: newDeck,
      hand: dealt,
      acesInDeck: this.getAces(newDeck),
    };
  }

  deal(): Card[] {
    const { deck: nextDeck, hand: nextHand, acesInDeck: nextAcesInDeck } = this.drawFromDeck();
    if (nextAcesInDeck.length === 0) {
      this.finished = true;
      const acesInHand = this.getAces(nextHand);
      if (acesInHand.length > 0 && nextDeck.length === 0) {
        this.userWon = true;
      }
    }
    this.deck = nextDeck;
    // Make sure round can not go above the limit
    this.round = Math.min(this.round + 1, 11);
    this.hand = nextHand;
    this.acesInDeck = nextAcesInDeck;
    return nextHand;
  }

  getAces(cards: Card[] | null = null): Ace[] {
    return (
      cards
        ? cards.filter((card) => card.number === 1)
        : this.deck.filter((card) => card.number === 1)
    ) as Ace[];
  }

  reset() {
    this.startGame();
  }
}

export type GameEntity = Game & BaseEntity;

import 'jest';
import { CardKind, Game } from '../Game.entity';

describe('Game', () => {
  it('generates a deck of 52 cards correctly', () => {
    const deck = Game.generateDeck();
    expect(deck.length).toBe(52);
    // Checking if all the cards from each card is in the deck
    let hasAllCards = true;
    const kinds = [CardKind.CLUBS, CardKind.DIAMONDS, CardKind.HEARTS, CardKind.SPADES];
    kinds.forEach((kind) => {
      // For each kind there should be 13 card numbers
      [...new Array(13)].forEach((_, idx) => {
        if (!deck.find((card) => card.number === idx + 1 && card.kind === kind))
          hasAllCards = false;
      });
    });
    expect(hasAllCards).toBe(true);
  });

  it('deals 52 cards and with 47 on the deck and 5 in hand initially', () => {
    const game = new Game();
    const { hand, deck } = game;
    expect(hand.length).toBe(5);
    expect(deck.length).toBe(47);
  });

  it('deals 5 cards when deal is called and removes them from deck', () => {
    const game = new Game();
    const hand = game.deal();
    expect(game.deck.length).toBe(42);
    // Check if deck still contains any of the dealt cards
    let hasDealtCards = false;
    hand.forEach((card) => {
      if (game.deck.includes(card)) hasDealtCards = true;
    });
    expect(hasDealtCards).toBe(false);
  });

  it('resets correctly after dealing', () => {
    const game = new Game();
    game.deal();
    expect(game.hand.length).toBe(5);
    expect(game.deck.length).toBe(42);
    game.reset();
    expect(game.hand.length).toBe(5);
    expect(game.deck.length).toBe(47);
  });

  it('shuffles the deck every time reset is called', () => {
    const game = new Game();
    const firstDeck = [...game.deck];
    game.reset();
    const secondDeck = [...game.deck];
    // Below while loop will run until it finds the first unmatching card,
    // that means 2 decks are different.
    let isSameDeck = true;
    let i = 0;
    while (isSameDeck && i < 52) {
      const { kind, number } = secondDeck[i];
      if (kind !== firstDeck[i].kind && number !== firstDeck[i].number) isSameDeck = false;
      i += 1;
    }
    expect(isSameDeck).toBe(false);
  });

  it('game finishes when there are no aces left in the deck', () => {
    const game = new Game();
    while (game.acesInDeck.length > 0) {
      game.deal();
    }
    expect(game.finished).toBe(true);
  });

  it('can not deal more cards when the deck is empty', () => {
    const game = new Game();
    // Finish up all the cards
    while (game.deck.length > 0) {
      game.deal();
    }
    game.deal();
    expect(game.hand).toStrictEqual([]);
  });

  it('can not deal the same card again', () => {
    const game = new Game();
    game.deal();
    const firstHand = [...game.hand];
    // Go through all of the deck
    let totalSameCards = 0;
    while (game.deck.length > 0) {
      game.deal();
      const currentHand = [...game.hand];
      const sameCards = currentHand.reduce((prevCount, currentCard) => {
        let newCount = prevCount;
        firstHand.forEach((firstCard) => {
          if (currentCard.kind === firstCard.kind && currentCard.number === firstCard.number)
            newCount += 1;
        });
        return newCount;
      }, 0);
      totalSameCards += sameCards;
    }
    expect(totalSameCards).toBe(0);
  });
});

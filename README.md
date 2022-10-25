**Requirements**

1. Assuming a standard deck (52 cards of 4 suits: ♣ Clubs, ♦ Diamonds, ♥ Hearts, ♠ Spades).
2. GraphQL mutation to deal 5 unique, random cards (or fewer if there aren't 5 left).
   - Within the same game, you should never get the same cards again that you got in the past (just like a physical deck).
   - **Game is over when all Aces have been dealt.** If this happens in the final hand, the user Wins; otherwise, the user loses.
3. The GraphQL API should provide access to,
   - Remaining card count
   - Remaining Ace count
   - Game status
4. The GraphQL API should also provide a way to,
   - Start a new game
   - Deal a new hand
   - Reset the in-progress game
5. Display "Game Over" on completion. If the User wins, also display "Winner"; otherwise, display "You Lose. Better luck next time!"
6. Unit tests.

**Bonus!**

- Streak of wins/loses/games played in <period> (can be the last hour, but should be configurable)
- Storing user details, login/out
- Rig the game (e.g. player always wins)
- Custom deck support (e.g. other deck images, other lengths of decks, not just 52 cards)
- Authentication

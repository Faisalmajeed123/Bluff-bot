const SUITS = ["♠", "♣", "♥", "♦"];
const VALUES = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
export class Deck {
  constructor(cards = freshDeck()) {
    this.cards = cards;
  }
  get numberOfCards() {
    return this.cards.length;
  }
  shuffle() {
    for (let i = this.numberOfCards - 1; i > 0; i--) {
      const newIndex = Math.floor(Math.random() * (i + 1));
      const oldValue = this.cards[newIndex];
      this.cards[newIndex] = this.cards[i];
      this.cards[i] = oldValue;
    }
  } // this will shuffle the cards but the length will remain same
}
export class Card {
  constructor(suit, value) {
    this.suit = suit;
    this.value = value;
  } // this class represents single card with single value
}
function freshDeck() {
  return SUITS.flatMap((suit) => {
    return VALUES.map((value) => {
      return new Card(suit, value);
    });
  });
}
// so it is like 2 loops outer loop will select one suite then inner loop will move through all 13 values then second second
// suite and so on untill all 52 loop are not completed. So the outer loop will run 4 times and inner will run 52 times

//module.exports=Deck;

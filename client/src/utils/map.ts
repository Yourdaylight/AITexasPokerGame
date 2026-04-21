const cardNumber = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];
const color = ['♦', '♣', '♥', '♠'];
export default (cards: string[]) => {
  return cards?.map((c: string) => {
    const cNumber = c.charCodeAt(0) - 97;
    const cColor = Number(c[1]) - 1;
    return [`${cardNumber[cNumber]}`, `${color[cColor]}`];
  });
};

const poke2String = (cards: string[]) => {
  return cards?.map((c: string) => {
    const cNumber = c.charCodeAt(0) - 97;
    const cColor = Number(c[1]) - 1;
    return `${color[cColor]}${cardNumber[cNumber]}`;
  });
};

const mapCard = (card: string) => {
  const cardNumber = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];
  const color = ['d', 'c', 'h', 's'];
  const cNumber = card.charCodeAt(0) - 97;
  const cColor = Number(card[1]) - 1;
  return [`${cardNumber[cNumber]}`, `${color[cColor]}`];
};
export { mapCard, poke2String };

import { moveUp, moveDown, removeAt } from '../ordering';

const items = ['a', 'b', 'c'];

describe('moveUp', () => {
  it('swaps with the previous item', () => {
    expect(moveUp(items, 1)).toEqual(['b', 'a', 'c']);
  });

  it('leaves the first item where it is', () => {
    expect(moveUp(items, 0)).toEqual(items);
  });

  it('ignores an index past the end', () => {
    expect(moveUp(items, 9)).toEqual(items);
  });

  it('does not mutate the original', () => {
    moveUp(items, 1);
    expect(items).toEqual(['a', 'b', 'c']);
  });
});

describe('moveDown', () => {
  it('swaps with the next item', () => {
    expect(moveDown(items, 0)).toEqual(['b', 'a', 'c']);
  });

  it('leaves the last item where it is', () => {
    expect(moveDown(items, 2)).toEqual(items);
  });

  it('ignores a negative index', () => {
    expect(moveDown(items, -1)).toEqual(items);
  });

  it('does not mutate the original', () => {
    moveDown(items, 0);
    expect(items).toEqual(['a', 'b', 'c']);
  });
});

describe('removeAt', () => {
  it('drops the item at the index', () => {
    expect(removeAt(items, 1)).toEqual(['a', 'c']);
  });

  it('ignores an out-of-range index', () => {
    expect(removeAt(items, 9)).toEqual(items);
    expect(removeAt(items, -1)).toEqual(items);
  });

  it('does not mutate the original', () => {
    removeAt(items, 0);
    expect(items).toEqual(['a', 'b', 'c']);
  });
});

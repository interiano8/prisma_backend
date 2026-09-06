import { Mutex } from './mutex';

describe('Mutex', () => {
  it('serializa operaciones concurrentes', async () => {
    const mutex = new Mutex();
    const order: string[] = [];

    const task = async (name: string) => {
      const unlock = await mutex.lock();
      order.push(name);
      await new Promise((r) => setTimeout(r, 5));
      unlock();
    };

    await Promise.all([task('a'), task('b'), task('c')]);

    expect(order).toEqual(['a', 'b', 'c']);
  });
});
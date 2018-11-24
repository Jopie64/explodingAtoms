import { interval, range, animationFrameScheduler, defer } from 'rxjs';
import { map, takeWhile } from 'rxjs/operators';

export const msElapsed = (scheduler = animationFrameScheduler) =>
  defer(() => {
    const start = scheduler.now();
    return interval(0, scheduler).pipe(
      map(_ => scheduler.now() - start));
  });

export const duration = (durMs: number, scheduler = animationFrameScheduler) =>
  msElapsed(scheduler).pipe(
    map(v => v / durMs),
    takeWhile(v => v <= 1)
  );

export const ease = f =>
  map(f as (n: number) => number);

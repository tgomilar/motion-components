import { animate } from 'motion'
import type { AnimationPlaybackControlsWithThen, ValueAnimationTransition } from 'motion'

/**
 * A list of numbers that springs to new targets. A new target interrupts the
 * running springs and continues from the current values. `settled()` resolves
 * once the latest targets are reached, however often they changed on the way.
 */
export class SpringValues {
  current: number[] = []
  private targets: number[] = []
  private runs: AnimationPlaybackControlsWithThen[] = []
  private batch = 0
  private waiters: (() => void)[] = []

  constructor(private onChange: () => void) {}

  set(values: number[]) {
    this.stop()
    this.current = [...values]
    this.targets = [...values]
    this.onChange()
    this.release()
  }

  to(values: number[], transition: (index: number) => ValueAnimationTransition<number>) {
    this.stop()
    const id = ++this.batch
    this.targets = [...values]
    this.current.length = values.length
    this.runs = values.map((value, i) =>
      animate(this.current[i] ?? 0, value, {
        ...transition(i),
        onUpdate: (latest: number) => {
          this.current[i] = latest
          this.onChange()
        },
      }),
    )
    Promise.all(this.runs).then(
      () => {
        if (id !== this.batch) return
        this.runs = []
        this.release()
      },
      () => {},
    )
  }

  settled(): Promise<void> {
    if (!this.runs.length) return Promise.resolve()
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  pause() {
    this.runs.forEach((run) => run.pause())
  }

  resume() {
    this.runs.forEach((run) => run.play())
  }

  stop() {
    this.runs.forEach((run) => run.stop())
    this.runs = []
  }

  private release() {
    this.waiters.splice(0).forEach((resolve) => resolve())
  }
}

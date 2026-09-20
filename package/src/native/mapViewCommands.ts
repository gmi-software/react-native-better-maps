export const MAP_VIEW_NOT_MOUNTED_ERROR = 'MapView is not mounted';

export const MAP_VIEW_UNMOUNTED_BEFORE_READY_ERROR =
  'MapView was unmounted before the native map became available';

interface BufferedCommand<Target> {
  /** Runs the command against the arrived target and settles the caller's promise. */
  flush(target: Target): void;
  /** Rejects the caller's promise without ever touching a target. */
  cancel(error: Error): void;
}

/**
 * Imperative command channel to a native view whose handle arrives late.
 *
 * Nitro delivers the `hybridRef` prop one JS -> UI -> JS round trip after the
 * commit that mounted the view, so every call made from a consumer's mount
 * effect is issued before there is anything to call. Commands made in that
 * window are buffered here and replayed, in the order they were made, as soon
 * as {@linkcode MapViewCommands.attach} hands over the handle.
 */
export class MapViewCommands<Target> {
  private target: Target | null = null;
  private buffered: BufferedCommand<Target>[] = [];
  private isUnmounted = false;

  /**
   * Runs {@linkcode command} against the native handle, buffering it when the
   * handle has not arrived yet.
   *
   * Rejects with {@linkcode MAP_VIEW_NOT_MOUNTED_ERROR} once the view has
   * unmounted, and with {@linkcode MAP_VIEW_UNMOUNTED_BEFORE_READY_ERROR} when
   * the view unmounts while the command is still buffered.
   */
  run<Result>(command: (target: Target) => Promise<Result>): Promise<Result> {
    if (this.isUnmounted) {
      return Promise.reject(new Error(MAP_VIEW_NOT_MOUNTED_ERROR));
    }

    const target = this.target;
    if (target != null) {
      return command(target);
    }

    return new Promise<Result>((resolve, reject) => {
      this.buffered.push({
        // A buffered caller already holds a promise, so a command that throws
        // instead of rejecting has to be turned into a rejection here. Letting
        // it escape would abandon every command queued behind it.
        flush: (arrivedTarget) => {
          try {
            command(arrivedTarget).then(resolve, reject);
          } catch (error) {
            reject(error);
          }
        },
        cancel: reject,
      });
    });
  }

  /** Publishes the native handle and replays everything buffered so far. */
  attach(target: Target): void {
    this.target = target;

    const buffered = this.buffered;
    this.buffered = [];
    for (const command of buffered) {
      command.flush(target);
    }
  }

  /**
   * Re-arms the channel after {@linkcode MapViewCommands.unmount}. StrictMode
   * tears an effect down and sets it up again while the view itself stays
   * mounted, so the handle survives that cycle - it belongs to the native view,
   * not to the effect.
   */
  mount(): void {
    this.isUnmounted = false;
  }

  /** Rejects every buffered command and makes later calls reject too. */
  unmount(): void {
    this.isUnmounted = true;

    if (this.buffered.length === 0) {
      return;
    }

    const buffered = this.buffered;
    this.buffered = [];
    const error = new Error(MAP_VIEW_UNMOUNTED_BEFORE_READY_ERROR);
    for (const command of buffered) {
      command.cancel(error);
    }
  }
}

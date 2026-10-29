import type { AppContext } from "../app/context";

export interface Screen {
  element: HTMLElement;
  /** Called when the person leaves the screen: stop timers, release the camera. */
  dispose?: () => void;
}

export type ScreenFactory<Params extends unknown[] = []> = (ctx: AppContext, ...params: Params) => Screen;

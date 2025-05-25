export type middlewareFn<C> = (
  ctx: C,
  next: () => Promise<void>,
) => Promise<unknown> | void;

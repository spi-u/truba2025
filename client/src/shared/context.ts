import { NarrowedContext, Scenes } from 'telegraf';
import { SceneSession, SceneSessionData } from 'telegraf/scenes';

import { State } from './state';
import { User } from '../models';

interface BotBaseSession {
  state: State;
}

interface BotSceneSessionData<D extends object> extends SceneSessionData {
  state: D;
}

export type BotSession<D extends object = any> = SceneSession<
  BotSceneSessionData<D>
> &
  BotBaseSession;

export interface BotContext<D extends object = any>
  extends Scenes.SceneContext<BotSceneSessionData<D>> {
  session: SceneSession<BotSceneSessionData<D>> & BotBaseSession;
  user: User;
  deleteMessageOrClearReplyMarkup: () => Promise<void>;
}

export type BotContextMessageUpdate<D extends object = any> = NarrowedContext<
  BotContext<D>,
  any
>;

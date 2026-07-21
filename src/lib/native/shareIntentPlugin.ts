import { registerPlugin } from '@capacitor/core';



interface ShareIntentPendingResult {

  query?: string;

}



export interface ShareIntentPlugin {

  consumePending(): Promise<ShareIntentPendingResult>;

}



export const ShareIntent = registerPlugin<ShareIntentPlugin>('ShareIntent');


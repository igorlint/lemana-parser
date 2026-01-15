import { updateScheduler } from './scheduler';

export function initScheduler() {
    console.log('🚀 App starting: Initializing background scheduler...');
    updateScheduler();
}

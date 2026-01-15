import cron from 'node-cron';
import { prisma } from './prisma';
import { runScheduledParse } from './automated-parse';

let currentTasks: any[] = [];

export async function updateScheduler() {
    // Clear old tasks
    currentTasks.forEach(task => task.stop());
    currentTasks = [];

    let schedules;
    try {
        schedules = await prisma.parsingSchedule.findMany({
            where: { enabled: true }
        });
    } catch (e) {
        console.error('Scheduler: Failed to fetch schedules', e);
        return;
    }

    if (!schedules || schedules.length === 0) {
        console.log('⏹️ Scheduler: No active schedules found.');
        return;
    }

    const dayMap: Record<string, string> = {
        'Mon': '1', 'Tue': '2', 'Wed': '3', 'Thu': '4', 'Fri': '5', 'Sat': '6', 'Sun': '0'
    };

    const now = new Date();
    const moscowNow = new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short'
    }).format(now);
    console.log(`🕒 System Time: ${now.toISOString()}, Moscow Time: ${moscowNow}`);

    schedules.forEach(schedule => {
        const days = JSON.parse(schedule.days || '[]');
        const regions = JSON.parse(schedule.regions || '[]');

        // Map days and handle special case for all days
        let cronDays = days.map((d: string) => dayMap[d]).filter((val: any) => val !== undefined && val !== null).join(',');
        if (days.length >= 7) cronDays = '*';

        const [hour, minute] = schedule.time.split(':');
        const cronExpr = `${parseInt(minute)} ${parseInt(hour)} * * ${cronDays}`;

        console.log(`📅 Scheduling [${schedule.id}]: "${cronExpr}" for regions: [${regions.join(', ')}]`);

        const task = cron.schedule(cronExpr, () => {
            const firedAt = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
            console.log(`⏰ Schedule [${schedule.id}] TRIGGERED at ${firedAt} (Moscow Time)`);
            runScheduledParse(regions);
        }, {
            timezone: 'Europe/Moscow'
        });
        currentTasks.push(task);
    });
}

// Global initialization check to avoid multiple schedulers in dev/HMR
if (!(global as any).schedulerStarted) {
    (global as any).schedulerStarted = true;
    updateScheduler();
}

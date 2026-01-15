import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export async function sendTelegramFile(token: string, chatId: string, filePath: string, caption: string) {
    const url = `https://api.telegram.org/bot${token}/sendDocument`;

    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', fs.createReadStream(filePath));
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');

    try {
        await axios.post(url, form, {
            headers: form.getHeaders(),
        });
        console.log('✅ Telegram message sent successfully');
    } catch (error: any) {
        console.error('❌ Failed to send Telegram message:', error.response?.data || error.message);
        throw error;
    }
}

export async function sendTelegramMessage(token: string, chatId: string, text: string) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        await axios.post(url, {
            chat_id: chatId,
            text,
            parse_mode: 'HTML'
        });
    } catch (error: any) {
        console.error('❌ Failed to send Telegram text:', error.response?.data || error.message);
    }
}

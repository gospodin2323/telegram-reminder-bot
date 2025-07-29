const TelegramBot = require('node-telegram-bot-api');
const { connectDB, getDueReminders, updateNextReminder } = require('../lib/database');
const { sendEmail } = require('../lib/email');
const moment = require('moment');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: false });

module.exports = async (req, res) => {
  // Sadece cron job'dan gelen istekleri kabul et
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Running cron job to check reminders...');
    
    await connectDB();
    
    // Zamanı gelen hatırlatmaları al
    const dueReminders = await getDueReminders();
    
    console.log(`Found ${dueReminders.length} due reminders`);
    
    for (const reminder of dueReminders) {
      try {
        // Telegram mesajı gönder
        await bot.sendMessage(reminder.chatId, 
          `⏰ Hatırlatma!\n\n${reminder.text}\n\nBu hatırlatma ${reminder.repeat ? 'tekrarlı' : 'tek seferlik'} olarak ayarlandı.`
        );
        
        // Email gönder (eğer email adresi varsa)
        if (reminder.email) {
          await sendEmail(reminder.email, 'Hatırlatma', reminder.text);
        }
        
        // Bir sonraki hatırlatma zamanını hesapla
        if (reminder.repeat) {
          const nextReminder = calculateNextReminder(reminder);
          await updateNextReminder(reminder._id, nextReminder);
        }
        
        console.log(`Sent reminder to ${reminder.chatId}: ${reminder.text}`);
      } catch (error) {
        console.error(`Error sending reminder ${reminder._id}:`, error);
      }
    }
    
    res.status(200).json({ 
      success: true, 
      processed: dueReminders.length 
    });
  } catch (error) {
    console.error('Cron job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

function calculateNextReminder(reminder) {
  const now = moment();
  let nextTime = moment(reminder.nextReminder);
  
  if (reminder.repeat === 'daily') {
    nextTime = nextTime.add(1, 'day');
  } else if (reminder.repeat === 'weekly') {
    nextTime = nextTime.add(1, 'week');
  } else if (reminder.repeat === 'monthly') {
    nextTime = nextTime.add(1, 'month');
  } else if (reminder.repeat === 'weekdays') {
    // Hafta içi tekrarı - bir sonraki iş gününe geç
    do {
      nextTime = nextTime.add(1, 'day');
    } while (nextTime.day() === 0 || nextTime.day() === 6); // Cumartesi veya Pazar ise devam et
  }
  
  return nextTime.toDate();
} 
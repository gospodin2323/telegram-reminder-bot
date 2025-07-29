const TelegramBot = require('node-telegram-bot-api');
const { connectDB, saveReminder, getReminders, deleteReminder } = require('../lib/database');
const { parseReminderText } = require('../lib/parser');

// Bot token'ı environment variable'dan al
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: false });

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { body } = req;
    
    // Telegram webhook'dan gelen mesajı işle
    if (body.message) {
      const { message } = body;
      const chatId = message.chat.id;
      const text = message.text || '';
      const username = message.from.username || message.from.first_name;

      console.log(`Received message from ${username}: ${text}`);

      // Komutları işle
      if (text.startsWith('/start')) {
        await bot.sendMessage(chatId, 
          'Merhaba! Ben hatirlatma botunuz. Size nasil yardimci olabilirim?\n\n' +
          'Komutlar:\n' +
          '/remind - Yeni hatirlatma olustur\n' +
          '/list - Hatirlatmalarinizi goruntule\n' +
          '/delete - Hatirlatma sil\n' +
          '/help - Yardim'
        );
      } else if (text.startsWith('/help')) {
        await bot.sendMessage(chatId,
          'Hatirlatma olusturmak icin su formatta yazin:\n\n' +
          'Ornekler:\n' +
          '• "Yarin saat 10:00da toplanti"\n' +
          '• "Her gun saat 11:00da su ic"\n' +
          '• "Her pazartesi saat 09:00da spor"\n' +
          '• "Her ayin 1inde fatura ode"\n\n' +
          'Email ile hatirlatma icin:\n' +
          '• "email@example.com: Yarin saat 10:00da toplanti"'
        );
      } else if (text.startsWith('/list')) {
        await handleListCommand(chatId);
      } else if (text.startsWith('/delete')) {
        await handleDeleteCommand(chatId, text);
      } else if (text.startsWith('/remind') || (!text.startsWith('/') && text.trim())) {
        await handleReminderCommand(chatId, text);
      } else {
        await bot.sendMessage(chatId, 'Anlamadim. /help yazarak komutlari gorebilirsiniz.');
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function handleReminderCommand(chatId, text) {
  try {
    // /remind komutunu kaldır
    const reminderText = text.startsWith('/remind') ? text.substring(8).trim() : text.trim();
    
    if (!reminderText) {
      await bot.sendMessage(chatId, 'Lutfen hatirlatma metnini yazin. Ornek: "Yarin saat 10:00da toplanti"');
      return;
    }

    const parsed = parseReminderText(reminderText);
    
    if (!parsed) {
      await bot.sendMessage(chatId, 
        'Hatirlatma formatini anlayamadim. Ornekler:\n' +
        '• "Yarin saat 10:00da toplanti"\n' +
        '• "Her gun saat 11:00da su ic"\n' +
        '• "email@example.com: Yarin saat 10:00da toplanti"'
      );
      return;
    }

    // Veritabanına kaydet
    await connectDB();
    const reminder = {
      chatId,
      text: parsed.text,
      time: parsed.time,
      repeat: parsed.repeat,
      email: parsed.email,
      createdAt: new Date(),
      nextReminder: parsed.nextReminder
    };

    await saveReminder(reminder);

    let response = `✅ Hatirlatma olusturuldu!\n\n`;
    response += `📝 Metin: ${parsed.text}\n`;
    response += `⏰ Zaman: ${parsed.timeText}\n`;
    
    if (parsed.repeat) {
      response += `🔄 Tekrar: ${parsed.repeatText}\n`;
    }
    
    if (parsed.email) {
      response += `📧 Email: ${parsed.email}\n`;
    }

    await bot.sendMessage(chatId, response);
  } catch (error) {
    console.error('Error creating reminder:', error);
    await bot.sendMessage(chatId, 'Hatirlatma olusturulurken bir hata olustu. Lutfen tekrar deneyin.');
  }
}

async function handleListCommand(chatId) {
  try {
    await connectDB();
    const reminders = await getReminders(chatId);
    
    if (reminders.length === 0) {
      await bot.sendMessage(chatId, 'Henuz hatirlatmaniz bulunmuyor.');
      return;
    }

    let message = '📋 Hatirlatmalariniz:\n\n';
    reminders.forEach((reminder, index) => {
      message += `${index + 1}. ${reminder.text}\n`;
      message += `   ⏰ ${reminder.time}\n`;
      if (reminder.repeat) {
        message += `   🔄 ${reminder.repeat}\n`;
      }
      if (reminder.email) {
        message += `   📧 ${reminder.email}\n`;
      }
      message += '\n';
    });

    message += 'Silme icin: /delete [numara]';

    await bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error listing reminders:', error);
    await bot.sendMessage(chatId, 'Hatirlatmalar listelenirken bir hata olustu.');
  }
}

async function handleDeleteCommand(chatId, text) {
  try {
    const parts = text.split(' ');
    const index = parseInt(parts[1]) - 1;
    
    if (isNaN(index)) {
      await bot.sendMessage(chatId, 'Lutfen silmek istediginiz hatirlatmanin numarasini yazin. Ornek: /delete 1');
      return;
    }

    await connectDB();
    const reminders = await getReminders(chatId);
    
    if (index < 0 || index >= reminders.length) {
      await bot.sendMessage(chatId, 'Gecersiz numara. /list yazarak hatirlatmalarinizi gorebilirsiniz.');
      return;
    }

    const reminderToDelete = reminders[index];
    await deleteReminder(reminderToDelete._id);
    
    await bot.sendMessage(chatId, `✅ Hatirlatma silindi: "${reminderToDelete.text}"`);
  } catch (error) {
    console.error('Error deleting reminder:', error);
    await bot.sendMessage(chatId, 'Hatirlatma silinirken bir hata olustu.');
  }
} 
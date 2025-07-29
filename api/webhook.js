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
          'Merhaba! Ben hatırlatma botunuz. Size nasıl yardımcı olabilirim?\n\n' +
          'Komutlar:\n' +
          '/remind - Yeni hatırlatma oluştur\n' +
          '/list - Hatırlatmalarınızı görüntüle\n' +
          '/delete - Hatırlatma sil\n' +
          '/help - Yardım'
        );
      } else if (text.startsWith('/help')) {
        await bot.sendMessage(chatId,
          'Hatırlatma oluşturmak için şu formatta yazın:\n\n' +
          'Örnekler:\n' +
          '• "Yarın saat 10:00'da toplantı"\n' +
          '• "Her gün saat 11:00'da su iç"\n' +
          '• "Her pazartesi saat 09:00'da spor"\n' +
          '• "Her ayın 1'inde fatura öde"\n\n' +
          'Email ile hatırlatma için:\n' +
          '• "email@example.com: Yarın saat 10:00'da toplantı"'
        );
      } else if (text.startsWith('/list')) {
        await handleListCommand(chatId);
      } else if (text.startsWith('/delete')) {
        await handleDeleteCommand(chatId, text);
      } else if (text.startsWith('/remind') || (!text.startsWith('/') && text.trim())) {
        await handleReminderCommand(chatId, text);
      } else {
        await bot.sendMessage(chatId, 'Anlamadım. /help yazarak komutları görebilirsiniz.');
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
      await bot.sendMessage(chatId, 'Lütfen hatırlatma metnini yazın. Örnek: "Yarın saat 10:00'da toplantı"');
      return;
    }

    const parsed = parseReminderText(reminderText);
    
    if (!parsed) {
      await bot.sendMessage(chatId, 
        'Hatırlatma formatını anlayamadım. Örnekler:\n' +
        '• "Yarın saat 10:00'da toplantı"\n' +
        '• "Her gün saat 11:00'da su iç"\n' +
        '• "email@example.com: Yarın saat 10:00'da toplantı"'
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

    let response = `✅ Hatırlatma oluşturuldu!\n\n`;
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
    await bot.sendMessage(chatId, 'Hatırlatma oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
  }
}

async function handleListCommand(chatId) {
  try {
    await connectDB();
    const reminders = await getReminders(chatId);
    
    if (reminders.length === 0) {
      await bot.sendMessage(chatId, 'Henüz hatırlatmanız bulunmuyor.');
      return;
    }

    let message = '📋 Hatırlatmalarınız:\n\n';
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

    message += 'Silme için: /delete [numara]';

    await bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error listing reminders:', error);
    await bot.sendMessage(chatId, 'Hatırlatmalar listelenirken bir hata oluştu.');
  }
}

async function handleDeleteCommand(chatId, text) {
  try {
    const parts = text.split(' ');
    const index = parseInt(parts[1]) - 1;
    
    if (isNaN(index)) {
      await bot.sendMessage(chatId, 'Lütfen silmek istediğiniz hatırlatmanın numarasını yazın. Örnek: /delete 1');
      return;
    }

    await connectDB();
    const reminders = await getReminders(chatId);
    
    if (index < 0 || index >= reminders.length) {
      await bot.sendMessage(chatId, 'Geçersiz numara. /list yazarak hatırlatmalarınızı görebilirsiniz.');
      return;
    }

    const reminderToDelete = reminders[index];
    await deleteReminder(reminderToDelete._id);
    
    await bot.sendMessage(chatId, `✅ Hatırlatma silindi: "${reminderToDelete.text}"`);
  } catch (error) {
    console.error('Error deleting reminder:', error);
    await bot.sendMessage(chatId, 'Hatırlatma silinirken bir hata oluştu.');
  }
} 
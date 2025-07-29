const moment = require('moment');

function parseReminderText(text) {
  // Email kontrolü
  let email = null;
  let reminderText = text;
  
  // Email formatı: "email@example.com: hatırlatma metni"
  const emailMatch = text.match(/^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}):\s*(.+)$/);
  if (emailMatch) {
    email = emailMatch[1];
    reminderText = emailMatch[2];
  }
  
  // Zaman ve tekrar bilgilerini parse et
  const parsed = parseTimeAndRepeat(reminderText);
  if (!parsed) return null;
  
  return {
    text: parsed.text,
    time: parsed.time,
    timeText: parsed.timeText,
    repeat: parsed.repeat,
    repeatText: parsed.repeatText,
    email: email,
    nextReminder: parsed.nextReminder
  };
}

function parseTimeAndRepeat(text) {
  const lowerText = text.toLowerCase();
  
  // Tekrarlı hatırlatmalar
  if (lowerText.includes('her gun') || lowerText.includes('gunluk')) {
    return parseDailyReminder(text);
  } else if (lowerText.includes('her hafta') || lowerText.includes('haftalik')) {
    return parseWeeklyReminder(text);
  } else if (lowerText.includes('her ay') || lowerText.includes('aylik')) {
    return parseMonthlyReminder(text);
  } else if (lowerText.includes('hafta ici') || lowerText.includes('is gunleri')) {
    return parseWeekdaysReminder(text);
  } else {
    // Tek seferlik hatırlatma
    return parseOneTimeReminder(text);
  }
}

function parseDailyReminder(text) {
  const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return null;
  
  const hour = parseInt(timeMatch[1]);
  const minute = parseInt(timeMatch[2]);
  
  // Metni temizle
  const cleanText = text.replace(/her gun|gunluk|saat\s*\d{1,2}:\d{2}/gi, '').trim();
  
  // Bir sonraki hatırlatma zamanını hesapla
  const now = moment();
  let nextTime = moment().hour(hour).minute(minute).second(0);
  
  // Eğer bugünün saati geçmişse, yarına ayarla
  if (nextTime.isBefore(now)) {
    nextTime.add(1, 'day');
  }
  
  return {
    text: cleanText,
    time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    timeText: `Her gun saat ${hour}:${minute.toString().padStart(2, '0')}`,
    repeat: 'daily',
    repeatText: 'Her gun',
    nextReminder: nextTime.toDate()
  };
}

function parseWeeklyReminder(text) {
  const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return null;
  
  const hour = parseInt(timeMatch[1]);
  const minute = parseInt(timeMatch[2]);
  
  // Hangi gün kontrolü
  const days = ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi', 'pazar'];
  let targetDay = 1; // Pazartesi varsayılan
  
  for (let i = 0; i < days.length; i++) {
    if (text.toLowerCase().includes(days[i])) {
      targetDay = i + 1; // moment.js'de 1=Pazartesi, 7=Pazar
      break;
    }
  }
  
  // Metni temizle
  const cleanText = text.replace(/her hafta|haftalık|her\s+\w+|saat\s*\d{1,2}:\d{2}/gi, '').trim();
  
  // Bir sonraki hatırlatma zamanını hesapla
  const now = moment();
  let nextTime = moment().day(targetDay).hour(hour).minute(minute).second(0);
  
  // Eğer bu haftanın günü geçmişse, gelecek haftaya ayarla
  if (nextTime.isBefore(now)) {
    nextTime.add(1, 'week');
  }
  
  const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  
  return {
    text: cleanText,
    time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    timeText: `Her ${dayNames[targetDay - 1]} saat ${hour}:${minute.toString().padStart(2, '0')}`,
    repeat: 'weekly',
    repeatText: `Her ${dayNames[targetDay - 1]}`,
    nextReminder: nextTime.toDate()
  };
}

function parseMonthlyReminder(text) {
  const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return null;
  
  const hour = parseInt(timeMatch[1]);
  const minute = parseInt(timeMatch[2]);
  
  // Ayın kaçıncı günü kontrolü
  const dayMatch = text.match(/ayın\s*(\d{1,2})/);
  const dayOfMonth = dayMatch ? parseInt(dayMatch[1]) : 1;
  
  // Metni temizle
  const cleanText = text.replace(/her ay|aylık|ayın\s*\d{1,2}|saat\s*\d{1,2}:\d{2}/gi, '').trim();
  
  // Bir sonraki hatırlatma zamanını hesapla
  const now = moment();
  let nextTime = moment().date(dayOfMonth).hour(hour).minute(minute).second(0);
  
  // Eğer bu ayın günü geçmişse, gelecek aya ayarla
  if (nextTime.isBefore(now)) {
    nextTime.add(1, 'month');
  }
  
  return {
    text: cleanText,
    time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    timeText: `Her ayın ${dayOfMonth}'inde saat ${hour}:${minute.toString().padStart(2, '0')}`,
    repeat: 'monthly',
    repeatText: `Her ayın ${dayOfMonth}'i`,
    nextReminder: nextTime.toDate()
  };
}

function parseWeekdaysReminder(text) {
  const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return null;
  
  const hour = parseInt(timeMatch[1]);
  const minute = parseInt(timeMatch[2]);
  
  // Metni temizle
  const cleanText = text.replace(/hafta içi|iş günleri|saat\s*\d{1,2}:\d{2}/gi, '').trim();
  
  // Bir sonraki hatırlatma zamanını hesapla
  const now = moment();
  let nextTime = moment().hour(hour).minute(minute).second(0);
  
  // Eğer bugünün saati geçmişse, yarına ayarla
  if (nextTime.isBefore(now)) {
    nextTime.add(1, 'day');
  }
  
  // Hafta sonu ise pazartesiye ayarla
  while (nextTime.day() === 0 || nextTime.day() === 6) {
    nextTime.add(1, 'day');
  }
  
  return {
    text: cleanText,
    time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    timeText: `Hafta içi her gün saat ${hour}:${minute.toString().padStart(2, '0')}`,
    repeat: 'weekdays',
    repeatText: 'Hafta içi her gün',
    nextReminder: nextTime.toDate()
  };
}

function parseOneTimeReminder(text) {
  // "Yarın saat 10:00'da toplantı" formatı
  const tomorrowMatch = text.match(/yarın\s+saat\s*(\d{1,2}):(\d{2})/i);
  if (tomorrowMatch) {
    const hour = parseInt(tomorrowMatch[1]);
    const minute = parseInt(tomorrowMatch[2]);
    
    const cleanText = text.replace(/yarın\s+saat\s*\d{1,2}:\d{2}/gi, '').trim();
    const nextTime = moment().add(1, 'day').hour(hour).minute(minute).second(0);
    
    return {
      text: cleanText,
      time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      timeText: `Yarın saat ${hour}:${minute.toString().padStart(2, '0')}`,
      repeat: null,
      repeatText: null,
      nextReminder: nextTime.toDate()
    };
  }
  
  // "Bugün saat 15:30'da toplantı" formatı
  const todayMatch = text.match(/bugün\s+saat\s*(\d{1,2}):(\d{2})/i);
  if (todayMatch) {
    const hour = parseInt(todayMatch[1]);
    const minute = parseInt(todayMatch[2]);
    
    const cleanText = text.replace(/bugün\s+saat\s*\d{1,2}:\d{2}/gi, '').trim();
    const nextTime = moment().hour(hour).minute(minute).second(0);
    
    // Eğer saat geçmişse, yarına ayarla
    if (nextTime.isBefore(moment())) {
      nextTime.add(1, 'day');
    }
    
    return {
      text: cleanText,
      time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      timeText: `Bugün saat ${hour}:${minute.toString().padStart(2, '0')}`,
      repeat: null,
      repeatText: null,
      nextReminder: nextTime.toDate()
    };
  }
  
  // "Saat 20:00'da film izle" formatı
  const timeMatch = text.match(/saat\s*(\d{1,2}):(\d{2})/i);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1]);
    const minute = parseInt(timeMatch[2]);
    
    const cleanText = text.replace(/saat\s*\d{1,2}:\d{2}/gi, '').trim();
    const nextTime = moment().hour(hour).minute(minute).second(0);
    
    // Eğer saat geçmişse, yarına ayarla
    if (nextTime.isBefore(moment())) {
      nextTime.add(1, 'day');
    }
    
    return {
      text: cleanText,
      time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      timeText: `Saat ${hour}:${minute.toString().padStart(2, '0')}`,
      repeat: null,
      repeatText: null,
      nextReminder: nextTime.toDate()
    };
  }
  
  return null;
}

module.exports = {
  parseReminderText
}; 
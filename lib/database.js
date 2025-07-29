const { MongoClient } = require('mongodb');

let client = null;
let db = null;

async function connectDB() {
  if (db) return db;
  
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  
  client = new MongoClient(uri);
  await client.connect();
  db = client.db('reminder-bot');
  
  // Collection'ları oluştur
  await db.createCollection('reminders');
  
  // Index oluştur
  await db.collection('reminders').createIndex({ chatId: 1 });
  await db.collection('reminders').createIndex({ nextReminder: 1 });
  
  return db;
}

async function saveReminder(reminder) {
  const database = await connectDB();
  const result = await database.collection('reminders').insertOne(reminder);
  return result.insertedId;
}

async function getReminders(chatId) {
  const database = await connectDB();
  return await database.collection('reminders')
    .find({ chatId })
    .sort({ createdAt: -1 })
    .toArray();
}

async function getDueReminders() {
  const database = await connectDB();
  const now = new Date();
  
  return await database.collection('reminders')
    .find({ 
      nextReminder: { $lte: now }
    })
    .toArray();
}

async function updateNextReminder(reminderId, nextReminder) {
  const database = await connectDB();
  return await database.collection('reminders')
    .updateOne(
      { _id: reminderId },
      { $set: { nextReminder } }
    );
}

async function deleteReminder(reminderId) {
  const database = await connectDB();
  return await database.collection('reminders')
    .deleteOne({ _id: reminderId });
}

async function closeConnection() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = {
  connectDB,
  saveReminder,
  getReminders,
  getDueReminders,
  updateNextReminder,
  deleteReminder,
  closeConnection
}; 
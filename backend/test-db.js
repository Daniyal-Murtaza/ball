const pool = require('./config/database');

async function testConnection() {
  try {
    // Test the connection
    const connection = await pool.getConnection();
    console.log('✅ Database connection successful!');
    
    // Test query to check if tables exist
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\nTables in database:');
    tables.forEach(table => { 
      console.log(`- ${Object.values(table)[0]}`);
    }); 

    // Test users table
    const [users] = await connection.query('SELECT * FROM users');
    console.log('\nUsers in database:', users.length);

    // Test messages table
    const [messages] = await connection.query('SELECT * FROM messages');
    console.log('Messages in database:', messages.length);

    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    // Close the pool
    await pool.end();
  }
}

testConnection(); 
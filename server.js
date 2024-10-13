const express = require('express');
const { Client } = require('pg'); // Import PostgreSQL client
const cors = require('cors');

// Initialize express app
const app = express();
app.use(cors());
app.use(express.json());


const { Client } = require('pg'); 
// Connect to PostgreSQL
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, 
  },
});

client.connect()
  .then(() => {
    console.log('Connected to PostgreSQL');
  })
  .catch((error) => {
    console.error('Error connecting to PostgreSQL:', error);
  });



// Route to save user (from Google Sign-In)
app.post('/api/saveUser', async (req, res) => {
  const { uid, name, email } = req.body;

  try {
    // Check if user exists
    const userRes = await client.query('SELECT * FROM users WHERE id = $1', [uid]);

    if (userRes.rows.length === 0) {
      // User does not exist, insert new user
      await client.query(
        'INSERT INTO users (id, name, email, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
        [uid, name, email]
      );
      res.status(200).json({ message: 'User saved', user: { uid, name, email } });
    } else {
      // User already exists
      res.status(200).json({ message: 'User already exists', user: userRes.rows[0] });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error saving user', error });
  }
});

// Route to save response
app.post('/api/saveResponse', async (req, res) => {
  const { text, userId } = req.body;

  try {
    // Insert response into the database
    const responseRes = await client.query(
      'INSERT INTO responses (user_id, query, result_text, summary, result_table_path, result_visualization_path) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [userId, text, 'Sample result text', 'Sample summary', 'http://example.com/sample_table', 'http://example.com/sample_visualization']
    );

    // Get the response ID
    const responseId = responseRes.rows[0].id;

    // Update user's responses array
    await client.query('UPDATE users SET responses = array_append(responses, $1) WHERE id = $2', [responseId, userId]);

    res.status(200).json({ message: 'Response saved successfully' });
  } catch (error) {
    console.error("Error saving response:", error);
    res.status(500).json({ message: 'Error saving response', error });
  }
});

// Sample route for the chatbot API
app.post('/api/chatbot', async (req, res) => {
  const { query, userId } = req.body;

  // Mock response
  const mockResponse = {
    summary: "Sample summary",
    result_text: "Sample result text",
    result_table_path: "http://example.com/sample_table",
    result_visualization_path: "http://example.com/sample_visualization",
  };

  res.status(200).json(mockResponse);
});

app.get('/api/getUsers', async (req, res) => {
  try {
    const usersRes = await client.query(`
      SELECT users.id, users.name, users.email, responses.id as response_id, responses.query, responses.result_text, responses.summary, responses.result_table_path, responses.result_visualization_path
      FROM users
      LEFT JOIN responses ON users.id = responses.user_id
    `);

    // Format the data to group responses by user
    const users = usersRes.rows.reduce((acc, row) => {
      const { id, name, email, response_id, query, result_text, summary, result_table_path, result_visualization_path } = row;
      const user = acc.find(u => u.uid === id);

      if (!user) {
        acc.push({
          uid: id,
          name,
          email,
          responses: response_id ? [{
            id: response_id,
            query,
            result_text,
            summary,
            result_table_path,
            result_visualization_path,
          }] : [],
        });
      } else if (response_id) {
        user.responses.push({
          id: response_id,
          query,
          result_text,
          summary,
          result_table_path,
          result_visualization_path,
        });
      }

      return acc;
    }, []);

    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

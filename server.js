const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
// Increase JSON payload limit and handle errors better
app.use(express.json({ limit: '10mb', strict: false }));
// Error handler for JSON parsing
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON parsing error:', err.message);
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid JSON format',
      details: err.message 
    });
  }
  next();
});

// Daily.co API configuration
const DAILY_API_KEY = '6056715a3a6e6fecb6eba6b2843f7dfad299f48fa70cd1f635d62a159a094129';
const DAILY_API_URL = 'https://api.daily.co/v1';

// Initialize Firebase Admin (you'll need to download service account key)
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Store user tokens by role
const walkerTokens = new Set();
const ownerTokens = new Set();

// Register walker token
app.post('/register-walker', (req, res) => {
  const { token } = req.body;
  walkerTokens.add(token);
  console.log('Walker registered:', token);
  res.json({ success: true });
});

// Register owner token
app.post('/register-owner', (req, res) => {
  const { token } = req.body;
  ownerTokens.add(token);
  console.log('Owner registered:', token);
  res.json({ success: true });
});

// Send notification to walkers
app.post('/notify-walkers', async (req, res) => {
  const { title, body } = req.body;
  
  if (walkerTokens.size === 0) {
    return res.json({ success: false, message: 'No walkers registered' });
  }

  const message = {
    notification: {
      title: title || 'New Walk Request',
      body: body || 'Someone is looking for a walker!'
    },
    tokens: Array.from(walkerTokens)
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log('Notification sent to walkers:', response.successCount, 'successful');
    res.json({ success: true, sent: response.successCount });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.json({ success: false, error: error.message });
  }
});

// Send notification to owners
app.post('/notify-owners', async (req, res) => {
  const { title, body } = req.body;
  
  if (ownerTokens.size === 0) {
    return res.json({ success: false, message: 'No owners registered' });
  }

  const message = {
    notification: {
      title: title || 'Walk Update',
      body: body || 'Your walk request has been updated!'
    },
    tokens: Array.from(ownerTokens)
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log('Notification sent to owners:', response.successCount, 'successful');
    res.json({ success: true, sent: response.successCount });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.json({ success: false, error: error.message });
  }
});

// Get registered tokens (for debugging)
app.get('/tokens', (req, res) => {
  res.json({
    walkers: Array.from(walkerTokens),
    owners: Array.from(ownerTokens)
  });
});

// Create Daily.co room
app.post('/create-daily-room', async (req, res) => {
  const { roomName } = req.body;
  
  if (!roomName) {
    return res.status(400).json({ success: false, error: 'Room name is required' });
  }

  // Sanitize room name - Daily.co requires lowercase alphanumeric and hyphens only
    const sanitizedRoomName = roomName.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 50);

    console.log('Creating Daily room with name:', sanitizedRoomName);
  
  try {
    const response = await axios.post(
      `${DAILY_API_URL}/rooms`,
      {
        name: sanitizedRoomName,
        privacy: 'private',
        properties: {
          enable_screenshare: false,
          enable_chat: false,
          enable_knocking: false,
          enable_recording: false
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${DAILY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Daily room created:', response.data);
    // Return the sanitized room name so the client can use it for token creation
        res.json({
          success: true,
          room: response.data,
          sanitizedRoomName: sanitizedRoomName
        });
  } catch (error) {
      console.error('Error creating Daily room:', error.response?.data || error.message);
      const errorData = error.response?.data || {};
      const errorInfo = errorData.info || errorData.error || error.message;
      
      // If room already exists, try to get it instead
      if (errorInfo && errorInfo.includes('already exists')) {
        console.log('Room already exists, attempting to get existing room:', sanitizedRoomName);
        try {
          const getResponse = await axios.get(
            `${DAILY_API_URL}/rooms/${sanitizedRoomName}`,
            {
              headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log('Retrieved existing Daily room:', getResponse.data);
          res.json({ 
            success: true, 
            room: getResponse.data,
            sanitizedRoomName: sanitizedRoomName
          });
          return;
        } catch (getError) {
          console.error('Error getting existing room:', getError.response?.data || getError.message);
          // Fall through to return error
        }
      }
      
      const errorMessage = errorInfo || error.message;
      const statusCode = error.response?.status || 500;
      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        details: error.response?.data || null
      });
    }
});

// Create Daily.co token for a room
app.post('/create-daily-token', async (req, res) => {
  const { roomName, userName, isOwner } = req.body;
  
  if (!roomName) {
    return res.status(400).json({ success: false, error: 'Room name is required' });
  }
   // Sanitize room name to match the one used when creating the room
    const sanitizedRoomName = roomName.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 50);
    const sanitizedUserName = (userName || (isOwner ? 'Owner' : 'Walker')).substring(0, 50);

    console.log('Creating Daily token for room:', sanitizedRoomName, 'user:', sanitizedUserName);

    try {
    const response = await axios.post(
      `${DAILY_API_URL}/meeting-tokens`,
      {
        properties: {
          room_name: sanitizedRoomName,
          user_name: sanitizedUserName,
          enable_screenshare: false,
          enable_chat: false
        }
        // Note: expiration and is_owner are not supported in Daily.co meeting tokens API
        // Tokens expire based on Daily.co's default settings
      },
      {
        headers: {
          'Authorization': `Bearer ${DAILY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Daily token created:', response.data);
    res.json({ success: true, token: response.data.token });
  } catch (error) {
      console.error('Error creating Daily token:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.error || error.response?.data?.info || error.message;
      const statusCode = error.response?.status || 500;
      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        details: error.response?.data || null
      });
    }
});

const PORT = process.env.PORT || 3000;

// Health check endpoint for cloud platforms
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('Endpoints:');
  console.log('GET /health - Health check');
  console.log('POST /register-walker - Register walker token');
  console.log('POST /register-owner - Register owner token');
  console.log('POST /notify-walkers - Send notification to walkers');
  console.log('POST /notify-owners - Send notification to owners');
  console.log('GET /tokens - View registered tokens');
  console.log('POST /create-daily-room - Create Daily.co room');
  console.log('POST /create-daily-token - Create Daily.co token');
});


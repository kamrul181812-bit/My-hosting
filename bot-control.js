const admin = require("firebase-admin");

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL
      })
    });
    console.log("✅ Firebase Admin initialized for bot-control");
  } catch (error) {
    console.error("❌ Firebase Admin init error:", error.message);
  }
}

exports.handler = async (event, context) => {
  console.log("🤖 Bot-control function called");
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
      },
      body: ''
    };
  }

  try {
    // Check authorization header
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("❌ No authorization token provided");
      return {
        statusCode: 401,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: false,
          error: 'No authorization token. Please login again.' 
        })
      };
    }

    // Extract and verify token
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
      console.log("✅ Token verified for user:", decodedToken.uid);
    } catch (error) {
      console.error("❌ Token verification failed:", error.message);
      return {
        statusCode: 401,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid or expired token. Please login again.' 
        })
      };
    }

    const userId = decodedToken.uid;
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);

    // Handle POST requests (start/stop bot)
    if (event.httpMethod === 'POST') {
      let data;
      try {
        data = JSON.parse(event.body);
      } catch (error) {
        return {
          statusCode: 400,
          headers: { 
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            success: false,
            error: 'Invalid JSON in request body' 
          })
        };
      }

      const { action } = data;

      if (action === 'start') {
        console.log("🚀 Starting bot for user:", userId);
        
        try {
          await userRef.update({
            botState: 'running',
            lastStarted: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          return {
            statusCode: 200,
            headers: { 
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              success: true, 
              message: 'Bot started successfully',
              botState: 'running',
              timestamp: new Date().toISOString()
            })
          };
          
        } catch (error) {
          console.error("❌ Error starting bot:", error);
          return {
            statusCode: 500,
            headers: { 
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              success: false,
              error: 'Failed to start bot',
              details: error.message 
            })
          };
        }
        
      } else if (action === 'stop') {
        console.log("🛑 Stopping bot for user:", userId);
        
        try {
          await userRef.update({
            botState: 'stopped',
            lastStopped: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          return {
            statusCode: 200,
            headers: { 
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              success: true, 
              message: 'Bot stopped successfully',
              botState: 'stopped',
              timestamp: new Date().toISOString()
            })
          };
          
        } catch (error) {
          console.error("❌ Error stopping bot:", error);
          return {
            statusCode: 500,
            headers: { 
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              success: false,
              error: 'Failed to stop bot',
              details: error.message 
            })
          };
        }
        
      } else if (action === 'status') {
        // Get current bot status
        try {
          const userDoc = await userRef.get();
          
          if (!userDoc.exists) {
            return {
              statusCode: 404,
              headers: { 
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                success: false,
                error: 'User not found' 
              })
            };
          }
          
          const userData = userDoc.data();
          
          return {
            statusCode: 200,
            headers: { 
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              success: true,
              botState: userData.botState || 'stopped',
              netlifyUrl: userData.netlifyUrl || null,
              lastDeployed: userData.lastDeployed || null,
              balance: userData.balance || 100.00,
              githubRepo: userData.githubRepo || null,
              lastStarted: userData.lastStarted || null,
              lastStopped: userData.lastStopped || null
            })
          };
          
        } catch (error) {
          console.error("❌ Error getting status:", error);
          return {
            statusCode: 500,
            headers: { 
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              success: false,
              error: 'Failed to get bot status' 
            })
          };
        }
        
      } else {
        return {
          statusCode: 400,
          headers: { 
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            success: false,
            error: 'Invalid action. Use "start", "stop", or "status"' 
          })
        };
      }
      
    } 
    // Handle GET requests
    else if (event.httpMethod === 'GET') {
      console.log("📊 Getting bot info for user:", userId);
      
      try {
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
          // Create user document if doesn't exist
          await userRef.set({
            email: decodedToken.email || 'unknown@email.com',
            balance: 100.00,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            botState: 'stopped',
            botFiles: {}
          });
          
          return {
            statusCode: 200,
            headers: { 
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              success: true,
              botState: 'stopped',
              balance: 100.00,
              message: 'New user profile created'
            })
          };
        }
        
        const userData = userDoc.data();
        
        return {
          statusCode: 200,
          headers: { 
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: true,
            botState: userData.botState || 'stopped',
            netlifyUrl: userData.netlifyUrl || null,
            lastDeployed: userData.lastDeployed || null,
            balance: userData.balance || 100.00,
            githubRepo: userData.githubRepo || null,
            email: userData.email || decodedToken.email,
            hasBotFiles: !!(userData.botFiles && userData.botFiles.bot)
          })
        };
        
      } catch (error) {
        console.error("❌ Error getting user data:", error);
        return {
          statusCode: 500,
          headers: { 
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            success: false,
            error: 'Failed to fetch user data',
            details: error.message 
          })
        };
      }
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false,
        error: 'Method not allowed. Use POST or GET' 
      })
    };

  } catch (error) {
    console.error("💥 Unexpected error in bot-control:", error);
    
    return {
      statusCode: 500,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
      })
    };
  }
};

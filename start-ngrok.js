const { spawn } = require('child_process');
const http = require('http');

// Function to start ngrok and get the public URL
function startNgrok() {
  console.log('Starting ngrok tunnel for port 3000...');
  
  // Start ngrok process
  const ngrok = spawn('npx', ['ngrok', 'http', '3000']);
  
  ngrok.stdout.on('data', (data) => {
    console.log(`ngrok output: ${data}`);
  });
  
  ngrok.stderr.on('data', (data) => {
    console.error(`ngrok error: ${data}`);
  });
  
  // Check the ngrok API to get the public URL
  setTimeout(() => {
    http.get('http://localhost:4040/api/tunnels', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const tunnels = JSON.parse(data).tunnels;
          const secureUrl = tunnels.find(t => t.proto === 'https').public_url;
          
          console.log('\n========================================');
          console.log(`Your ngrok URL is: ${secureUrl}`);
          console.log(`Use this URL for your Twilio TwiML App's Request URL:`);
          console.log(`${secureUrl}/api/voice`);
          console.log('========================================\n');
        } catch (e) {
          console.error('Error parsing ngrok tunnels:', e);
        }
      });
    }).on('error', (err) => {
      console.error('Error fetching ngrok tunnels:', err);
    });
  }, 2000); // Wait a bit for ngrok to start
  
  return ngrok;
}

// Start ngrok
const ngrokProcess = startNgrok();

// Handle termination
process.on('SIGINT', () => {
  console.log('Shutting down ngrok...');
  ngrokProcess.kill();
  process.exit();
});

console.log('Press Ctrl+C to stop ngrok.'); 
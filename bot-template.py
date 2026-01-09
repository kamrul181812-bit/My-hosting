#!/usr/bin/env python3
"""
Python Bot Template for Netlify Hosting
This is a sample bot that users can customize
"""

import os
import time
import json
import logging
import requests
from datetime import datetime
from threading import Thread

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('bot.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class Bot:
    def __init__(self):
        self.running = False
        self.config = self.load_config()
        self.version = "1.0.0"
        
    def load_config(self):
        """Load configuration from environment variables"""
        config = {
            'bot_name': os.getenv('BOT_NAME', 'My Python Bot'),
            'interval': int(os.getenv('BOT_INTERVAL', '60')),
            'api_endpoint': os.getenv('API_ENDPOINT', ''),
            'webhook_url': os.getenv('WEBHOOK_URL', '')
        }
        return config
    
    def save_state(self, state):
        """Save bot state to file"""
        try:
            with open('bot_state.json', 'w') as f:
                json.dump(state, f, indent=2)
            logger.info("State saved successfully")
        except Exception as e:
            logger.error(f"Failed to save state: {e}")
    
    def load_state(self):
        """Load bot state from file"""
        try:
            with open('bot_state.json', 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {'started_at': datetime.now().isoformat(), 'iterations': 0}
        except Exception as e:
            logger.error(f"Failed to load state: {e}")
            return {'started_at': datetime.now().isoformat(), 'iterations': 0}
    
    def process_task(self):
        """Main task processing logic"""
        state = self.load_state()
        state['iterations'] = state.get('iterations', 0) + 1
        state['last_run'] = datetime.now().isoformat()
        
        logger.info(f"Running iteration {state['iterations']}")
        
        # Example task: Check external API
        if self.config['api_endpoint']:
            try:
                response = requests.get(self.config['api_endpoint'], timeout=10)
                logger.info(f"API status: {response.status_code}")
                
                # Process data if needed
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Received {len(data) if isinstance(data, list) else 1} items")
            except Exception as e:
                logger.error(f"API call failed: {e}")
        
        # Example: Send webhook notification
        if self.config['webhook_url'] and state['iterations'] % 10 == 0:
            try:
                payload = {
                    'bot': self.config['bot_name'],
                    'iteration': state['iterations'],
                    'timestamp': datetime.now().isoformat(),
                    'status': 'running'
                }
                requests.post(self.config['webhook_url'], json=payload, timeout=5)
                logger.info("Webhook sent successfully")
            except Exception as e:
                logger.error(f"Webhook failed: {e}")
        
        self.save_state(state)
        return state
    
    def run(self):
        """Main bot loop"""
        self.running = True
        logger.info(f"ðŸš€ Starting {self.config['bot_name']} v{self.version}")
        logger.info(f"Interval: {self.config['interval']} seconds")
        
        try:
            while self.running:
                start_time = time.time()
                
                # Process main task
                state = self.process_task()
                
                # Calculate sleep time
                elapsed = time.time() - start_time
                sleep_time = max(1, self.config['interval'] - elapsed)
                
                # Log status every 5 iterations
                if state['iterations'] % 5 == 0:
                    logger.info(f"Bot status: {state['iterations']} iterations completed")
                
                # Sleep until next iteration
                if self.running:
                    time.sleep(sleep_time)
                    
        except KeyboardInterrupt:
            logger.info("Bot stopped by user")
        except Exception as e:
            logger.error(f"Bot error: {e}")
        finally:
            self.stop()
    
    def stop(self):
        """Stop the bot"""
        self.running = False
        state = self.load_state()
        state['stopped_at'] = datetime.now().isoformat()
        self.save_state(state)
        logger.info("Bot stopped")
    
    def start_background(self):
        """Start bot in background thread"""
        thread = Thread(target=self.run, daemon=True)
        thread.start()
        return thread

def main():
    """Main entry point for the bot"""
    bot = Bot()
    
    # Start the bot
    bot.run()

if __name__ == "__main__":
    main()

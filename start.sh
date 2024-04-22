#!/bin/bash

# Function to load nvm and use it to set the Node version
load_nvm_and_use() {
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

  nvm use $1
}

# Start Server
echo "Starting server..."
cd /data/projects/TexasPokerGame2/server
load_nvm_and_use 18
nohup yarn dev &>/dev/null &
echo "Server started with PID $!"

# Start Client
echo "Starting client..."
cd /data/projects/TexasPokerGame2/client
load_nvm_and_use 16
nohup yarn dev &>/dev/null &
echo "Client started with PID $!"

echo "Both server and client have been started."

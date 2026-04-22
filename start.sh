#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Function to load nvm and use it to set the Node version
load_nvm_and_use() {
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

  nvm use $1
}

export POKER_DB_PATH="$PROJECT_DIR/poker.db"

# Start Server
echo "Starting server..."
cd "$PROJECT_DIR/server"
load_nvm_and_use 18
nohup yarn dev &>/dev/null &
echo "Server started with PID $!"

# Start Client
echo "Starting client..."
cd "$PROJECT_DIR/client"
load_nvm_and_use 18
nohup yarn dev &>/dev/null &
echo "Client started with PID $!"

echo "Both server and client have been started."

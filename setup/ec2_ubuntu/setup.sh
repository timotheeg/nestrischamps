sudo apt update
sudo apt upgrade -y
sudo apt install -y git build-essential vim zsh gawk postgresql

echo "CREATE USER nestrischamps with encrypted password 'nestrischamps'; CREATE DATABASE nestrischamps with owner=nestrischamps;" | sudo -u postgres psql

DB_URL="postgres://nestrischamps:nestrischamps@localhost:5432/nestrischamps?sslmode=disable"

curl -q "https://raw.githubusercontent.com/timotheeg/nestrischamps/main/setup/db.sql" | psql "${DB_URL}"

mkdir -p src
cd src
git clone https://github.com/timotheeg/nestrischamps.git
cd nestrischamps
mkdir -p logs
git checkout local_https
echo "DATABASE_URL=${DB_URL}" > .env

sudo apt-get install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

NODE_MAJOR=20

echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

sudo apt-get update
sudo apt-get install -y nodejs

npm install

SESSION_SECRET=$(echo "console.log(require('ulid').ulid())" | node)
PORT=5443
TLS_KEY_PATH=/home/ubuntu/src/nestrischamps/nestrischamps.local.key
TLS_CERT_PATH=/home/ubuntu/src/nestrischamps/nestrischamps.local.crt

tee .env > /dev/null << EOF
TLS_KEY=${TLS_KEY_PATH}
TLS_CERT=${TLS_CERT_PATH}
DATABASE_URL=${DB_URL}
SESSION_SECRET=${SESSION_SECRET}
FF_SAVE_GAME_FRAMES=0
IS_PUBLIC_SERVER=TRUE
PORT=${PORT}
TWITCH_CLIENT_ID=TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET=TWITCH_CLIENT_SECRET
EOF


sudo tee /etc/systemd/system/nestrischamps.service > /dev/null << EOF
[Unit]
Description=NesTrisChamps Service
Requires=postgresql.service

[Service]
User=ubuntu
Type=simple
WorkingDirectory=/home/ubuntu/src/nestrischamps
ExecStart=/usr/bin/node -r dotenv /home/ubuntu/src/nestrischamps/server.js
StandardOutput=file:/home/ubuntu/src/nestrischamps/logs/stdouterr.log
Restart=always

[Install]
WantedBy=multi-user.target
EOF


sudo systemctl daemon-reload
sudo systemctl enable postgresql
sudo systemctl restart nestrischamps
sudo systemctl enable nestrischamps
sudo systemctl daemon-reload

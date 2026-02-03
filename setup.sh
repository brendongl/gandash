#!/bin/bash
# AkuPKM Setup Script

set -e

echo "🚀 Setting up AkuPKM..."

# Install dependencies
echo "📦 Installing dependencies..."
cd "$(dirname "$0")"
npm install

# Initialize database tables
echo "🗄️ Setting up database tables..."

TOKEN="Lu4XzHtqJZ4HTRbOELjMIAIiuON2Swc-MpJsmy1j"
BASE_URL="http://localhost:8080/api/v2"
BASE_ID="ptkjq1nepc4u0re"

# Add new columns to Tasks table
echo "Updating Tasks table..."
TASKS_TABLE_ID="maq1zpfzhljxwhs"

# Create Subtasks table
echo "Creating Subtasks table..."
curl -s -X POST "$BASE_URL/meta/bases/$BASE_ID/tables" \
  -H "xc-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "subtasks",
    "title": "Subtasks",
    "columns": [
      {"column_name": "parent_task_id", "title": "Parent Task ID", "uidt": "Number"},
      {"column_name": "title", "title": "Title", "uidt": "SingleLineText"},
      {"column_name": "completed", "title": "Completed", "uidt": "Checkbox"}
    ]
  }' || echo "Table may already exist"

# Create People table
echo "Creating People table..."
curl -s -X POST "$BASE_URL/meta/bases/$BASE_ID/tables" \
  -H "xc-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "people",
    "title": "People",
    "columns": [
      {"column_name": "name", "title": "Name", "uidt": "SingleLineText"},
      {"column_name": "discord_id", "title": "Discord ID", "uidt": "SingleLineText"},
      {"column_name": "email", "title": "Email", "uidt": "Email"}
    ]
  }' || echo "Table may already exist"

# Create Task_Assignees table
echo "Creating Task_Assignees table..."
curl -s -X POST "$BASE_URL/meta/bases/$BASE_ID/tables" \
  -H "xc-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "task_assignees",
    "title": "Task_Assignees",
    "columns": [
      {"column_name": "task_id", "title": "Task ID", "uidt": "Number"},
      {"column_name": "person_id", "title": "Person ID", "uidt": "Number"}
    ]
  }' || echo "Table may already exist"

# Create Task_Tags table
echo "Creating Task_Tags table..."
curl -s -X POST "$BASE_URL/meta/bases/$BASE_ID/tables" \
  -H "xc-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "task_tags",
    "title": "Task_Tags",
    "columns": [
      {"column_name": "task_id", "title": "Task ID", "uidt": "Number"},
      {"column_name": "tag_id", "title": "Tag ID", "uidt": "Number"}
    ]
  }' || echo "Table may already exist"

# Create Notification_Settings table
echo "Creating Notification_Settings table..."
curl -s -X POST "$BASE_URL/meta/bases/$BASE_ID/tables" \
  -H "xc-token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "notification_settings",
    "title": "Notification_Settings",
    "columns": [
      {"column_name": "task_id", "title": "Task ID", "uidt": "Number"},
      {"column_name": "notify_on_due", "title": "Notify On Due", "uidt": "Checkbox"},
      {"column_name": "notify_days_before", "title": "Notify Days Before", "uidt": "Number"}
    ]
  }' || echo "Table may already exist"

# Get People table ID and add default users
echo "Adding default users..."
sleep 1
PEOPLE_RESPONSE=$(curl -s "$BASE_URL/meta/bases/$BASE_ID/tables" -H "xc-token: $TOKEN")
PEOPLE_TABLE_ID=$(echo "$PEOPLE_RESPONSE" | grep -o '"id":"[^"]*","table_name":"people"' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$PEOPLE_TABLE_ID" ]; then
  echo "People table ID: $PEOPLE_TABLE_ID"
  
  # Add Brendon
  curl -s -X POST "$BASE_URL/tables/$PEOPLE_TABLE_ID/records" \
    -H "xc-token: $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"Name": "Brendon", "Discord ID": "147649565330243584"}' || true
  
  # Add Ivy
  curl -s -X POST "$BASE_URL/tables/$PEOPLE_TABLE_ID/records" \
    -H "xc-token: $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"Name": "Ivy", "Discord ID": "623156654199930882"}' || true
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the server:"
echo "  cd ~/clawd/projects/akupkm && npm start"
echo ""
echo "Access at: http://192.168.50.39:3002"

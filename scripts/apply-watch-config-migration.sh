#!/bin/bash

# Apply the watch_config_services migration
# This script provides step-by-step instructions for applying the migration

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Migration: watch_config_services (20260306)                  ║"
echo "║   Add service filtering support to watch_config table          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

MIGRATION_FILE="supabase/migrations/20260306_watch_config_services.sql"
PROJECT_ID="your-project-ref"
SUPABASE_URL="https://api.nokk-project.example"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "ERROR: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "Migration file found: $MIGRATION_FILE"
echo "Project ID: $PROJECT_ID"
echo "Supabase URL: $SUPABASE_URL"
echo ""

# Check for Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Showing manual instructions:"
    echo ""
    echo "Option 1: Using Supabase Dashboard"
    echo "────────────────────────────────────"
    echo "1. Open: https://app.supabase.com"
    echo "2. Select project: $PROJECT_ID"
    echo "3. Go to SQL Editor"
    echo "4. Click 'New Query'"
    echo "5. Copy the content from: $MIGRATION_FILE"
    echo "6. Paste into the editor"
    echo "7. Click 'Run'"
    echo ""
    echo "Option 2: Using Supabase CLI"
    echo "────────────────────────────────────"
    echo "1. Install Supabase CLI: npm install -g supabase"
    echo "2. Login: supabase login"
    echo "3. Link project: supabase link --project-ref $PROJECT_ID"
    echo "4. Push migration: supabase db push"
    echo ""
    exit 0
fi

echo "✓ Supabase CLI found"
echo ""

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "ERROR: Not logged in to Supabase. Run: supabase login"
    exit 1
fi

echo "✓ Authenticated to Supabase"
echo ""

# Link to project if not already linked
if [ ! -f ".supabase/config.json" ]; then
    echo "Linking to project: $PROJECT_ID"
    supabase link --project-ref "$PROJECT_ID"
else
    echo "✓ Project already linked"
fi

echo ""
echo "Applying migration..."
echo ""

# Apply the migration
supabase db push

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Migration Applied Successfully!                              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

echo "Next steps:"
echo "1. Verify migration: npm run verify:migration"
echo "2. Update TypeScript types to include service_ids"
echo "3. Update useTopics hook to filter by service if needed"
echo "4. Run tests: npm test"
echo ""

echo "Migration details:"
echo "  • Added service_ids column (uuid[] | NULL)"
echo "  • Created GIN index for efficient filtering"
echo "  • Added watch_config_visible_to_service() function"
echo ""
echo "Documentation: docs/MIGRATION_GUIDE.md"

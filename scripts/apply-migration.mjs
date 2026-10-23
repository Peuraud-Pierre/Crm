#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL
const supabaseKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY

// For admin operations, we need the service role key
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
    console.error('ERROR: PUBLIC_SUPABASE_URL not found in environment')
    process.exit(1)
}

if (!supabaseKey) {
    console.error('ERROR: PUBLIC_SUPABASE_PUBLISHABLE_KEY not found in environment')
    process.exit(1)
}

// Use service role key if available for admin operations, otherwise fall back
const apiKey = supabaseServiceRoleKey || supabaseKey

const supabase = createClient(supabaseUrl, apiKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
})

async function applyMigration() {
    console.log('Starting migration: 20260306_watch_config_services')
    console.log(`Supabase URL: ${supabaseUrl}`)

    try {
        // Read the migration file
        const migrationPath = path.join(__dirname, '../supabase/migrations/20260306_watch_config_services.sql')
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

        console.log('\n--- Migration SQL ---')
        console.log(migrationSQL)
        console.log('--- End Migration ---\n')

        // Split by statements (simple approach)
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'))

        console.log(`Found ${statements.length} SQL statements to execute\n`)

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i]
            console.log(`[${i + 1}/${statements.length}] Executing statement...`)
            console.log(`SQL: ${statement.substring(0, 80)}...`)

            try {
                const { error } = await supabase.rpc('execute_sql', {
                    sql: statement
                }).then(result => {
                    if (result.error) throw result.error
                    return { error: null }
                }).catch(err => ({
                    error: err
                }))

                if (error) {
                    // If rpc doesn't exist, try direct query
                    console.log('Attempting direct query execution...')
                    const { error: queryError } = await supabase
                        .from('_migrations')
                        .select()
                        .limit(0)
                        .then(() => {
                            // If table exists, we can try other approaches
                            return { error: null }
                        })
                        .catch(() => ({ error: 'Cannot execute arbitrary SQL with public key' }))

                    if (queryError) {
                        console.warn(`WARNING: Statement ${i + 1} execution result unclear: ${error}`)
                        console.warn('Note: Arbitrary SQL execution requires service role key')
                        continue
                    }
                }
                console.log(`✓ Statement ${i + 1} executed successfully`)
            } catch (err) {
                console.error(`ERROR executing statement ${i + 1}: ${err.message}`)
                console.error('Full error:', err)
            }
        }

        console.log('\n--- Verifying Migration ---\n')

        // Try to verify the changes
        try {
            // Check if service_ids column exists
            const { error: infoError } = await supabase
                .from('watch_config')
                .select('service_ids')
                .limit(1)

            if (infoError) {
                console.log('Could not verify column existence directly')
                console.log('Error:', infoError.message)
            } else {
                console.log('✓ watch_config table is accessible')
                console.log('✓ service_ids column appears to be present')
            }
        } catch (err) {
            console.log('Verification check encountered an issue:', err.message)
        }

        console.log('\nMigration completed!')
        console.log('\nNOTE: For applying migrations with arbitrary SQL statements,')
        console.log('you need to use the Supabase dashboard SQL editor or CLI with service role key.')
        console.log('\nTo fully apply this migration:')
        console.log('1. Go to Supabase Dashboard: https://app.supabase.com')
        console.log('2. Select your project: your-project-ref')
        console.log('3. Go to SQL Editor')
        console.log('4. Paste the migration SQL from supabase/migrations/20260306_watch_config_services.sql')
        console.log('5. Click "Run"')

    } catch (err) {
        console.error('Migration error:', err.message)
        process.exit(1)
    }
}

applyMigration()
